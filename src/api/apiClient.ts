import axios from "axios";
import * as vscode from "vscode";
import {
    OpenProjectConfig,
    CollectionResponse,
    HALLink,
    HALLinks,
    Project,
    WorkPackage,
} from "./types";

export class ApiClient {
    private client: import("axios").AxiosInstance;//Axios.AxiosInstance;
    private config: OpenProjectConfig | null = null;

    constructor() {
        this.client = axios.create({
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    public async initialize(): Promise<boolean> {
        const config = vscode.workspace.getConfiguration("openproject");
        const url = config.get<string>("url");
        const apiKey = config.get<string>("apiKey");

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

    public async testConnection(): Promise<boolean> {
        try {
            await this.client.get("/api/v3");
            return true;
        } catch (exception) {
            vscode.window.showErrorMessage("Connection failed");
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
                filters.push({
                    parent: { operator: "=", values: [parentProjectId.toString()] },
                });
            } else {
                filters.push({ parent: { operator: "!*", values: [] } });
            }

            const url = `/api/v3/projects?filters=${encodeURIComponent(JSON.stringify(filters))}`;

            const response = await this.client.get<CollectionResponse<Project>>(url);
            return response.data._embedded.elements;
        } catch (exception: any) {
            console.error("Status:", exception.response?.status);
            console.error("Body:", JSON.stringify(exception.response?.data));
            return [];
        }
    }

    public async getWorkPackages(projectId: number): Promise<WorkPackage[]> {
        try {
            const filters = JSON.stringify([
                { project: { operator: "=", values: [projectId.toString()] } },
            ]);

            const url = `/api/v3/work_packages?pageSize=500&filters=${encodeURIComponent(filters)}`;

            const response =
                await this.client.get<CollectionResponse<WorkPackage>>(url);

            return response.data._embedded.elements;
        } catch (exception: any) {
            console.error("Failed to read packages");
            console.error("Status:", exception.response?.status);
            console.error("Body:", JSON.stringify(exception.response?.data));
            return [];
        }
    }

    public async getWorkPackage(id: number): Promise<WorkPackage | null> {
        try {
            const response = await this.client.get<WorkPackage>(
                `api/v3/work_packages/${id}`,
            );
            return response.data;
        } catch (exception) {
            return null;
        }
    }

    // Methods to get available types, statuses, and priorities

    // Types: Task=1, Milestone=2, Summary task=3, Feature=4, Epic=5, User story=6, Bug=7
    public async getTypes(projectId?: number): Promise<Array<{ id: number; name: string; href: string }>> {
        try {
            const url = projectId ? `/api/v3/projects/${projectId}/types` : '/api/v3/types';
            const response = await this.client.get(url);
            const types = (response.data as any)._embedded?.elements || [];
            return types.map((type: any) => ({
                id: type.id,
                name: type.name,
                href: type._links.self.href
            }));
        } catch (exception: any) {
            console.error('Failed to fetch types:', exception.message);
            return [];
        }
    }

    // Statuses: New=1, In specification=2, Specified=3, Confirmed=4, To be scheduled=5, Scheduled=6, In progress=7, Developed=8, In testing=9, Tested=10, Test failed=11, Closed=12, On hold=13, Rejected=14
    public async getStatuses(): Promise<Array<{ id: number; name: string; href: string }>> {
        try {
            const response = await this.client.get('/api/v3/statuses');
            const statuses = (response.data as any)._embedded?.elements || [];
            return statuses.map((status: any) => ({
                id: status.id,
                name: status.name,
                href: status._links.self.href
            }));
        } catch (exception: any) {
            console.error('Failed to fetch statuses:', exception.message);
            return [];
        }
    }

    // Priorities: Low=7, Normal=8, High=9, Immediate=10
    public async getPriorities(): Promise<Array<{ id: number; name: string; href: string }>> {
        try {
            const response = await this.client.get('/api/v3/priorities');
            const priorities = (response.data as any)._embedded?.elements || [];
            return priorities.map((priority: any) => ({
                id: priority.id,
                name: priority.name,
                href: priority._links.self.href
            }));
        } catch (exception: any) {
            console.error('Failed to fetch priorities:', exception.message);
            return [];
        }
    }

    public async getUsers(): Promise<Array<{ id: number; name: string; href: string }>> {
        try {
            const response = await this.client.get('/api/v3/users');
            const users = (response.data as any)._embedded?.elements || [];
            return users.map((user: any) => ({
                id: user.id,
                name: user.name,
                href: user._links.self.href
            }));
        } catch (exception: any) {
            console.error('Failed to fetch users:', exception.message);
            return [];
        }
    }

    public async createWorkPackage(data: {
        projectId: number;
        type: string;
        status: string;
        priority: string;
        subject: string;
        description?: string;
        assignee?: { id: number; href: string };
        parentId?: number;
    }): Promise<boolean> {
        try {
            const payload: any = {
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
        } catch (exception: any) {
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
                    const errorDetails = errors.map((err: any) =>
                        `${err.message || ''} (${err._type || ''})`
                    ).join(', ');
                    errorMessage += `: ${errorDetails}`;
                }
            }

            vscode.window.showErrorMessage(errorMessage);
            return false;
        }
    }

    public async updateWorkPackage(
        workPackageId: number,
        data: {
            subject?: string;
            description?: string;
            statusId?: string;
            typeId?: string;
            priorityId?: string;
        },
    ): Promise<boolean> {
        try {
            // Fetch the current work package to get lockVersion
            const currentWP = await this.getWorkPackage(workPackageId);
            if (!currentWP) {
                vscode.window.showErrorMessage(
                    `Work package #${workPackageId} not found`,
                );
                return false;
            }

            // Validate lockVersion exists
            const lockVersion = (currentWP as any).lockVersion;
            if (lockVersion === undefined || lockVersion === null) {
                console.error("Work package data:", JSON.stringify(currentWP, null, 2));
                vscode.window.showErrorMessage(
                    `Work package #${workPackageId} does not have a lockVersion. This might be a data issue.`,
                );
                return false;
            }

            // Build the payload with only the fields that are being updated
            const payload: any = {
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

            const response = await this.client.patch(
                `/api/v3/work_packages/${workPackageId}`,
                payload,
            );

            if (response.status === 200) {
                return true;
            }
            return false;
        } catch (exception: any) {
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
                    const errorDetails = errors.map((err: any) =>
                        `${err.message || ''} (${err._type || ''})`
                    ).join(', ');
                    errorMessage += `: ${errorDetails}`;
                }
            }

            vscode.window.showErrorMessage(errorMessage);
            return false;
        }
    }
}

export const apiClient = new ApiClient();
