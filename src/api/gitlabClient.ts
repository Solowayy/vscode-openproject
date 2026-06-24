import axios from "axios";
import * as vscode from "vscode";
// import { GitLabConfig, GitLabMR} from "./gitlabTypes";
import { PrSource, UnifiedPR } from "./forgeTypes";

interface GitLabConfig {
    url: string;
    token: string;
    projectId: number;
}

export class GitLabClient implements PrSource{
    readonly label = "GitLab";

    private client: import("axios").AxiosInstance;
    private config: GitLabConfig | null = null;

    constructor() {
        this.client = axios.create({
            headers: { "Content-Type": "application/json" },
        });
    }


    public async initialize(): Promise<boolean> {
        const cfg = vscode.workspace.getConfiguration("openproject");
        const url       = cfg.get<string>("gitlab.url");
        const token     = cfg.get<string>("gitlab.token");
        const projectId = cfg.get<number>("gitlab.projectId");

        if(!url || !token || !projectId){
            return false;
        }

        this.config = {url, token, projectId};
        this.client.defaults.baseURL = `${url}/api/v4`;
        this.client.defaults.headers.common["PRIVATE-TOKEN"] = token;

        return this.testConnection();
    }

    public async testConnection(): Promise<boolean>{
        try{
            await this.client.get(`/projects/${this.config!.projectId}`);
            return true;
        } catch (err: any){
            const status = err.response?.status;
            if(status === 401){
                vscode.window.showErrorMessage("GitLab: invalid token");
            }else if(status === 404){
                vscode.window.showErrorMessage("GitLab: connection failed");
            }
            return false;
        }
    }

    public isConfigured(): boolean {
        return this.config !== null;
    }

    public async fetchPRs(): Promise<UnifiedPR[]> {
        if(!this.config) { return []; }

        try{
            const [openedRes, mergedRes] = await Promise.all([
                this.client.get<any[]>(
                    `/projects/${this.config.projectId}/merge_requests`,
                    { params: { state: "opened", per_page: 100 } },
                ),
                this.client.get<any[]>(
                    `/projects/${this.config.projectId}/merge_requests`,
                    {
                        params: {
                            state: "merged",
                            per_page: 50,
                            updated_after: new Date(Date.now() - 86_400_000).toISOString(),
                        },
                    },
                ),
            ]);

            return [
                ...openedRes.data.map(mr => this.mapMR(mr)),
                ...mergedRes.data.map(mr => this.mapMR(mr)),
            ];
        } catch(err: any){
            console.error("GitLab: failed to fetch MRs", err.message);
            return [];
        }
    }

    private mapMR(raw: any): UnifiedPR {
        const glState: string = raw.state;
        const state =
            glState === "merged" ? "merged" :
            glState === "opened" ? "open"   : "closed";

        return {
            source:         "gitlab",
            number:         raw.iid,
            title:          raw.title ?? "",
            webUrl:         raw.web_url ?? "",
            state,
            sourceBranch:   raw.source_branch ?? "",
            body:           raw.description ?? "",
        };
    }
}

export const gitLabClient = new GitLabClient();