"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const workPackageTreeProvider_1 = require("./providers/workPackageTreeProvider");
const apiClient_1 = require("./api/apiClient");
const workPackageWebview_1 = require("./views/workPackageWebview");
async function activate(context) {
    console.log("OpenProject extension activated");
    const projectTreeProvider = new workPackageTreeProvider_1.ProjectTreeProvider();
    const treeView = vscode.window.createTreeView("openproject.projectsView", {
        treeDataProvider: projectTreeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);
    // Connection config
    const configureCommand = vscode.commands.registerCommand("openproject.configure", async () => {
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
        const success = await apiClient_1.apiClient.initialize();
        if (success) {
            vscode.window.showInformationMessage("✅ OpenProject configured successfully!");
            projectTreeProvider.refresh();
        }
        else {
            vscode.window.showErrorMessage("❌ Failed to connect to OpenProject");
        }
    });
    // Refresh Tree
    const refreshCommand = vscode.commands.registerCommand("openproject.refresh", () => {
        vscode.window.showInformationMessage("🔄 Refreshing data...");
        projectTreeProvider.refresh();
    });
    // Debug command to show actual IDs
    const debugIdsCommand = vscode.commands.registerCommand("openproject.debugIds", async () => {
        const types = await apiClient_1.apiClient.getTypes();
        const statuses = await apiClient_1.apiClient.getStatuses();
        const priorities = await apiClient_1.apiClient.getPriorities();
        console.log("=== TYPES ===");
        types.forEach(t => console.log(`${t.name}: ID = ${t.id}`));
        console.log("=== STATUSES ===");
        statuses.forEach(s => console.log(`${s.name}: ID = ${s.id}`));
        console.log("=== PRIORITIES ===");
        priorities.forEach(p => console.log(`${p.name}: ID = ${p.id}`));
        vscode.window.showInformationMessage(`Check console for IDs. Types: ${types.length}, Statuses: ${statuses.length}, Priorities: ${priorities.length}`);
    });
    // Open Work Package
    const openWorkPackageCommand = vscode.commands.registerCommand("openproject.openWorkPackage", async (workPackage) => {
        const fullWorkPackage = await apiClient_1.apiClient.getWorkPackage(workPackage.id);
        if (!fullWorkPackage) {
            vscode.window.showErrorMessage("Failed to load work package");
            return;
        }
        workPackageWebview_1.WorkPackageWebviewManager.createOrShow(context.extensionUri, fullWorkPackage);
    });
    const createWorkPackageCommand = vscode.commands.registerCommand("openproject.createWorkPackage", async (treeItem) => {
        let project = treeItem?.project;
        // 1. Determine the Project
        if (!project) {
            const projects = await apiClient_1.apiClient.getProjects();
            if (projects.length === 0) {
                vscode.window.showWarningMessage("No projects available");
                return;
            }
            const selectedProject = await vscode.window.showQuickPick(projects.map((p) => ({
                label: p.name,
                description: p.identifier,
                project: p,
            })), { placeHolder: "Select a project" });
            if (!selectedProject) {
                return; // User cancelled
            }
            project = selectedProject.project;
        }
        // 2. Fetch available options dynamically
        const types = await apiClient_1.apiClient.getTypes(project.id);
        const statuses = await apiClient_1.apiClient.getStatuses();
        const priorities = await apiClient_1.apiClient.getPriorities();
        // 3. Determine the Type, Status, Priority
        const selectedType = await vscode.window.showQuickPick(types.map(t => ({ label: t.name, id: t.id })), { placeHolder: "Select a type" });
        if (!selectedType)
            return;
        const selectedStatus = await vscode.window.showQuickPick(statuses.map(s => ({ label: s.name, id: s.id })), { placeHolder: "Select a status" });
        if (!selectedStatus)
            return;
        const selectedPriority = await vscode.window.showQuickPick(priorities.map(p => ({ label: p.name, id: p.id })), { placeHolder: "Select a priority" });
        if (!selectedPriority)
            return;
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
        const users = await apiClient_1.apiClient.getUsers();
        // Allow user to select assignee or skip
        const selectedAssignee = await vscode.window.showQuickPick([
            { label: "$(circle-slash) Unassigned", user: undefined },
            ...users.map(u => ({ label: `$(account) ${u.name}`, user: u }))
        ], { placeHolder: "Select Assignee (Optional)" });
        // 6. Call API
        const created = await apiClient_1.apiClient.createWorkPackage({
            projectId: project.id,
            type: typeId.toString(),
            status: statusId.toString(),
            priority: priorityId.toString(),
            subject: subject.trim(),
            description: description?.trim(),
            assignee: selectedAssignee?.user ? { id: selectedAssignee.user.id, href: selectedAssignee.user.href } : undefined,
        });
        if (created) {
            vscode.window.showInformationMessage(`✅ Work package "${subject}" created!`);
            projectTreeProvider.refresh();
        }
        else {
            vscode.window.showErrorMessage("❌ Failed to create work package");
        }
    });
    const createChildWorkPackageCommand = vscode.commands.registerCommand("openproject.createChildWorkPackage", async (treeItem) => {
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
        const types = await apiClient_1.apiClient.getTypes(project.id);
        const statuses = await apiClient_1.apiClient.getStatuses();
        const priorities = await apiClient_1.apiClient.getPriorities();
        // 2. Select Type, Status, Priority
        const selectedType = await vscode.window.showQuickPick(types.map(t => ({ label: t.name, id: t.id })), { placeHolder: "Select a type" });
        if (!selectedType)
            return;
        const selectedStatus = await vscode.window.showQuickPick(statuses.map(s => ({ label: s.name, id: s.id })), { placeHolder: "Select a status" });
        if (!selectedStatus)
            return;
        const selectedPriority = await vscode.window.showQuickPick(priorities.map(p => ({ label: p.name, id: p.id })), { placeHolder: "Select a priority" });
        if (!selectedPriority)
            return;
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
        if (!subject)
            return;
        // 3. Get Description
        const description = await vscode.window.showInputBox({
            prompt: "Enter description (optional)",
            placeHolder: "Task description...",
        });
        // 4. Get Assignee
        const users = await apiClient_1.apiClient.getUsers();
        const selectedAssignee = await vscode.window.showQuickPick([
            { label: "$(circle-slash) Unassigned", user: undefined },
            ...users.map(u => ({ label: `$(account) ${u.name}`, user: u }))
        ], { placeHolder: "Select Assignee (Optional)" });
        // 5. Call API with parentId
        const created = await apiClient_1.apiClient.createWorkPackage({
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
            vscode.window.showInformationMessage(`✅ Child task "${subject}" created under #${parentWorkPackage.id}!`);
            projectTreeProvider.refresh();
        }
        else {
            vscode.window.showErrorMessage("❌ Failed to create child work package");
        }
    });
    const updateWorkPackageCommand = vscode.commands.registerCommand("openproject.updateWorkPackage", async (workPackageId, updateData) => {
        if (!workPackageId) {
            vscode.window.showErrorMessage("Work package ID is required");
            return;
        }
        // Call API to update work package
        const success = await apiClient_1.apiClient.updateWorkPackage(workPackageId, updateData);
        if (success) {
            vscode.window.showInformationMessage(`✅ Work package #${workPackageId} updated successfully!`);
            // Refresh tree view to show updated data
            projectTreeProvider.refresh();
            return true;
        }
        else {
            vscode.window.showErrorMessage(`❌ Failed to update work package #${workPackageId}`);
            return false;
        }
    });
    // Register all commands
    context.subscriptions.push(configureCommand, refreshCommand, 
    //debugIdsCommand,
    openWorkPackageCommand, createWorkPackageCommand, updateWorkPackageCommand);
    const config = vscode.workspace.getConfiguration("openproject");
    if (config.get("url") && config.get("apiKey")) {
        apiClient_1.apiClient.initialize().then((success) => {
            if (success) {
                projectTreeProvider.refresh();
            }
        });
    }
}
function deactivate() {
    console.log("OpenProject extension deactivated");
}
//# sourceMappingURL=extension.js.map