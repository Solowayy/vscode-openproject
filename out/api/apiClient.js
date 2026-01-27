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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = exports.ApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
class ApiClient {
    constructor() {
        this.config = null;
        this.client = axios_1.default.create({
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
    async initialize() {
        const config = vscode.workspace.getConfiguration("openproject");
        const url = config.get("url");
        const apiKey = config.get("apiKey");
        if (!url || !apiKey) {
            vscode.window.showErrorMessage("URL or API key fail");
            return false;
        }
        this.config = { url, apiKey };
        this.client.defaults.baseURL = url;
        this.client.defaults.headers.common["Authorization"] =
            `Basic ${Buffer.from(`apikey:${apiKey}`).toString("base64")}`;
        return await this.testConnection();
    }
    async testConnection() {
        try {
            await this.client.get("/api/v3");
            return true;
        }
        catch (exception) {
            vscode.window.showErrorMessage("Connection failed");
            return false;
        }
    }
    isConfigured() {
        return this.config !== null;
    }
    async getProjects(parentProjectId) {
        try {
            let filters = [];
            if (parentProjectId) {
                filters.push({
                    parent: { operator: "=", values: [parentProjectId.toString()] },
                });
            }
            else {
                filters.push({ parent: { operator: "!*", values: [] } });
            }
            const url = `/api/v3/projects?filters=${encodeURIComponent(JSON.stringify(filters))}`;
            const response = await this.client.get(url);
            return response.data._embedded.elements;
        }
        catch (exception) {
            console.error("Status:", exception.response?.status);
            console.error("Body:", JSON.stringify(exception.response?.data));
            return [];
        }
    }
    async getWorkPackages(projectId) {
        try {
            const filters = JSON.stringify([
                { project: { operator: "=", values: [projectId.toString()] } },
            ]);
            const url = `/api/v3/work_packages?pageSize=500&filters=${encodeURIComponent(filters)}`;
            const response = await this.client.get(url);
            return response.data._embedded.elements;
        }
        catch (exception) {
            console.error("Failed to read packages");
            console.error("Status:", exception.response?.status);
            console.error("Body:", JSON.stringify(exception.response?.data));
            return [];
        }
    }
    async getWorkPackage(id) {
        try {
            const response = await this.client.get(`api/v3/work_packages/${id}`);
            return response.data;
        }
        catch (exception) {
            return null;
        }
    }
    // Methods to get available types, statuses, and priorities
    // Types: Task=1, Milestone=2, Summary task=3, Feature=4, Epic=5, User story=6, Bug=7
    async getTypes(projectId) {
        try {
            const url = projectId ? `/api/v3/projects/${projectId}/types` : '/api/v3/types';
            const response = await this.client.get(url);
            const types = response.data._embedded?.elements || [];
            return types.map((type) => ({
                id: type.id,
                name: type.name,
                href: type._links.self.href
            }));
        }
        catch (exception) {
            console.error('Failed to fetch types:', exception.message);
            return [];
        }
    }
    // Statuses: New=1, In specification=2, Specified=3, Confirmed=4, To be scheduled=5, Scheduled=6, In progress=7, Developed=8, In testing=9, Tested=10, Test failed=11, Closed=12, On hold=13, Rejected=14
    async getStatuses() {
        try {
            const response = await this.client.get('/api/v3/statuses');
            const statuses = response.data._embedded?.elements || [];
            return statuses.map((status) => ({
                id: status.id,
                name: status.name,
                href: status._links.self.href
            }));
        }
        catch (exception) {
            console.error('Failed to fetch statuses:', exception.message);
            return [];
        }
    }
    // Priorities: Low=7, Normal=8, High=9, Immediate=10
    async getPriorities() {
        try {
            const response = await this.client.get('/api/v3/priorities');
            const priorities = response.data._embedded?.elements || [];
            return priorities.map((priority) => ({
                id: priority.id,
                name: priority.name,
                href: priority._links.self.href
            }));
        }
        catch (exception) {
            console.error('Failed to fetch priorities:', exception.message);
            return [];
        }
    }
    async getUsers() {
        try {
            const response = await this.client.get('/api/v3/users');
            const users = response.data._embedded?.elements || [];
            return users.map((user) => ({
                id: user.id,
                name: user.name,
                href: user._links.self.href
            }));
        }
        catch (exception) {
            console.error('Failed to fetch users:', exception.message);
            return [];
        }
    }
    async createWorkPackage(data) {
        try {
            const payload = {
                subject: data.subject,
                _links: {
                    project: {
                        href: `/api/v3/projects/${data.projectId}`,
                    },
                },
            };
            // Add description if provided
            if (data.description) {
                payload.description = {
                    format: "markdown",
                    raw: data.description,
                };
            }
            // Add type, status, priority links
            payload._links.type = {
                href: `/api/v3/types/${data.type}`,
            };
            payload._links.status = {
                href: `/api/v3/statuses/${data.status}`,
            };
            payload._links.priority = {
                href: `/api/v3/priorities/${data.priority}`,
            };
            // Add assignee link if provided
            if (data.assignee) {
                payload._links.assignee = {
                    href: data.assignee.href
                };
            }
            // Add parent link if provided
            if (data.parentId) {
                payload._links.parent = {
                    href: `/api/v3/work_packages/${data.parentId}`
                };
            }
            console.log("Creating work package with payload:", JSON.stringify(payload, null, 2));
            const response = await this.client.post("/api/v3/work_packages", payload);
            if (response.status === 201) {
                return true;
            }
            return false;
        }
        catch (exception) {
            console.error("Failed to create work package");
            console.error("Status:", exception.response?.status);
            console.error("Response data:", JSON.stringify(exception.response?.data, null, 2));
            // Extract detailed error messages
            let errorMessage = "Failed to create work package";
            if (exception.response?.data) {
                const apiError = exception.response.data;
                if (apiError.message) {
                    errorMessage = apiError.message;
                }
                if (apiError._embedded?.errors) {
                    const errors = apiError._embedded.errors;
                    const errorDetails = errors.map((err) => `${err.message || ''} (${err._type || ''})`).join(', ');
                    errorMessage += `: ${errorDetails}`;
                }
            }
            vscode.window.showErrorMessage(errorMessage);
            return false;
        }
    }
    async updateWorkPackage(workPackageId, data) {
        try {
            // Fetch the current work package to get lockVersion
            const currentWP = await this.getWorkPackage(workPackageId);
            if (!currentWP) {
                vscode.window.showErrorMessage(`Work package #${workPackageId} not found`);
                return false;
            }
            // Validate lockVersion exists
            const lockVersion = currentWP.lockVersion;
            if (lockVersion === undefined || lockVersion === null) {
                console.error("Work package data:", JSON.stringify(currentWP, null, 2));
                vscode.window.showErrorMessage(`Work package #${workPackageId} does not have a lockVersion. This might be a data issue.`);
                return false;
            }
            // Build the payload with only the fields that are being updated
            const payload = {
                lockVersion: lockVersion,
            };
            if (data.subject !== undefined) {
                payload.subject = data.subject;
            }
            if (data.description !== undefined) {
                payload.description = {
                    format: "markdown",
                    raw: data.description,
                };
            }
            // Add _links for status, type, priority if provided and not empty
            const hasLinks = (data.statusId && data.statusId.trim() !== '') ||
                (data.typeId && data.typeId.trim() !== '') ||
                (data.priorityId && data.priorityId.trim() !== '');
            if (hasLinks) {
                payload._links = {};
                if (data.statusId && data.statusId.trim() !== '') {
                    payload._links.status = {
                        href: `/api/v3/statuses/${data.statusId}`,
                    };
                }
                if (data.typeId && data.typeId.trim() !== '') {
                    payload._links.type = {
                        href: `/api/v3/types/${data.typeId}`,
                    };
                }
                if (data.priorityId && data.priorityId.trim() !== '') {
                    payload._links.priority = {
                        href: `/api/v3/priorities/${data.priorityId}`,
                    };
                }
            }
            // Log payload for debugging
            console.log("Updating work package with payload:", JSON.stringify(payload, null, 2));
            console.log("LockVersion:", lockVersion);
            const response = await this.client.patch(`/api/v3/work_packages/${workPackageId}`, payload);
            if (response.status === 200) {
                return true;
            }
            return false;
        }
        catch (exception) {
            console.error("Failed to update work package");
            console.error("Status:", exception.response?.status);
            console.error("Response data:", JSON.stringify(exception.response?.data, null, 2));
            // Extract detailed error messages
            let errorMessage = "Failed to update work package";
            if (exception.response?.data) {
                const apiError = exception.response.data;
                if (apiError.message) {
                    errorMessage = apiError.message;
                }
                if (apiError._embedded?.errors) {
                    const errors = apiError._embedded.errors;
                    const errorDetails = errors.map((err) => `${err.message || ''} (${err._type || ''})`).join(', ');
                    errorMessage += `: ${errorDetails}`;
                }
            }
            vscode.window.showErrorMessage(errorMessage);
            return false;
        }
    }
}
exports.ApiClient = ApiClient;
exports.apiClient = new ApiClient();
//# sourceMappingURL=apiClient.js.map