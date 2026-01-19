import axios from "axios";
import * as vscode from "vscode";
import {
  OpenProjectConfig,
  WorkPackage,
  Project,
  CollectionResponse,
  Status,
  Type,
  User,
} from "./types";

export class OpenProjectClient {
  private client: Axios.AxiosInstance;
  private config: OpenProjectConfig | null = null;

  constructor() {
    this.client = axios.create({
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  public async initialize(): Promise<boolean> {
    const configuration = vscode.workspace.getConfiguration("openproject");
    const url = configuration.get<string>("url");
    const apiKey = configuration.get<string>("apiKey");

    if (!url || !apiKey) {
      vscode.window.showErrorMessage(
        "OpenProject URL and API Key are not configured"
      );
      return false;
    }

    this.config = { url, apiKey };
    this.client.defaults.baseURL = url;
    this.client.defaults.headers.common["Authorization"] = `Basic ${Buffer.from(
      `apikey:${apiKey}`
    ).toString("base64")}`;

    return await this.testConnection();
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.client.get("/api/v3");
      return true;
    } catch (error) {
      vscode.window.showErrorMessage("Failed to connect to OpenProject");
      console.error(error);
      return false;
    }
  }

  public async getProjects(): Promise<Project[]> {
    try {
      const response = await this.client.get<CollectionResponse<Project>>(
        "/api/v3/projects"
      );
      return response.data._embedded.elements;
    } catch (error) {
      console.error("Error fetching projects:", error);
      return [];
    }
  }

  public async getWorkPackages(projectId?: number): Promise<WorkPackage[]> {
    try {
      let url = "/api/v3/work_packages";
      if (projectId) {
        url += `?filters=[{"project":{"operator":"=","values":["${projectId}"]}}]`;
      }

      const response = await this.client.get<CollectionResponse<WorkPackage>>(
        url
      );
      return response.data._embedded.elements;
    } catch (error) {
      console.error("Error fetching work packages:", error);
      return [];
    }
  }

  public async getWorkPackage(id: number): Promise<WorkPackage | null> {
    try {
      const response = await this.client.get<WorkPackage>(
        `/api/v3/work_packages/${id}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching work package:", error);
      return null;
    }
  }

  public async createWorkPackage(data: {
    projectId: number;
    subject: string;
    description?: string;
    typeId?: number;
    statusId?: number;
  }): Promise<WorkPackage | null> {
    try {
      const payload = {
        subject: data.subject,
        description: {
          format: "markdown",
          raw: data.description || "",
        },
        _links: {
          project: {
            href: `/api/v3/projects/${data.projectId}`,
          },
          ...(data.typeId && {
            type: {
              href: `/api/v3/types/${data.typeId}`,
            },
          }),
          ...(data.statusId && {
            status: {
              href: `/api/v3/statuses/${data.statusId}`,
            },
          }),
        },
      };

      const response = await this.client.post<WorkPackage>(
        "/api/v3/work_packages",
        payload
      );
      return response.data;
    } catch (error) {
      console.error("Error creating work package:", error);
      return null;
    }
  }

  public async updateWorkPackage(
    id: number,
    data: Partial<WorkPackage>
  ): Promise<WorkPackage | null> {
    try {
      const response = await this.client.patch<WorkPackage>(
        `/api/v3/work_packages/${id}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error("Error updating work package:", error);
      return null;
    }
  }

  public async getStatuses(): Promise<Status[]> {
    try {
      const response = await this.client.get<CollectionResponse<Status>>(
        "/api/v3/statuses"
      );
      return response.data._embedded.elements;
    } catch (error) {
      console.error("Error fetching statuses:", error);
      return [];
    }
  }

  public async getTypes(): Promise<Type[]> {
    try {
      const response = await this.client.get<CollectionResponse<Type>>(
        "/api/v3/types"
      );
      return response.data._embedded.elements;
    } catch (error) {
      console.error("Error fetching types:", error);
      return [];
    }
  }

  public async getCurrentUser(): Promise<User | null> {
    try {
      const response = await this.client.get<User>("/api/v3/users/me");
      return response.data;
    } catch (error) {
      console.error("Error fetching user:", error);
      return null;
    }
  }

  public isConfigured(): boolean {
    return this.config !== null;
  }
}

export const openProjectClient = new OpenProjectClient();
