import * as vscode from 'vscode';
import { ProjectTreeProvider, ProjectTreeItem } from './providers/workPackageTreeProvider';
import { apiClient } from './api/apiClient';
import { WorkPackage, Project } from './api/types';
import { WorkPackageWebviewManager } from './views/workPackageWebview';

export async function activate(context: vscode.ExtensionContext) {
    console.log("OpenProject extension activated");

    const projectTreeProvider = new ProjectTreeProvider();

    const treeView = vscode.window.createTreeView("openproject.projectsView", {
        treeDataProvider: projectTreeProvider,
        showCollapseAll: true,
    });

    context.subscriptions.push(treeView);
    context.subscriptions.push(treeView);

    await projectTreeProvider.initialize();

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
                    "✅ OpenProject configured successfully!"
                );
                projectTreeProvider.refresh();
            } else {
                vscode.window.showErrorMessage("❌ Failed to connect to OpenProject");
            }
        }
    );

    // Refresh tree
    const refreshCommand = vscode.commands.registerCommand(
        "openproject.refresh",
        () => {
            vscode.window.showInformationMessage("🔄 Refreshing data...");
            projectTreeProvider.refresh();
        }
    );

    // Open work package
    const openWorkPackageCommand = vscode.commands.registerCommand(
        "openproject.openWorkPackage",
        async (workPackage: WorkPackage) => {
            const fullWorkPackage = await apiClient.getWorkPackage(
                workPackage.id
            );

            if (!fullWorkPackage) {
                vscode.window.showErrorMessage("Failed to load work package");
                return;
            }

            WorkPackageWebviewManager.createOrShow(
                context.extensionUri,
                fullWorkPackage
            );
        }
    );

    const createWorkPackageCommand = vscode.commands.registerCommand(
        "openproject.createWorkPackage",
        async (treeItem?: ProjectTreeItem) => {
            let project: Project | undefined = treeItem?.project;
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
                    { placeHolder: "Select a project" }
                );

                if (!selectedProject) {
                    return;
                }

                project = selectedProject.project;
            }

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

            const description = await vscode.window.showInputBox({
                prompt: "Enter description (optional)",
                placeHolder: "Task description...",
            });

            // Create work package
            const created = await apiClient.createWorkPackage({
                projectId: project.id,
                subject: subject.trim(),
                description: description?.trim(),
            });

            if (created) {
                vscode.window.showInformationMessage(
                    `✅ Work package "${subject}" created!`
                );
                projectTreeProvider.refresh();
            } else {
                vscode.window.showErrorMessage("❌ Failed to create work package");
            }
        }
    );

    context.subscriptions.push(
        configureCommand,
        refreshCommand,
        openWorkPackageCommand,
        createWorkPackageCommand
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
