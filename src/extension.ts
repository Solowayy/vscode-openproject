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

    // Debug command to show actual IDs
    const debugIdsCommand = vscode.commands.registerCommand(
        "openproject.debugIds",
        async () => {
            const types = await apiClient.getTypes();
            const statuses = await apiClient.getStatuses();
            const priorities = await apiClient.getPriorities();

            console.log("=== TYPES ===");
            types.forEach(t => console.log(`${t.name}: ID = ${t.id}`));

            console.log("=== STATUSES ===");
            statuses.forEach(s => console.log(`${s.name}: ID = ${s.id}`));

            console.log("=== PRIORITIES ===");
            priorities.forEach(p => console.log(`${p.name}: ID = ${p.id}`));

            vscode.window.showInformationMessage(
                `Check console for IDs. Types: ${types.length}, Statuses: ${statuses.length}, Priorities: ${priorities.length}`
            );
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

    function convertToId(converted: string, category: 'type' | 'status' | 'priority'): number {
        if (category === 'type') {
            if (converted === "Task") return 1;
            if (converted === "Milestone") return 2;
            if (converted === "Summary task") return 3;
        }

        if (category === 'status') {
            if (converted === "New") return 1;
            if (converted === "To be scheduled") return 5;
            if (converted === "Scheduled") return 6;
            if (converted === "In Progress") return 7;
            if (converted === "Closed") return 12;
            if (converted === "On hold") return 13;
            if (converted === "Rejected") return 14;
        }

        if (category === 'priority') {
            if (converted === "Low") return 7;
            if (converted === "Normal") return 8;
            if (converted === "High") return 9;
            if (converted === "Immediate") return 10;
        }

        return -1;
    }
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
            const typeInput = await vscode.window.showQuickPick(
                ["Task", "Milestone", "Summary task"],
                { placeHolder: "Select a type" },
            );

            const statusInput = await vscode.window.showQuickPick(
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

            const priorityInput = await vscode.window.showQuickPick(
                ["Low", "Normal", "High", "Immediate"],
                { placeHolder: "Select a priority" },
            );

            if (!typeInput || !statusInput || !priorityInput) {
                return;
            }

            // Convert names to IDs
            const typeId = convertToId(typeInput, 'type');
            const statusId = convertToId(statusInput, 'status');
            const priorityId = convertToId(priorityInput, 'priority');

            if (typeId === -1 || statusId === -1 || priorityId === -1) {
                vscode.window.showErrorMessage('Invalid type, status, or priority selected');
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

            // 5. Get Assignee
            const users = await apiClient.getUsers();

            // Allow user to select assignee or skip
            const selectedAssignee = await vscode.window.showQuickPick(
                [
                    { label: "$(circle-slash) Unassigned", user: undefined },
                    ...users.map(u => ({ label: `$(account) ${u.name}`, user: u }))
                ],
                { placeHolder: "Select Assignee (Optional)" }
            );

            // 6. Call API
            const created = await apiClient.createWorkPackage({
                projectId: project.id,
                type: typeId.toString(),
                status: statusId.toString(),
                priority: priorityId.toString(),
                subject: subject.trim(),
                description: description?.trim(),
                assignee: selectedAssignee?.user ? { id: selectedAssignee.user.id, href: selectedAssignee.user.href } : undefined,
            });

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

    const createChildWorkPackageCommand = vscode.commands.registerCommand(
        "openproject.createChildWorkPackage",
        async (treeItem?: ProjectTreeItem) => {
            if (!treeItem || !treeItem.workPackage) {
                vscode.window.showErrorMessage("Please select a parent task first");
                return;
            }

            const parentWorkPackage = treeItem.workPackage;
            // Project should be in parentProject for workpackage items
            const project = treeItem.parentProject || treeItem.project;

            if (!project) {
                vscode.window.showErrorMessage("Could not determine project context");
                return;
            }

            // 1. Determine Type, Status, Priority (Same as createWorkPackage)
            const typeInput = await vscode.window.showQuickPick(
                ["Task", "Milestone", "Summary task"],
                { placeHolder: "Select a type" },
            );

            const statusInput = await vscode.window.showQuickPick(
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

            const priorityInput = await vscode.window.showQuickPick(
                ["Low", "Normal", "High", "Immediate"],
                { placeHolder: "Select a priority" },
            );

            if (!typeInput || !statusInput || !priorityInput) {
                return;
            }

            const typeId = convertToId(typeInput, 'type');
            const statusId = convertToId(statusInput, 'status');
            const priorityId = convertToId(priorityInput, 'priority');

            if (typeId === -1 || statusId === -1 || priorityId === -1) {
                vscode.window.showErrorMessage('Invalid type, status, or priority selected');
                return;
            }

            // 2. Get Subject
            const subject = await vscode.window.showInputBox({
                prompt: `Enter sub-task subject (Parent: #${parentWorkPackage.id})`,
                placeHolder: "Sub-task title...",
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return "Subject cannot be empty";
                    }
                    return null;
                },
            });

            if (!subject) return;

            // 3. Get Description
            const description = await vscode.window.showInputBox({
                prompt: "Enter description (optional)",
                placeHolder: "Task description...",
            });

            // 4. Get Assignee
            const users = await apiClient.getUsers();

            const selectedAssignee = await vscode.window.showQuickPick(
                [
                    { label: "$(circle-slash) Unassigned", user: undefined },
                    ...users.map(u => ({ label: `$(account) ${u.name}`, user: u }))
                ],
                { placeHolder: "Select Assignee (Optional)" }
            );

            // 5. Call API with parentId
            const created = await apiClient.createWorkPackage({
                projectId: project.id,
                type: typeId.toString(),
                status: statusId.toString(),
                priority: priorityId.toString(),
                subject: subject.trim(),
                description: description?.trim(),
                assignee: selectedAssignee?.user ? { id: selectedAssignee.user.id, href: selectedAssignee.user.href } : undefined,
                parentId: parentWorkPackage.id
            });

            if (created) {
                vscode.window.showInformationMessage(
                    `✅ Child task "${subject}" created under #${parentWorkPackage.id}!`,
                );
                projectTreeProvider.refresh();
            } else {
                vscode.window.showErrorMessage("❌ Failed to create child work package");
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
        //debugIdsCommand,
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
