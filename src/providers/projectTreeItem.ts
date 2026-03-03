import * as vscode from "vscode";
import { WorkPackage, Project } from "../api/types";

export class ProjectTreeItem extends vscode.TreeItem {
  private constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: "project" | "workpackage" | "folder" | "message",
    public readonly project?: Project,
    public readonly workPackage?: WorkPackage,
    public readonly parentProject?: Project,
    public readonly allProjectWorkPackages: WorkPackage[] = [],
  ) {
    super(label, collapsibleState);
    this.setupUI();
  }

  static forProject(project: Project): ProjectTreeItem {
    return new ProjectTreeItem(
      project.name,
      vscode.TreeItemCollapsibleState.Collapsed,
      "project",
      project
    );
  }

  static forWorkPackage(
    workPackage: WorkPackage,
    allWorkPackages: WorkPackage[] = [],
    parentProject?: Project,
  ): ProjectTreeItem {
    const selfHref = workPackage._links.self.href;
    const hasChildren = allWorkPackages.some(
      (item) => item._links.parent?.href === selfHref,
    );

    return new ProjectTreeItem(
      workPackage.subject,
      hasChildren
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
      "workpackage",
      undefined,
      workPackage,
      parentProject,
      allWorkPackages,
    );
  }

  static forMessage(message: string) {
    return [
      new ProjectTreeItem(
        message,
        vscode.TreeItemCollapsibleState.None,
        "message",
      ),
    ];
  }

  private setupUI(): void {

    switch (this.itemType) {
      case "project":
        this.contextValue = "project";
        this.iconPath = new vscode.ThemeIcon("folder-opened");
        this.tooltip = this.project?.description?.raw || this.project?.name;
        break;

      case "workpackage":
        // Check if Summary Task (Type ID = 3)
        this.contextValue = this.workPackage?._links.type.href.endsWith("/3")
          ? "workpackage_summary"
          : "workpackage";
        this.iconPath = new vscode.ThemeIcon("file");
        this.tooltip = `#${this.workPackage?.id} - ${this.workPackage?.subject}`;
        this.description = `#${this.workPackage?.id}`;
        this.command = {
          command: "openproject.openWorkPackage",
          title: "Open work package",
          arguments: [this.workPackage],
        };
        break;

      case "folder":
        this.contextValue = "folder";
        this.iconPath = new vscode.ThemeIcon("folder");
        break;

      case "message":
        this.contextValue = "message";
        this.iconPath = new vscode.ThemeIcon("info");
        break;
    }
  }
}