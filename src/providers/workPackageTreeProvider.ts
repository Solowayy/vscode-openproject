import * as vscode from "vscode";
import { apiClient } from "../api/apiClient";
import { WorkPackage, Project } from "../api/types";

export class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: "project" | "workpackage" | "folder" | "message",
    public readonly project?: Project,
    public readonly workPackage?: WorkPackage,
    public readonly parentProject?: Project,
    public readonly allProjectWorkPackages: WorkPackage[] = [],
  ) {
    super(label, collapsibleState);

    if (itemType === "project") {
      this.contextValue = "project";
      this.iconPath = new vscode.ThemeIcon("folder-opened");
      this.tooltip = project?.description?.raw || project?.name;
    } else if (itemType === "workpackage") {
      this.contextValue = "workpackage";
      // Check if Summary Task (Type ID = 3)
      if (workPackage && workPackage._links.type.href.endsWith("/3")) {
        this.contextValue = "workpackage_summary";
      }
      this.iconPath = new vscode.ThemeIcon("file");
      this.tooltip = `#${workPackage?.id} - ${workPackage?.subject}`;
      this.description = `#${workPackage?.id}`;
      this.command = {
        command: "openproject.openWorkPackage",
        title: "Open work project",
        arguments: [workPackage],
      };
    } else if (itemType === "folder") {
      this.iconPath = new vscode.ThemeIcon("folder");
      this.contextValue = "folder";
    } else if (itemType === "message") {
      this.iconPath = new vscode.ThemeIcon("info");
      this.contextValue = "message";
    }
  }
}

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
  // onDidChangeTreeData?: vscode.Event<ProjectTreeItem | null | undefined> | undefined;
  private _onDidChangeTreeData: vscode.EventEmitter<
    ProjectTreeItem | undefined | null
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projects: Project[] = [];
  private wpCache: Map<number, WorkPackage[]> = new Map();

  refresh(): void {
    this.wpCache.clear();
    this.loadData().then(() => this._onDidChangeTreeData.fire(null));
  }

  private async loadData(): Promise<void> {
    if (!apiClient.isConfigured()) {
      await apiClient.initialize();
    }

    this.projects = await apiClient.getProjects();
  }

  private filterType: 'id' | 'type' | 'text' | 'none' = 'none';
  private filterValue: string = '';

  setFilter(type: 'id' | 'type' | 'text' | 'none', value: string = '') {
    this.filterType = type;
    this.filterValue = value;
    this.refresh();
  }

  getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProjectTreeItem): Promise<ProjectTreeItem[]> {
    if (!apiClient.isConfigured())
      return [
        new ProjectTreeItem(
          "Failed to connect",
          vscode.TreeItemCollapsibleState.None,
          "message",
        ),
      ];

    if (!element) {
      const topLevel = await apiClient.getProjects();
      return topLevel.map(
        (p) =>
          new ProjectTreeItem(
            p.name,
            vscode.TreeItemCollapsibleState.Collapsed,
            "project",
            p,
          ),
      );
    }

    if (element.itemType === "project" && element.project) {
      const projectId = element.project.id;

      const [subProjects, workPackages] = await Promise.all([
        apiClient.getProjects(projectId),
        apiClient.getWorkPackages(projectId),
      ]);

      console.log(
        `Fetched ${workPackages.length} tasks for project ${projectId}`,
      );

      // --- FILTERING LOGIC ---
      let displayedWPs = workPackages;
      if (this.filterType !== 'none') {
        const val = this.filterValue.toLowerCase();

        displayedWPs = workPackages.filter((wp) => {
          if (this.filterType === 'id') {
            return wp.id.toString() === val;
          } else if (this.filterType === 'type') {
            // Check _links.type.title if available, otherwise fallback
            return wp._links.type.title?.toLowerCase() === val;
          } else if (this.filterType === 'text') {
            return wp.subject.toLowerCase().includes(val) || wp.id.toString() === val;
          }
          return true;
        });

        // Return flat list if filtering
        return [
          // We might or might not want subprojects when filtering. 
          // Let's keep subprojects visible just in case.
          ...subProjects.map(p => new ProjectTreeItem(p.name, vscode.TreeItemCollapsibleState.Collapsed, "project", p)),
          ...displayedWPs.map(wp => this.createWorkPackageItem(wp, element.project!, workPackages))
        ];
      }
      // -----------------------

      const rootTasks = workPackages.filter((wp) => {
        return !wp._links.parent || !wp._links.parent.href;
      });
      console.log(`Found ${rootTasks.length} root tasks`);

      return [
        ...subProjects.map(
          (p) =>
            new ProjectTreeItem(
              p.name,
              vscode.TreeItemCollapsibleState.Collapsed,
              "project",
              p,
            ),
        ),
        ...rootTasks.map((wp) =>
          this.createWorkPackageItem(wp, element.project!, workPackages),
        ),
      ];
    }

    // Standard hierarchy for non-project items (only if NOT filtering, or if we decide to keeping hierarchy)
    // If filtering, we returned early above for 'project'.
    // But if we expand a filtered item? Filtered items are leaf nodes in flat view?
    // In createWorkPackageItem I set collapsibleState.
    // If I return flat list, createWorkPackageItem still checks for children.
    // If I expand a task in filtered view, what happens?
    // It calls getChildren(element). current code:
    if (element.itemType === "workpackage" && element.workPackage) {
      // If we are filtering, we probably shouldn't show children unless they verify the filter?
      // Or maybe we treat children as "context" and show them?
      // Let's stick to standard behavior for children expansion even if filtered.
      // BUT if we returned flat list, user sees all matches. Checking children might duplicate?
      // It's fine for now.

      const parentProject = element.parentProject;

      if (!parentProject) return [];

      const children = element.allProjectWorkPackages.filter((wp) => {
        const parentHref = wp._links.parent?.href;
        const selfHref = element.workPackage?._links.self.href;
        return parentHref && selfHref && parentHref === selfHref;
      });

      return children.map((ch) =>
        this.createWorkPackageItem(
          ch,
          element.project!,
          element.allProjectWorkPackages,
        ),
      );
    }

    return [];
  }

  private createWorkPackageItem(
    wp: WorkPackage,
    parentProject: Project,
    allWps: WorkPackage[],
  ): ProjectTreeItem {
    const selfHref = wp._links.self.href;
    const hasChildren = allWps.some(
      (item) => item._links.parent?.href === selfHref,
    );

    return new ProjectTreeItem(
      wp.subject,
      hasChildren
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
      "workpackage",
      undefined,
      wp,
      parentProject,
      allWps,
    );
  }
}
