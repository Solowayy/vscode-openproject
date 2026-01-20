import axios from "axios";
import * as vscode from 'vscode';
import {
    OpenProjectConfig,
    CollectionResponse,
    HALLink,
    HALLinks,
    Project,
    WorkPackage
} from './types'

export class ApiClient {
    private client: Axios.AxiosInstance;
    private config: OpenProjectConfig | null = null;

    constructor() {
        this.client = axios.create({
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    public async initialize(): Promise<boolean> {
        const config = vscode.workspace.getConfiguration('openproject');
        const url = config.get<string>('url');
        const apiKey = config.get<string>('apiKey');

        if (!url || !apiKey) {
            vscode.window.showErrorMessage('URL or API key fail');
            return false;
        }

        this.config = { url, apiKey };
        this.client.defaults.baseURL = url;
        this.client.defaults.headers.common['Authorization'] = `Basic ${Buffer.from(`apikey:${apiKey}`).toString('base64')}`;

        return await this.testConnection();
    }

    public async testConnection(): Promise<boolean> {
        try {
            await this.client.get('/api/v3');
            return true;
        } catch (exception) {
            vscode.window.showErrorMessage('Connection failed');
            return false;
        }
    }

    public isConfigured(): boolean {
        return this.config !== null;
    }

    public async getProjects(parentProjectId?: number): Promise<Project[]> {
        try {
            let filters: any[] = [];

            if (parentProjectId) {
                filters.push({ "parent": { "operator": "=", "values": [parentProjectId.toString()] } });
            } else {
                filters.push({ "parent": { "operator": "!*", "values": [] } });
            }

            const url = `/api/v3/projects?filters=${encodeURIComponent(JSON.stringify(filters))}`;

            const response = await this.client.get<CollectionResponse<Project>>(url);
            return response.data._embedded.elements;
        } catch (exception: any) {
            console.error('Status:', exception.response?.status);
            console.error('Body:', JSON.stringify(exception.response?.data));
            return [];
        }
    }

    public async getWorkPackages(projectId: number): Promise<WorkPackage[]> {
        try {
            const filters = JSON.stringify([
                { "project": { "operator": "=", "values": [projectId.toString()] } }
            ]);

            const url = `/api/v3/work_packages?pageSize=500&filters=${encodeURIComponent(filters)}`;

            const response = await this.client.get<CollectionResponse<WorkPackage>>(url);

            return response.data._embedded.elements;
        } catch (exception: any) {
            console.error('Failed to read packages');
            console.error('Status:', exception.response?.status);
            console.error('Body:', JSON.stringify(exception.response?.data));
            return [];
        }
    }

    public async getWorkPackage(id: number): Promise<WorkPackage | null> {
        try {
            const response = await this.client.get<WorkPackage>(`api/v3/work_packages/${id}`);
            return response.data;
        } catch (exception) {
            return null;
        }
    }

    public async createWorkPackage(data: {
        projectId: number;
        type: string;
        status: string;
        priority: string;
        subject: string;
        description?: string;
    }): Promise<boolean> {
        // TODO:
        vscode.window.showInformationMessage('Work package created' + data.subject);
        return true;
    }

    public async updateWorkPackage(
        workPackageId: number,
        data: {
            subject?: string;
            description?: string;
            statusId?: string;
            typeId?: string;
            priorityId?: string;
        }
    ): Promise<boolean> {
        // TODO: Implement PATCH request to /api/v3/work_packages/{id}
        vscode.window.showInformationMessage(`Updating work package #${workPackageId}...`);
        console.log('Update data:', data);
        return true;
    }
}

export const apiClient = new ApiClient();