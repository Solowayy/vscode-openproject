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
    label;
    collapsibleState;
    itemType;
    project;
    workPackage;
    parentProject;
    allProjectWorkPackages;
    constructor(label, collapsibleState, itemType, project, workPackage, parentProject, allProjectWorkPackages = []) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.itemType = itemType;
        this.project = project;
        this.workPackage = workPackage;
        this.parentProject = parentProject;
        this.allProjectWorkPackages = allProjectWorkPackages;
        if (itemType === 'project') {
            this.contextValue = 'project';
            this.iconPath = new vscode.ThemeIcon('folder-opened');
            this.tooltip = project?.description?.raw || project?.name;
        }
        else if (itemType === 'workpackage') {
            this.contextValue = 'workpackage';
            this.iconPath = new vscode.ThemeIcon('file');
            this.tooltip = `#${workPackage?.id} - ${workPackage?.subject}`;
            this.description = `#${workPackage?.id}`;
            this.command = {
                command: 'openproject.openWorkPackage',
                title: 'Відкрити робочий пакет',
                arguments: [workPackage]
            };
        }
        else if (itemType === 'folder') {
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'folder';
        }
        else if (itemType === 'message') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.contextValue = 'message';
        }
    }
}
exports.ProjectTreeItem = ProjectTreeItem;
class ProjectTreeProvider {
    // onDidChangeTreeData?: vscode.Event<ProjectTreeItem | null | undefined> | undefined;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    projects = [];
    wpCache = new Map();
    refresh() {
        this.wpCache.clear();
        this.loadData().then(() => this._onDidChangeTreeData.fire());
    }
    async loadData() {
        if (!apiClient_1.apiClient.isConfigured()) {
            await apiClient_1.apiClient.initialize();
        }
        this.projects = await apiClient_1.apiClient.getProjects();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!apiClient_1.apiClient.isConfigured())
            return [new ProjectTreeItem('Failed to connect', vscode.TreeItemCollapsibleState.None, 'message')];
        ;
        if (!element) {
            const topLevel = await apiClient_1.apiClient.getProjects();
            return topLevel.map(p => new ProjectTreeItem(p.name, vscode.TreeItemCollapsibleState.Collapsed, 'project', p));
        }
        if (element.itemType === 'project' && element.project) {
            const projectId = element.project.id;
            const [subProjects, workPackages] = await Promise.all([
                apiClient_1.apiClient.getProjects(projectId),
                apiClient_1.apiClient.getWorkPackages(projectId)
            ]);
            console.log(`Fetched ${workPackages.length} tasks for project ${projectId}`);
            const rootTasks = workPackages.filter(wp => {
                return !wp._links.parent || !wp._links.parent.href;
            });
            console.log(`Found ${rootTasks.length} root tasks`);
            return [
                ...subProjects.map(p => new ProjectTreeItem(p.name, vscode.TreeItemCollapsibleState.Collapsed, 'project', p)),
                ...rootTasks.map(wp => this.createWorkPackageItem(wp, element.project, workPackages))
            ];
        }
        if (element.itemType === 'workpackage' && element.workPackage) {
            const parentProject = element.parentProject;
            if (!parentProject)
                return [];
            const children = element.allProjectWorkPackages.filter(wp => {
                const parentHref = wp._links.parent?.href;
                const selfHref = element.workPackage?._links.self.href;
                return parentHref && selfHref && parentHref === selfHref;
            });
            return children.map(ch => this.createWorkPackageItem(ch, element.project, element.allProjectWorkPackages));
        }
        return [];
    }
    createWorkPackageItem(wp, parentProject, allWps) {
        const selfHref = wp._links.self.href;
        const hasChildren = allWps.some(item => item._links.parent?.href === selfHref);
        return new ProjectTreeItem(wp.subject, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, 'workpackage', undefined, wp, parentProject, allWps);
    }
}
exports.ProjectTreeProvider = ProjectTreeProvider;
//# sourceMappingURL=workPackageTreeProvider.js.map