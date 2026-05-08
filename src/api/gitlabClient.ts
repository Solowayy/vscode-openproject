import axios from "axios";
import * as vscode from "vscode";
import { GitLabConfig, GitLabMR} from "./gitlabTypes";

const WP_PATTERNS: RegExp[] = [
    /(?:OP|op|openproject)#(\d+)/g,
    /\bwp[-\/](\d+)\b/gi,
];

export class GitLabClient {
    private client: import("axios").AxiosInstance;
    private config: GitLabConfig | null = null;

    constructor() {
        this.client = axios.create({
            headers: { "Content-Type": "application/json" },
        });
    }


    public async initialize(): Promise<boolean> {
        const cfg = vscode.workspace.getConfiguration("openproject");
        const url = cfg.get<string>("gitlab.url");
        const token = cfg.get<string>("gitlab.token");
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


    public async getMergeRequests(): Promise<GitLabMR[]> {
        if(!this.config) { return []; }

        try{
            const [openedRes, mergedRes] = await Promise.all([
                this.client.get<GitLabMR[]>(
                    `/projects/${this.config.projectId}/merge_requests`,
                    { params: { state: "opened", per_page: 100 }}
                ),
                this.client.get<GitLabMR[]>(
                    `/projects/${this.config.projectId}/merge_requests`,
                    {
                        params: {
                            state: "merged",
                            per_page: 50,
                            updated_after: new Date(Date.now() - 86_400_000).toISOString(),
                        }
                    }
                )
            ]);

            return [...openedRes.data, ...mergedRes.data];
        }catch(err: any){
            console.error("GitLab: failed to fetch MR", err.message);
            return [];
        }
    }


    /*
    In MR title, description, source branch for wp id reference

    OP#123 / op#123 / openproject#123   title + description
    wp-123 / wp/123                     ---------||-------- or branch
    */
    public extractWpId(mr: GitLabMR): number | null {
        const searchTargets = [
            mr.title,
            mr.description ?? "",
            mr.source_branch,
        ];

        for(const text of searchTargets) {
            for(const pattern of WP_PATTERNS) {
                pattern.lastIndex = 0;
                const match = pattern.exec(text);
                if(match){
                    return parseInt(match[1], 10);
                }
            }
        }

        return null;
    }
}

export const gitLabClient = new GitLabClient();