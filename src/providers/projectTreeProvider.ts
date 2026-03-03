import * as vscode from "vscode";
import { apiClient } from "../api/apiClient";
import { WorkPackage, Project } from "../api/types";
import { ProjectTreeItem } from "./projectTreeItem";

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ProjectTreeItem | undefined | null> = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private wpCache: Map<number, WorkPackage[]> = new Map();

  private filterType: 'id' | 'type' | 'text' | 'none' = 'none';
  private filterValue: string = '';

  // Public API

  refresh(): void {
    this.wpCache.clear();
    this.ensureApiInitialized().then(() => this._onDidChangeTreeData.fire(null));
  }

  setFilter(type: 'id' | 'type' | 'text' | 'none', value: string = ''): void {
    this.filterType = type;
    this.filterValue = value;
    this.refresh();
  }

  getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProjectTreeItem): Promise<ProjectTreeItem[]> {
    if (!apiClient.isConfigured()) {
      return ProjectTreeItem.forMessage("Failed to connect");
    }

    if (!element) {
      return this.getTopLevelItems();
    }

    if (element.itemType === "project" && element.project) {
      return this.getProjectChildren(element.project);
    }

    if (element.itemType === "workpackage" && element.workPackage) {
      return this.getWorkPackageChildren(element);
    }

    return [];
  }

  // Tree Building

  // Returns root-level projects
  private async getTopLevelItems(): Promise<ProjectTreeItem[]> {
    const projects = await apiClient.getProjects();
    return projects.map((p) => ProjectTreeItem.forProject(p));
  }

  // Returns sub-projects and work packages for a given project
  private async getProjectChildren(project: Project): Promise<ProjectTreeItem[]> {
    const [subProjects, allWorkPackages] = await Promise.all([
      apiClient.getProjects(project.id),
      apiClient.getWorkPackages(project.id),
    ]);

    console.log(`Fetched ${allWorkPackages.length} work packages for project ${project.id}`);

    const workPackagesToShow = this.filterType !== 'none'
      ? this.filterWorkPackages(allWorkPackages)
      : this.getRootWorkPackages(allWorkPackages);

    console.log(`Showing ${workPackagesToShow.length} work packages`);

    return this.buildProjectChildrenItems(subProjects, workPackagesToShow, project, allWorkPackages);
  }

  // Returns direct children of a work package item
  private getWorkPackageChildren(element: ProjectTreeItem): ProjectTreeItem[] {
    if (!element.workPackage || !element.parentProject) {
      return [];
    }

    const selfHref = element.workPackage._links.self.href;
    const children = element.allProjectWorkPackages.filter((wp) =>
      wp._links.parent?.href === selfHref,
    );

    return children.map((ch) =>
      ProjectTreeItem.forWorkPackage(ch, element.allProjectWorkPackages, element.parentProject),
    );
  }

  // Filtering

  // Filters work packages based on the current filter type and value
  private filterWorkPackages(workPackages: WorkPackage[]): WorkPackage[] {
    const val = this.filterValue.toLowerCase();

    return workPackages.filter((wp) => {
      switch (this.filterType) {
        case 'id': return wp.id.toString() === val;
        case 'type': return wp._links.type.title?.toLowerCase() === val;
        case 'text': return wp.subject.toLowerCase().includes(val) || wp.id.toString() === val;
        default: return true;
      }
    });
  }

  // Returns only work packages that have no parent (root level)
  private getRootWorkPackages(workPackages: WorkPackage[]): WorkPackage[] {
    return workPackages.filter((wp) => !wp._links.parent?.href);
  }

  // Helpers

  // Combines sub-project items and work package items into one list
  private buildProjectChildrenItems(
    subProjects: Project[],
    workPackagesToShow: WorkPackage[],
    parentProject: Project,
    allWorkPackages: WorkPackage[],
  ): ProjectTreeItem[] {
    return [
      ...subProjects.map((p) => ProjectTreeItem.forProject(p)),
      ...workPackagesToShow.map((wp) =>
        ProjectTreeItem.forWorkPackage(wp, allWorkPackages, parentProject),
      ),
    ];
  }

  // Ensures the API client is initialized before use
  private async ensureApiInitialized(): Promise<void> {
    if (!apiClient.isConfigured()) {
      await apiClient.initialize();
    }
  }
}
