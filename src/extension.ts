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

            // 2. Fetch available options dynamically
            const types = await apiClient.getTypes(project.id);
            const statuses = await apiClient.getStatuses();
            const priorities = await apiClient.getPriorities();

            // 3. Determine the Type, Status, Priority
            const selectedType = await vscode.window.showQuickPick(
                types.map(t => ({ label: t.name, id: t.id })),
                { placeHolder: "Select a type" },
            );
            if (!selectedType) return;

            const selectedStatus = await vscode.window.showQuickPick(
                statuses.map(s => ({ label: s.name, id: s.id })),
                { placeHolder: "Select a status" },
            );
            if (!selectedStatus) return;

            const selectedPriority = await vscode.window.showQuickPick(
                priorities.map(p => ({ label: p.name, id: p.id })),
                { placeHolder: "Select a priority" },
            );
            if (!selectedPriority) return;

            const typeId = selectedType.id;
            const statusId = selectedStatus.id;
            const priorityId = selectedPriority.id;

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

            // 1. Fetch Options Dynamically
            const types = await apiClient.getTypes(project.id);
            const statuses = await apiClient.getStatuses();
            const priorities = await apiClient.getPriorities();

            // 2. Select Type, Status, Priority
            const selectedType = await vscode.window.showQuickPick(
                types.map(t => ({ label: t.name, id: t.id })),
                { placeHolder: "Select a type" },
            );
            if (!selectedType) return;

            const selectedStatus = await vscode.window.showQuickPick(
                statuses.map(s => ({ label: s.name, id: s.id })),
                { placeHolder: "Select a status" },
            );
            if (!selectedStatus) return;

            const selectedPriority = await vscode.window.showQuickPick(
                priorities.map(p => ({ label: p.name, id: p.id })),
                { placeHolder: "Select a priority" },
            );
            if (!selectedPriority) return;

            const typeId = selectedType.id;
            const statusId = selectedStatus.id;
            const priorityId = selectedPriority.id;

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

    const filterWorkPackagesCommand = vscode.commands.registerCommand(
        "openproject.filterWorkPackage",
        async () => {
            const selection = await vscode.window.showQuickPick([
                { label: "$(list-ordered) Filter by ID", detail: "id", description: "Filter by work package number" },
                { label: "$(list-flat) Filter by Type", detail: "type", description: "Filter by work package type" },
                { label: "$(text-size) Filter by Text", detail: "text", description: "Filter by subject text" },
                { label: "$(close) Standard", detail: "none", description: "Clear filters" }
            ], {
                placeHolder: "Select filter type"
            });

            if (!selection) {
                return;
            }

            if (selection.detail === "none") {
                projectTreeProvider.setFilter("none");
                return;
            }

            let value: string | undefined;

            if (selection.detail === "type") {
                // Try to fetch types from the first available project to show options
                try {
                    const projects = await apiClient.getProjects();
                    if (projects.length > 0) {
                        const types = await apiClient.getTypes(projects[0].id);
                        const sortedTypes = types.map(t => ({ label: t.name })).sort((a, b) => a.label.localeCompare(b.label));
                        const selectedType = await vscode.window.showQuickPick(sortedTypes, {
                            placeHolder: "Select Work Package Type"
                        });
                        value = selectedType?.label;
                    }
                } catch (error) {
                    console.error("Failed to fetch types for filter", error);
                }

                // Fallback if no projects or error
                if (!value) {
                    if (!value && (!apiClient.isConfigured())) {
                        value = await vscode.window.showInputBox({ prompt: "Enter type name" });
                    }
                }
            } else {
                value = await vscode.window.showInputBox({
                    prompt: selection.detail === "id" ? "Enter Work Package ID" : "Enter text to search",
                    placeHolder: selection.detail === "id" ? "e.g. 1234" : "search term..."
                });
            }

            if (value) {
                projectTreeProvider.setFilter(selection.detail as "id" | "type" | "text", value);
            }
        }
    );
    // Register all commands
    context.subscriptions.push(
        configureCommand,
        refreshCommand,
        //debugIdsCommand,
        openWorkPackageCommand,
        createWorkPackageCommand,
        updateWorkPackageCommand,
        filterWorkPackagesCommand,
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
