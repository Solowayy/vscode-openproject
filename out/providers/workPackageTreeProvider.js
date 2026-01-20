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
exports.ProjectTreeProvider = exports.ProjectTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("../api/apiClient");
class ProjectTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, itemType, project, workPackage, parentProject) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.itemType = itemType;
        this.project = project;
        this.workPackage = workPackage;
        this.parentProject = parentProject;
        if (itemType === "project") {
            this.contextValue = "project";
            this.iconPath = new vscode.ThemeIcon("folder-opened");
            this.tooltip = project?.description?.raw || project?.name;
        }
        else if (itemType === "workpackage") {
            this.contextValue = "workpackage";
            this.iconPath = new vscode.ThemeIcon("file");
            this.tooltip = `#${workPackage?.id} - ${workPackage?.subject}`;
            this.description = `#${workPackage?.id}`;
            this.command = {
                command: "openproject.openWorkPackage",
                title: "Open work package",
                arguments: [workPackage],
            };
        }
        else if (itemType === "folder") {
            this.iconPath = new vscode.ThemeIcon("folder");
            this.contextValue = "folder";
        }
        else if (itemType === "message") {
            this.iconPath = new vscode.ThemeIcon("info");
            this.contextValue = "message";
        }
    }
}
exports.ProjectTreeItem = ProjectTreeItem;
class ProjectTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.projects = [];
        this.workPackagesByProject = new Map();
        this.hierarchyCache = new Map();
    }
    async initialize() {
        await this.loadData();
    }
    refresh() {
        this.loadData().then(() => {
            this._onDidChangeTreeData.fire();
        });
    }
    async loadData() {
        try {
            if (!apiClient_1.apiClient.isConfigured()) {
                const initialized = await apiClient_1.apiClient.initialize();
                if (!initialized) {
                    return;
                }
            }
            this.projects = await apiClient_1.apiClient.getProjects();
            this.workPackagesByProject.clear();
            this.hierarchyCache.clear();
            for (const project of this.projects) {
                const workPackages = await apiClient_1.apiClient.getWorkPackages(project.id);
                this.workPackagesByProject.set(project.id, workPackages);
                this.buildHierarchy(project.id, workPackages);
            }
        }
        catch (error) {
            console.error("Loading data error:", error);
            vscode.window.showErrorMessage("Error loading data form OpenProject");
        }
    }
    buildHierarchy(projectId, workPackages) {
        const hierarchy = new Map();
        const byType = new Map();
        for (const wp of workPackages) {
            const typeHref = wp._links.type?.href || "unknown";
            const typeName = wp._links.type?.title || "Else";
            if (!byType.has(typeName)) {
                byType.set(typeName, []);
            }
            byType.get(typeName).push(wp);
        }
        this.hierarchyCache.set(projectId, byType);
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!apiClient_1.apiClient.isConfigured()) {
            return [
                new ProjectTreeItem("SetUp connection with OpenProject", vscode.TreeItemCollapsibleState.None, "message"),
            ];
        }
        if (!element) {
            if (this.projects.length === 0) {
                await this.loadData();
                if (this.projects.length === 0) {
                    return [
                        new ProjectTreeItem("Project is not found", vscode.TreeItemCollapsibleState.None, "message"),
                    ];
                }
            }
            return this.projects.map((project) => new ProjectTreeItem(project.name, vscode.TreeItemCollapsibleState.Collapsed, "project", project));
        }
        if (element.itemType === "project" && element.project) {
            const projectId = element.project.id;
            const hierarchy = this.hierarchyCache.get(projectId);
            if (!hierarchy || hierarchy.size === 0) {
                return [
                    new ProjectTreeItem("No work package", vscode.TreeItemCollapsibleState.None, "message"),
                ];
            }
            const folders = [];
            for (const [typeName, workPackages] of hierarchy.entries()) {
                folders.push(new ProjectTreeItem(`${typeName} (${workPackages.length})`, vscode.TreeItemCollapsibleState.Collapsed, "folder", undefined, undefined, element.project));
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
            return workPackages.map((wp) => new ProjectTreeItem(wp.subject, vscode.TreeItemCollapsibleState.None, "workpackage", undefined, wp, element.parentProject));
        }
        return [];
    }
    async createWorkPackage(project, data) {
        await apiClient_1.apiClient.createWorkPackage({
            projectId: project.id,
            subject: data.subject,
            description: data.description,
        });
        this.refresh();
    }
}
exports.ProjectTreeProvider = ProjectTreeProvider;
//# sourceMappingURL=workPackageTreeProvider.js.map