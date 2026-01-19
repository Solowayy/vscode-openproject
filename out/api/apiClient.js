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
    client;
    config = null;
    constructor() {
        this.client = axios_1.default.create({
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
    async initialize() {
        const config = vscode.workspace.getConfiguration('openproject');
        const url = config.get('url');
        const apiKey = config.get('apiKey');
        if (!url || !apiKey) {
            vscode.window.showErrorMessage('URL or API key fail');
            return false;
        }
        this.config = { url, apiKey };
        this.client.defaults.baseURL = url;
        this.client.defaults.headers.common['Authorization'] = `Basic ${Buffer.from(`apikey:${apiKey}`).toString('base64')}`;
        return await this.testConnection();
    }
    async testConnection() {
        try {
            await this.client.get('/api/v3');
            return true;
        }
        catch (exception) {
            vscode.window.showErrorMessage('Connection failed');
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
                filters.push({ "parent": { "operator": "=", "values": [parentProjectId.toString()] } });
            }
            else {
                filters.push({ "parent": { "operator": "!*", "values": [] } });
            }
            const url = `/api/v3/projects?filters=${encodeURIComponent(JSON.stringify(filters))}`;
            const response = await this.client.get(url);
            return response.data._embedded.elements;
        }
        catch (exception) {
            console.error('Status:', exception.response?.status);
            console.error('Body:', JSON.stringify(exception.response?.data));
            return [];
        }
    }
    async getWorkPackages(projectId) {
        try {
            const filters = JSON.stringify([
                { "project": { "operator": "=", "values": [projectId.toString()] } }
            ]);
            const url = `/api/v3/work_packages?pageSize=500&filters=${encodeURIComponent(filters)}`;
            const response = await this.client.get(url);
            return response.data._embedded.elements;
        }
        catch (exception) {
            console.error('Failed to read packages');
            console.error('Status:', exception.response?.status);
            console.error('Body:', JSON.stringify(exception.response?.data));
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
}
exports.ApiClient = ApiClient;
exports.apiClient = new ApiClient();
//# sourceMappingURL=apiClient.js.map