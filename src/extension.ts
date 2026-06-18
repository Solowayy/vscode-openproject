import * as vscode from "vscode";
import { ProjectTreeProvider } from "./providers/projectTreeProvider";
import { ProjectTreeItem } from "./providers/projectTreeItem";
import { apiClient } from "./api/apiClient";
import { WorkPackage, Project } from "./api/types";
import { WorkPackageWebviewManager } from "./views/workPackageWebview";
import { gitLabClient } from "./api/gitlabClient";
import { gitHubClient } from "./api/githubClient";
import { PrMonitorService } from "./services/prMonitorService";
// import { MrMonitorService } from "./services/mrMonitorService";


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

    // Unified PR / Mr Monitor
    const prMonitor = new PrMonitorService(context, [gitLabClient, gitHubClient]);
    context.subscriptions.push(prMonitor);

    context.subscriptions.push(
        vscode.commands.registerCommand("openproject.configureGitLab", async () => {
            const url = await vscode.window.showInputBox({
                prompt: "Enter your GitLab URL",
                placeHolder: "https://gitlab.com",
                value: vscode.workspace.getConfiguration("openproject").get("gitlab.url"),
                validateInput: (v) => {
                    if (!v) return "URL cannot be empty";
                    if (!v.startsWith("http")) return "URL must start with http or https";
                    return null;
                },
            });
            if (!url) return;

            const token = await vscode.window.showInputBox({
                prompt: "Enter your GitLab Personal Access Token",
                password: true,
                value: vscode.workspace.getConfiguration("openproject").get("gitlab.token"),
                validateInput: (v) => (!v ? "Token cannot be empty" : null),
            });
            if (!token) return;
            
            const projectIdStr = await vscode.window.showInputBox({
                prompt: "Enter GitLab Project ID (numeric)",
                placeHolder: "e.g. 12345",
                value: vscode.workspace.getConfiguration("openproject").get<number>("gitlab.projectId")?.toString(),
                validateInput: (v) => {
                    if (!v) return "Project ID cannot be empty";
                    if (isNaN(Number(v))) return "Must be a number";
                    return null;
                },
            });
            if (!projectIdStr) return;

            const cfg = vscode.workspace.getConfiguration("openproject");
            await cfg.update("gitlab.url", url, vscode.ConfigurationTarget.Global);
            await cfg.update("gitlab.token", token, vscode.ConfigurationTarget.Global);
            await cfg.update("gitlab.projectId", Number(projectIdStr), vscode.ConfigurationTarget.Global);

            const ok = await gitLabClient.initialize();
            if (ok) {
                vscode.window.showInformationMessage("OpentProject: GitLab configured successfully!");
                prMonitor.start();
            } else {
                vscode.window.showErrorMessage("OpentProject: OpentProject: Failed to connect to GitLab");
            }
        }),

        vscode.commands.registerCommand("openproject.configureGitHub", async () => {
            // get token, owner, repo for user and save as in gitlab
            const token = await vscode.window.showInputBox({
                prompt: "Enter your GitHub Personal Access Token",
                password: true,
                value: vscode.workspace.getConfiguration("openproject").get("github.token"),
                validateInput: (v) => (!v ? "Token cannot be empty" : null),
            });
            if (!token) return;
            
            const url = await vscode.window.showInputBox({
                prompt: "Enter your repo URL",
                placeHolder: "https://github.com/owner/repo-name",
                value: vscode.workspace.getConfiguration("openproject").get("github.repo"),
                validateInput: (v) => (!v ? "Repo URL cannot be empty" : null),
            });
            if(!url) return;
        
            const repo = getRepoFromUrl(url);
            const owner = getOwnerFormURL(url);
            if(!owner) return;

            const cfg = vscode.workspace.getConfiguration("openproject");
            await cfg.update("github.repo", owner, vscode.ConfigurationTarget.Global);
            await cfg.update("github.token", token, vscode.ConfigurationTarget.Global);
            await cfg.update("github.owner", repo, vscode.ConfigurationTarget.Global);

            const ok = await gitHubClient.initialize();
            if (ok) {
                vscode.window.showInformationMessage("OpentProject: GitHub configured successfully!");
                prMonitor.start();
            } else {
                vscode.window.showErrorMessage("OpentProject: Failed to connect to GitHub");
            }
        }),

        vscode.commands.registerCommand("openproject.prMonitor.pollNow", () => prMonitor.pollNow()),

        vscode.commands.registerCommand("openproject.prMonitor.stop", () => {
            prMonitor.stop();
            vscode.window.showInformationMessage("OpentProject: PR monitor stopped");
        }),

        vscode.commands.registerCommand("openproject.prMonitor.start", () => {
            prMonitor.start();
            vscode.window.showInformationMessage("OpentProject: PR monitor started");
        }),
    );

    // Auto-start monitor if already configured
    Promise.allSettled([
        gitHubClient.initialize(),
        gitLabClient.initialize(),
    ]).then(() => { prMonitor.start(); });

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
    dueDate?: string | null;
    startDate?: string | null;
}

// Commands

// Prompts the user for URL and API key, saves config, and initializes the client
async function configureCommand(treeProvider: ProjectTreeProvider): Promise<void> {

    const url = await promptUrl();
    if (!url) return;

    const apiKey = await promptApiKey();
    if (!apiKey) return;

    // const gitlabURL = await promptGitLabUrl();
    // if(!gitlabURL) return;

    // const gitlabToken = await promptGitLabToken();
    // if(!gitlabToken) return;

    // await saveConfiguration(url, apiKey, gitlabURL, gitlabToken);
    await saveConfiguration(url, apiKey);

    const success = await apiClient.initialize();
    if (success) {
        vscode.window.showInformationMessage("OpenProject configured successfully!");
        treeProvider.refresh();
    } else {
        vscode.window.showErrorMessage("OpentProject: Failed to connect to OpenProject");
    }

}

// Refreshes the tree view
function refreshCommand(treeProvider: ProjectTreeProvider): void {

    vscode.window.showInformationMessage("OpentProject: Refreshing data...");
    treeProvider.refresh();

}

// Opens a work package in a webview panel
async function openWorkPackageCommand(context: vscode.ExtensionContext, workPackage: WorkPackage): Promise<void> {

    const fullWorkPackage = await apiClient.getWorkPackage(workPackage.id);

    if (!fullWorkPackage) {
        vscode.window.showErrorMessage("OpentProject: Failed to load work package");
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
    let startDate: string | undefined;
    let dueDate: string | undefined;

    if (options.typeName.toLowerCase() === "milestone") {
        const date = await promptDueDate();
        if (date === undefined) return;
        startDate = date || undefined;
        dueDate = date || undefined;
    } else {
        const start = await promptStartDate();
        if (start === undefined) return;
        startDate = start || undefined;

        const due = await promptDueDate(startDate);
        if (due === undefined) return;
        dueDate = due || undefined;
    }

    const created = await apiClient.createWorkPackage({
        projectId: project.id,
        type: options.typeId.toString(),
        status: options.statusId.toString(),
        priority: options.priorityId.toString(),
        subject: subject.trim(),
        description: description?.trim(),
        assignee: assignee ? { id: assignee.id, href: assignee.href } : undefined,
        startDate: startDate,
        dueDate: dueDate,
    });

    if (created) {
        vscode.window.showInformationMessage(`OpentProject: Work package "${subject}" created!`);
        treeProvider.refresh();
    } else {
        vscode.window.showErrorMessage("OpentProject: Failed to create work package");
    }

}

// Creates a child work package under an existing one
async function createChildWorkPackageCommand(treeProvider: ProjectTreeProvider, treeItem?: ProjectTreeItem): Promise<void> {

    if (!treeItem?.workPackage) {
        vscode.window.showErrorMessage("OpentProject: Please select a parent task first");
        return;
    }

    const parentWorkPackage = treeItem.workPackage;
    const project = treeItem.parentProject ?? treeItem.project;

    if (!project) {
        vscode.window.showErrorMessage("OpentProject: Could not determine project context");
        return;
    }

    const options = await fetchWorkPackageOptions(project.id);
    if (!options) return;

    const subject = await promptSubject(`Sub-task title... (Parent: #${parentWorkPackage.id})`);
    if (!subject) return;

    const description = await promptDescription();
    const assignee = await pickAssignee();
    let startDate: string | undefined;
    let dueDate: string | undefined;

    if (options.typeName.toLowerCase() === "milestone") {
        const date = await promptDueDate();
        if (date === undefined) return;
        startDate = date || undefined;
        dueDate = date || undefined;
    } else {
        const start = await promptStartDate();
        if (start === undefined) return;
        startDate = start || undefined;

        const due = await promptDueDate(startDate);
        if (due === undefined) return;
        dueDate = due || undefined;
    }

    const created = await apiClient.createWorkPackage({
        projectId: project.id,
        type: options.typeId.toString(),
        status: options.statusId.toString(),
        priority: options.priorityId.toString(),
        subject: subject.trim(),
        description: description?.trim(),
        assignee: assignee ? { id: assignee.id, href: assignee.href } : undefined,
        parentId: parentWorkPackage.id,
        startDate: startDate,
        dueDate: dueDate,
    });

    if (created) {
        vscode.window.showInformationMessage(`OpentProject: Child task "${subject}" created under #${parentWorkPackage.id}`);
        treeProvider.refresh();
    } else {
        vscode.window.showErrorMessage("OpentProject: Failed to create child work package");
    }
}

// Updates an existing work package with new data
async function updateWorkPackageCommand(
    treeProvider: ProjectTreeProvider,
    workPackageId: number,
    updateData: WorkPackageUpdateData,
): Promise<boolean> {

    if (!workPackageId) {
        vscode.window.showErrorMessage("OpentProject: Work package ID is required");
        return false;
    }

    const success = await apiClient.updateWorkPackage(workPackageId, updateData);

    if (success) {
        vscode.window.showInformationMessage(`OpentProject: Work package #${workPackageId} updated successfully!`);
        treeProvider.refresh();
        return true;
    } else {
        vscode.window.showErrorMessage(`OpentProject: Failed to update work package #${workPackageId}`);
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
        vscode.window.showWarningMessage("OpentProject: No projects available");
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

// Helpers

// Parse gitHub repo URL and gets owner name
function getOwnerFormURL(url : string) : string | null{
    try {
        const parsedURL = new URL(url);
        const pathParts = parsedURL.pathname.split('/').filter(Boolean);
        
        if(pathParts.length > 0){
            return pathParts[0];
        }
        
        return null;
    } catch(error) {
        console.error("Failed to parse GitHub url for owner", error);
        return null;
    }
}

// Parse gitHub repo URL and gets repo name
function getRepoFromUrl(url : string) : string | null{
    try {
        const parsedURL = new URL(url);
        const pathParts = parsedURL.pathname.split('/').filter(Boolean);
        
        if(pathParts.length >= 1){
            return pathParts[1];
        }
        
        return null;
    } catch(error) {
        console.error("Failed to parse GitHub url for repo", error);
        return null;
    }
}

// Prompts user to select a project from the list
async function pickProject(): Promise<Project | undefined> {

    const projects = await apiClient.getProjects();

    if (projects.length === 0) {
        vscode.window.showWarningMessage("OpentProject: No projects available");
        return undefined;
    }

    const selected = await vscode.window.showQuickPick(
        projects.map((p) => ({ label: p.name, description: p.identifier, project: p })),
        { placeHolder: "Select a project" },
    );

    return selected?.project;

}

// Fetches type/status/priority options and prompts the user to select each
async function fetchWorkPackageOptions(projectId: number): Promise<{ typeId: number; typeName: string; statusId: number; priorityId: number } | undefined> {

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
        typeName: selectedType.label,
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

// Date block

// Parse input from user
function parseDateInput(v: string | undefined): string | null {
    if (!v) return null;
    v = v.trim();
    if (v.toLowerCase() === 't' || v.toLowerCase() === 'today') {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    
    const euMatch = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (euMatch) {
        const dd = euMatch[1].padStart(2, '0');
        const mm = euMatch[2].padStart(2, '0');
        const yyyy = euMatch[3];
        return `${yyyy}-${mm}-${dd}`;
    }

    const isoMatch = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        const yyyy = isoMatch[1];
        const mm = isoMatch[2].padStart(2, '0');
        const dd = isoMatch[3].padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    return null;
}


function formatToEuropean(yyyyMMdd: string): string {
    const match = yyyyMMdd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        return `${match[3]}.${match[2]}.${match[1]}`;
    }
    return yyyyMMdd;
}

// Prompts user to enter an optional start date
async function promptStartDate(): Promise<string | null | undefined> {
    const value = await vscode.window.showInputBox({
        prompt: "Enter start date (DD.MM.YYYY or YYYY-MM-DD). Leave empty for none. Type 'T' or 'today' for today.",
        placeHolder: "e.g. 20.05.2026, T, or today",
        validateInput: (v) => {
            if (!v) return null;
            if (!parseDateInput(v)) return "Must be in DD.MM.YYYY or YYYY-MM-DD format, 'T', or 'today'";
            return null;
        }
    });
    
    if (value === undefined) return undefined; // Escaped
    if (value.trim() === "") return null; // Skipped
    
    return parseDateInput(value);
}

// Prompts user to enter an optional deadline
async function promptDueDate(startDate?: string | null): Promise<string | null | undefined> {
    const value = await vscode.window.showInputBox({
        prompt: "Enter deadline (DD.MM.YYYY or YYYY-MM-DD). Leave empty for none. Type 'T' or 'today' for today.",
        placeHolder: "e.g. 31.12.2026, T, or today",
        validateInput: (v) => {
            if (!v) return null;
            
            const parsed = parseDateInput(v);
            if (!parsed) return "Must be in DD.MM.YYYY or YYYY-MM-DD format, 'T', or 'today'";

            if (startDate && parsed < startDate) {
                return `Deadline cannot be before start date (${formatToEuropean(startDate)})`;
            }

            return null;
        }
    });
    
    if (value === undefined) return undefined; // Escaped
    if (value.trim() === "") return null; // Skipped

    return parseDateInput(value);
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
        prompt: "Enter your OpenProject API Key",
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
