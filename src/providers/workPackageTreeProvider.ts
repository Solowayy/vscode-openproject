import * as vscode from "vscode";
import { openProjectClient } from "../api/apiClient";
import { WorkPackage, Project } from "../api/types";

export class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: "project" | "workpackage" | "folder" | "message",
    public readonly project?: Project,
    public readonly workPackage?: WorkPackage,
    public readonly parentProject?: Project
  ) {
    super(label, collapsibleState);

    if (itemType === "project") {
      this.contextValue = "project";
      this.iconPath = new vscode.ThemeIcon("folder-opened");
      this.tooltip = project?.description?.raw || project?.name;
    } else if (itemType === "workpackage") {
      this.contextValue = "workpackage";
      this.iconPath = new vscode.ThemeIcon("file");
      this.tooltip = `#${workPackage?.id} - ${workPackage?.subject}`;
      this.description = `#${workPackage?.id}`;
      this.command = {
        command: "openproject.openWorkPackage",
        title: "Open work package",
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

export class ProjectTreeProvider
  implements vscode.TreeDataProvider<ProjectTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    ProjectTreeItem | undefined | null | void
  > = new vscode.EventEmitter<ProjectTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ProjectTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private projects: Project[] = [];
  private workPackagesByProject: Map<number, WorkPackage[]> = new Map();
  private hierarchyCache: Map<number, Map<string, WorkPackage[]>> = new Map();

  constructor() {}

  async initialize(): Promise<void> {
    await this.loadData();
  }

  refresh(): void {
    this.loadData().then(() => {
      this._onDidChangeTreeData.fire();
    });
  }

  private async loadData(): Promise<void> {
    try {
      if (!openProjectClient.isConfigured()) {
        const initialized = await openProjectClient.initialize();
        if (!initialized) {
          return;
        }
      }

      this.projects = await openProjectClient.getProjects();

      this.workPackagesByProject.clear();
      this.hierarchyCache.clear();

      for (const project of this.projects) {
        const workPackages = await openProjectClient.getWorkPackages(
          project.id
        );
        this.workPackagesByProject.set(project.id, workPackages);

        this.buildHierarchy(project.id, workPackages);
      }
    } catch (error) {
      console.error("Loading data error:", error);
      vscode.window.showErrorMessage("Error loading data form OpenProject");
    }
  }

  private buildHierarchy(projectId: number, workPackages: WorkPackage[]): void {
    const hierarchy = new Map<string, WorkPackage[]>();

    const byType = new Map<string, WorkPackage[]>();

    for (const wp of workPackages) {
      const typeHref = wp._links.type?.href || "unknown";
      const typeName = wp._links.type?.title || "Else";

      if (!byType.has(typeName)) {
        byType.set(typeName, []);
      }
      byType.get(typeName)!.push(wp);
    }

    this.hierarchyCache.set(projectId, byType);
  }

  getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProjectTreeItem): Promise<ProjectTreeItem[]> {
    if (!openProjectClient.isConfigured()) {
      return [
        new ProjectTreeItem(
          "SetUp connection with OpenProject",
          vscode.TreeItemCollapsibleState.None,
          "message"
        ),
      ];
    }

    if (!element) {
      if (this.projects.length === 0) {
        await this.loadData();

        if (this.projects.length === 0) {
          return [
            new ProjectTreeItem(
              "Project is not found",
              vscode.TreeItemCollapsibleState.None,
              "message"
            ),
          ];
        }
      }

      return this.projects.map(
        (project) =>
          new ProjectTreeItem(
            project.name,
            vscode.TreeItemCollapsibleState.Collapsed,
            "project",
            project
          )
      );
    }

    if (element.itemType === "project" && element.project) {
      const projectId = element.project.id;
      const hierarchy = this.hierarchyCache.get(projectId);

      if (!hierarchy || hierarchy.size === 0) {
        return [
          new ProjectTreeItem(
            "No work package",
            vscode.TreeItemCollapsibleState.None,
            "message"
          ),
        ];
      }

      const folders: ProjectTreeItem[] = [];

      for (const [typeName, workPackages] of hierarchy.entries()) {
        folders.push(
          new ProjectTreeItem(
            `${typeName} (${workPackages.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            "folder",
            undefined,
            undefined,
            element.project
          )
        );
      }

      return folders;
    }

    if (element.itemType === "folder" && element.parentProject) {
      const projectId = element.parentProject.id;
      const hierarchy = this.hierarchyCache.get(projectId);

      if (!hierarchy) {
        return [];
      }

      const typeName = element.label.replace(/\s*\(\d+\)$/, "");
      const workPackages = hierarchy.get(typeName) || [];

      return workPackages.map(
        (wp) =>
          new ProjectTreeItem(
            wp.subject,
            vscode.TreeItemCollapsibleState.None,
            "workpackage",
            undefined,
            wp,
            element.parentProject
          )
      );
    }

    return [];
  }

  public async createWorkPackage(
    project: Project,
    data: {
      subject: string;
      description?: string;
    }
  ): Promise<void> {
    await openProjectClient.createWorkPackage({
      projectId: project.id,
      subject: data.subject,
      description: data.description,
    });

    this.refresh();
  }
}
