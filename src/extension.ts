import * as vscode from "vscode";
import {
  ProjectTreeProvider,
  ProjectTreeItem,
} from "./providers/workPackageTreeProvider";
import { apiClient } from "./api/apiClient";
import { WorkPackage, Project } from "./api/types";
import { WorkPackageWebviewManager } from "./views/workPackageWebview";

export async function activate(context: vscode.ExtensionContext) {
  console.log("OpenProject extension activated");
  const projectTreeProvider = new ProjectTreeProvider();

  const treeView = vscode.window.createTreeView("openproject.projectsView", {
    treeDataProvider: projectTreeProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  // Connection config
  const configureCommand = vscode.commands.registerCommand(
    "openproject.configure",
    async () => {
      const url = await vscode.window.showInputBox({
        prompt: "Enter your OpenProject URL",
        placeHolder: "https://your-openproject.com",
        value: vscode.workspace.getConfiguration("openproject").get("url"),
        validateInput: (value) => {
          if (!value) {
            return "URL cannot be empty";
          }
          if (!value.startsWith("http")) {
            return "URL must start with http or https";
          }
          return null;
        },
      });

      if (!url) {
        return;
      }

      const apiKey = await vscode.window.showInputBox({
        prompt: "Enter your API Key",
        password: true,
        value: vscode.workspace.getConfiguration("openproject").get("apiKey"),
        validateInput: (value) => {
          if (!value) {
            return "API Key cannot be empty";
          }
          return null;
        },
      });

      if (!apiKey) {
        return;
      }

      // Save config
      const config = vscode.workspace.getConfiguration("openproject");
      await config.update("url", url, vscode.ConfigurationTarget.Global);
      await config.update("apiKey", apiKey, vscode.ConfigurationTarget.Global);

      // Init client
      const success = await apiClient.initialize();
      if (success) {
        vscode.window.showInformationMessage(
          "✅ OpenProject configured successfully!",
        );
        projectTreeProvider.refresh();
      } else {
        vscode.window.showErrorMessage("❌ Failed to connect to OpenProject");
      }
    },
  );

  // Refresh Tree
  const refreshCommand = vscode.commands.registerCommand(
    "openproject.refresh",
    () => {
      vscode.window.showInformationMessage("🔄 Refreshing data...");
      projectTreeProvider.refresh();
    },
  );

  // Open Work Package
  const openWorkPackageCommand = vscode.commands.registerCommand(
    "openproject.openWorkPackage",
    async (workPackage: WorkPackage) => {
      const fullWorkPackage = await apiClient.getWorkPackage(workPackage.id);

      if (!fullWorkPackage) {
        vscode.window.showErrorMessage("Failed to load work package");
        return;
      }
      WorkPackageWebviewManager.createOrShow(
        context.extensionUri,
        fullWorkPackage,
      );
    },
  );

  const createWorkPackageCommand = vscode.commands.registerCommand(
    "openproject.createWorkPackage",
    async (treeItem?: ProjectTreeItem) => {
      let project: Project | undefined = treeItem?.project;

      // 1. Determine the Project
      if (!project) {
        const projects = await apiClient.getProjects();

        if (projects.length === 0) {
          vscode.window.showWarningMessage("No projects available");
          return;
        }

        const selectedProject = await vscode.window.showQuickPick(
          projects.map((p) => ({
            label: p.name,
            description: p.identifier,
            project: p,
          })),
          { placeHolder: "Select a project" },
        );

        if (!selectedProject) {
          return; // User cancelled
        }

        project = selectedProject.project;
      }

      // 2. Determine the Type, Status, Priority
      // TODO: make mathod to get list of Type, Status, Priority
      const type = await vscode.window.showQuickPick(
        ["Task", "Milestone", "Summary task"],
        { placeHolder: "Select a type" },
      );
      const status = await vscode.window.showQuickPick(
        [
          "New",
          "To be scheduled",
          "Scheduled",
          "In Progress",
          "Closed",
          "On hold",
          "Rejected",
        ],
        { placeHolder: "Select a status" },
      );
      const priority = await vscode.window.showQuickPick(
        ["Low", "Normal", "High", "Immediate"],
        { placeHolder: "Select a priority" },
      );
      if (!type || !status || !priority) {
        return;
      }

      // 3. Get Subject
      const subject = await vscode.window.showInputBox({
        prompt: "Enter work package subject",
        placeHolder: "Task title...",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "Subject cannot be empty";
          }
          return null;
        },
      });

      if (!subject) {
        return;
      }

      // 4. Get Description (Optional)
      const description = await vscode.window.showInputBox({
        prompt: "Enter description (optional)",
        placeHolder: "Task description...",
      });

      // 5. Call API
      const created = await apiClient.createWorkPackage({
        projectId: project.id,
        type: type,
        status: status,
        priority: priority,
        subject: subject.trim(),
        description: description?.trim(),
      });

      // 6. Feedback & Refresh
      if (created) {
        vscode.window.showInformationMessage(
          `✅ Work package "${subject}" created!`,
        );
        projectTreeProvider.refresh();
      } else {
        vscode.window.showErrorMessage("❌ Failed to create work package");
      }
    },
  );

  const updateWorkPackageCommand = vscode.commands.registerCommand(
    "openproject.updateWorkPackage",
    async (
      workPackageId: number,
      updateData: {
        subject?: string;
        description?: string;
        statusId?: string;
        typeId?: string;
        priorityId?: string;
      },
    ) => {
      if (!workPackageId) {
        vscode.window.showErrorMessage("Work package ID is required");
        return;
      }

      // Call API to update work package
      const success = await apiClient.updateWorkPackage(
        workPackageId,
        updateData,
      );

      if (success) {
        vscode.window.showInformationMessage(
          `✅ Work package #${workPackageId} updated successfully!`,
        );
        // Refresh tree view to show updated data
        projectTreeProvider.refresh();
        return true;
      } else {
        vscode.window.showErrorMessage(
          `❌ Failed to update work package #${workPackageId}`,
        );
        return false;
      }
    },
  );
  // Register all commands
  context.subscriptions.push(
    configureCommand,
    refreshCommand,
    openWorkPackageCommand,
    createWorkPackageCommand,
    updateWorkPackageCommand,
  );

  const config = vscode.workspace.getConfiguration("openproject");
  if (config.get("url") && config.get("apiKey")) {
    apiClient.initialize().then((success) => {
      if (success) {
        projectTreeProvider.refresh();
      }
    });
  }
}

export function deactivate() {
  console.log("OpenProject extension deactivated");
}
