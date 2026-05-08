import 'module-alias/register';
import * as vscode from "vscode";
import { ProjectTreeProvider } from "./providers/projectTreeProvider";
import { ProjectTreeItem } from "./providers/projectTreeItem";
import { apiClient } from "./api/apiClient";
import { WorkPackage, Project } from "./api/types";
import { WorkPackageWebviewManager } from "./views/workPackageWebview";
import { GitLabClient, gitLabClient } from "./api/gitlabClient";
import { MrMonitorService } from "./services/mrMonitorService";

// Entry Point

export async function activate(context: vscode.ExtensionContext) {

    console.log("OpenProject extension activated");

    const treeProvider = new ProjectTreeProvider();

    const treeView = vscode.window.createTreeView("openproject.projectsView", {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });

    context.subscriptions.push(treeView);

    context.subscriptions.push(
        vscode.commands.registerCommand("openproject.configure", () => configureCommand(treeProvider)),
        vscode.commands.registerCommand("openproject.refresh", () => refreshCommand(treeProvider)),
        vscode.commands.registerCommand("openproject.openWorkPackage", (wp: WorkPackage) => openWorkPackageCommand(context, wp)),
        vscode.commands.registerCommand("openproject.createWorkPackage", (item?: ProjectTreeItem) => createWorkPackageCommand(treeProvider, item)),
        vscode.commands.registerCommand("openproject.createChildWorkPackage", (item?: ProjectTreeItem) => createChildWorkPackageCommand(treeProvider, item)),
        vscode.commands.registerCommand("openproject.updateWorkPackage", (id: number, data: WorkPackageUpdateData) => updateWorkPackageCommand(treeProvider, id, data)),
        vscode.commands.registerCommand("openproject.filterWorkPackage", () => filterWorkPackagesCommand(treeProvider)),
        vscode.commands.registerCommand("openproject.selectVisibleProjects", () => selectVisibleProjectsCommand(treeProvider)),
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("openproject.visibleProjects")) {
                treeProvider.refresh();
            }
        })
    );

    autoInitializeIfConfigured(treeProvider);

}

export function deactivate() {
    console.log("OpenProject extension deactivated");
}

// Types 

interface WorkPackageUpdateData {
    subject?: string;
    description?: string;
    statusId?: string;
    typeId?: string;
    priorityId?: string;
}

// Commands

// Prompts the user for URL and API key, saves config, and initializes the client
async function configureCommand(treeProvider: ProjectTreeProvider): Promise<void> {

    const url = await promptUrl();
    if (!url) return;

    const apiKey = await promptApiKey();
    if (!apiKey) return;

    await saveConfiguration(url, apiKey);

    const success = await apiClient.initialize();
    if (success) {
        vscode.window.showInformationMessage("OpenProject configured successfully!");
        treeProvider.refresh();
    } else {
        vscode.window.showErrorMessage("Failed to connect to OpenProject");
    }

}

// Refreshes the tree view
function refreshCommand(treeProvider: ProjectTreeProvider): void {

    vscode.window.showInformationMessage("Refreshing data...");
    treeProvider.refresh();

}

// Opens a work package in a webview panel
async function openWorkPackageCommand(context: vscode.ExtensionContext, workPackage: WorkPackage): Promise<void> {

    const fullWorkPackage = await apiClient.getWorkPackage(workPackage.id);

    if (!fullWorkPackage) {
        vscode.window.showErrorMessage("Failed to load work package");
        return;
    }

    WorkPackageWebviewManager.createOrShow(context.extensionUri, fullWorkPackage);

}

// Creates a new top-level work package. Prompts for project if not provided by tree item
async function createWorkPackageCommand(treeProvider: ProjectTreeProvider, treeItem?: ProjectTreeItem): Promise<void> {

    const project = treeItem?.project ?? await pickProject();
    if (!project) return;

    const options = await fetchWorkPackageOptions(project.id);
    if (!options) return;

    const subject = await promptSubject("Task title...");
    if (!subject) return;

    const description = await promptDescription();
    const assignee = await pickAssignee();

    const created = await apiClient.createWorkPackage({
        projectId: project.id,
        type: options.typeId.toString(),
        status: options.statusId.toString(),
        priority: options.priorityId.toString(),
        subject: subject.trim(),
        description: description?.trim(),
        assignee: assignee ? { id: assignee.id, href: assignee.href } : undefined,
    });

    if (created) {
        vscode.window.showInformationMessage(`Work package "${subject}" created!`);
        treeProvider.refresh();
    } else {
        vscode.window.showErrorMessage("Failed to create work package");
    }

}

// Creates a child work package under an existing one
async function createChildWorkPackageCommand(treeProvider: ProjectTreeProvider, treeItem?: ProjectTreeItem): Promise<void> {

    if (!treeItem?.workPackage) {
        vscode.window.showErrorMessage("Please select a parent task first");
        return;
    }

    const parentWorkPackage = treeItem.workPackage;
    const project = treeItem.parentProject ?? treeItem.project;

    if (!project) {
        vscode.window.showErrorMessage("Could not determine project context");
        return;
    }

    const options = await fetchWorkPackageOptions(project.id);
    if (!options) return;

    const subject = await promptSubject(`Sub-task title... (Parent: #${parentWorkPackage.id})`);
    if (!subject) return;

    const description = await promptDescription();
    const assignee = await pickAssignee();

    const created = await apiClient.createWorkPackage({
        projectId: project.id,
        type: options.typeId.toString(),
        status: options.statusId.toString(),
        priority: options.priorityId.toString(),
        subject: subject.trim(),
        description: description?.trim(),
        assignee: assignee ? { id: assignee.id, href: assignee.href } : undefined,
        parentId: parentWorkPackage.id,
    });

    if (created) {
        vscode.window.showInformationMessage(`Child task "${subject}" created under #${parentWorkPackage.id}`);
        treeProvider.refresh();
    } else {
        vscode.window.showErrorMessage("Failed to create child work package");
    }
}

// Updates an existing work package with new data
async function updateWorkPackageCommand(
    treeProvider: ProjectTreeProvider,
    workPackageId: number,
    updateData: WorkPackageUpdateData,
): Promise<boolean> {

    if (!workPackageId) {
        vscode.window.showErrorMessage("Work package ID is required");
        return false;
    }

    const success = await apiClient.updateWorkPackage(workPackageId, updateData);

    if (success) {
        vscode.window.showInformationMessage(`Work package #${workPackageId} updated successfully!`);
        treeProvider.refresh();
        return true;
    } else {
        vscode.window.showErrorMessage(`Failed to update work package #${workPackageId}`);
        return false;
    }

}

// Shows a filter picker and applies the selected filter to the tree view
async function filterWorkPackagesCommand(treeProvider: ProjectTreeProvider): Promise<void> {

    const filterOptions = [
        { label: "$(list-ordered) Filter by ID", detail: "id", description: "Filter by work package number" },
        { label: "$(list-flat) Filter by Type", detail: "type", description: "Filter by work package type" },
        { label: "$(text-size) Filter by Text", detail: "text", description: "Filter by subject text" },
        { label: "$(close) Standard", detail: "none", description: "Clear filters" },
    ];

    const selection = await vscode.window.showQuickPick(filterOptions, {
        placeHolder: "Select filter type",
    });

    if (!selection) return;

    if (selection.detail === "none") {
        treeProvider.setFilter("none");
        return;
    }

    const value = await resolveFilterValue(selection.detail);
    if (value) {
        treeProvider.setFilter(selection.detail as "id" | "type" | "text", value);
    }

}

// Shows a quick pick to select which projects should be visible
async function selectVisibleProjectsCommand(treeProvider: ProjectTreeProvider): Promise<void> {

    const projects = await apiClient.getProjects();

    if (projects.length === 0) {
        vscode.window.showWarningMessage("No projects available");
        return;
    }

    const config = vscode.workspace.getConfiguration("openproject");
    const currentVisible = config.get<string[]>("visibleProjects") || [];

    const items: vscode.QuickPickItem[] = projects.map((p) => ({
        label: p.name,
        description: `ID: ${p.id}`,
        picked: currentVisible.length === 0 || currentVisible.includes(p.name) || currentVisible.includes(p.id.toString())
    }));

    const selectedItems = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: "Select projects to display (leave empty or select all to show all)",
    });

    if (selectedItems) {
        const selectedNames = selectedItems.map((item) => item.label);
        const newConfigValue = selectedNames.length === projects.length ? [] : selectedNames;

        await config.update("visibleProjects", newConfigValue, vscode.ConfigurationTarget.Global);
    }

}

// UI Helpers

// Prompts user to select a project from the list
async function pickProject(): Promise<Project | undefined> {

    const projects = await apiClient.getProjects();

    if (projects.length === 0) {
        vscode.window.showWarningMessage("No projects available");
        return undefined;
    }

    const selected = await vscode.window.showQuickPick(
        projects.map((p) => ({ label: p.name, description: p.identifier, project: p })),
        { placeHolder: "Select a project" },
    );

    return selected?.project;

}

// Fetches type/status/priority options and prompts the user to select each
async function fetchWorkPackageOptions(projectId: number): Promise<{ typeId: number; statusId: number; priorityId: number } | undefined> {

    const [types, statuses, priorities] = await Promise.all([
        apiClient.getTypes(projectId),
        apiClient.getStatuses(),
        apiClient.getPriorities(),
    ]);

    const selectedType = await vscode.window.showQuickPick(
        types.map(t => ({ label: t.name, id: t.id })),
        { placeHolder: "Select a type" },
    );
    if (!selectedType) return undefined;

    const selectedStatus = await vscode.window.showQuickPick(
        statuses.map(s => ({ label: s.name, id: s.id })),
        { placeHolder: "Select a status" },
    );
    if (!selectedStatus) return undefined;

    const selectedPriority = await vscode.window.showQuickPick(
        priorities.map(p => ({ label: p.name, id: p.id })),
        { placeHolder: "Select a priority" },
    );
    if (!selectedPriority) return undefined;

    return {
        typeId: selectedType.id,
        statusId: selectedStatus.id,
        priorityId: selectedPriority.id,
    };

}

// Prompts user to pick or skip an assignee. Returns the selected user or undefined
async function pickAssignee(): Promise<{ id: number; href: string } | undefined> {

    const users = await apiClient.getUsers();

    const selected = await vscode.window.showQuickPick(
        [
            { label: "$(circle-slash) Unassigned", user: undefined },
            ...users.map(u => ({ label: `$(account) ${u.name}`, user: u })),
        ],
        { placeHolder: "Select Assignee (Optional)" },
    );

    return selected?.user ? { id: selected.user.id, href: selected.user.href } : undefined;

}

// Prompts user to enter a subject line for a work package
async function promptSubject(placeholder: string): Promise<string | undefined> {

    return vscode.window.showInputBox({
        prompt: "Enter work package subject",
        placeHolder: placeholder,
        validateInput: (value) =>
            (!value || value.trim().length === 0) ? "Subject cannot be empty" : null,
    });

}

// Prompts user to enter an optional description
async function promptDescription(): Promise<string | undefined> {

    return vscode.window.showInputBox({
        prompt: "Enter description (optional)",
        placeHolder: "Task description...",
    });

}

// Prompts user to enter the OpenProject server URL
async function promptUrl(): Promise<string | undefined> {

    return vscode.window.showInputBox({
        prompt: "Enter your OpenProject URL",
        placeHolder: "https://your-openproject.com",
        value: vscode.workspace.getConfiguration("openproject").get("url"),
        validateInput: (value) => {
            if (!value) return "URL cannot be empty";
            if (!value.startsWith("http")) return "URL must start with http or https";
            return null;
        },
    });

}

// Prompts user to enter their API key
async function promptApiKey(): Promise<string | undefined> {

    return vscode.window.showInputBox({
        prompt: "Enter your API Key",
        password: true,
        value: vscode.workspace.getConfiguration("openproject").get("apiKey"),
        validateInput: (value) => (!value ? "API Key cannot be empty" : null),
    });

}

// Resolves the filter value based on filter type (shows type picker or input box)
async function resolveFilterValue(filterType: string): Promise<string | undefined> {

    if (filterType === "type") {
        return pickTypeFilterValue();
    }

    return vscode.window.showInputBox({
        prompt: filterType === "id" ? "Enter Work Package ID" : "Enter text to search",
        placeHolder: filterType === "id" ? "e.g. 1234" : "search term...",
    });

}

// Fetches available types and lets the user pick one as a filter value
async function pickTypeFilterValue(): Promise<string | undefined> {

    try {
        const projects = await apiClient.getProjects();
        if (projects.length > 0) {
            const types = await apiClient.getTypes(projects[0].id);
            const sortedTypes = types
                .map(t => ({ label: t.name }))
                .sort((a, b) => a.label.localeCompare(b.label));

            const selected = await vscode.window.showQuickPick(sortedTypes, {
                placeHolder: "Select Work Package Type",
            });
            return selected?.label;
        }
    } catch (error) {
        console.error("Failed to fetch types for filter", error);
    }

    // Fallback to manual input
    return vscode.window.showInputBox({ prompt: "Enter type name" });

}

// Initialization

// Auto-initializes the API client if credentials are already saved
function autoInitializeIfConfigured(treeProvider: ProjectTreeProvider): void {
    );

    // GitLab monitor
    const mrMonitor = new MrMonitorService(context);
    context.subscriptions.push(mrMonitor);

    //TODO initialize GitLab Monitor
    const configureGitLabCommand = vscode.commands.registerCommand(
        "openproject.configureGitLab",
        async () => {
            const url = await vscode.window.showInputBox({
            })
        }
    );

    const pollNowCommand = vscode.commands.registerCommand(
        "openproject.mrMonitor.pollNow",
        () => mrMonitor.pollNow(),
    )

    const stopMonitorCommand = vscode.commands.registerCommand(
        "openproject.mrMonitor.stop",
        () => { mrMonitor.stop(); vscode.window.showInformationMessage("MR monitor stopped");},
    );

    const startMonitorCommand = vscode.commands.registerCommand(
        "openproject.mrMonitor.start",
        () => { mrMonitor.start(); vscode.window.showInformationMessage("MR monitor started");},
    )

    context.subscriptions.push(
        configureGitLabCommand,
        pollNowCommand,
        stopMonitorCommand,
        startMonitorCommand,
    );

    gitLabClient.initialize().then(ok => {
        if(ok) { mrMonitor.start(); }
    });

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
                treeProvider.refresh();
            }
        });
    }

}

// Persists the URL and API key to VS Code global settings
async function saveConfiguration(url: string, apiKey: string): Promise<void> {

    const config = vscode.workspace.getConfiguration("openproject");
    await config.update("url", url, vscode.ConfigurationTarget.Global);
    await config.update("apiKey", apiKey, vscode.ConfigurationTarget.Global);

}
