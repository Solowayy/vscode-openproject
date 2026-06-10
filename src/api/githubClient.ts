import axios from "axios";
import * as vscode from "vscode";
import { PrSource, UnifiedPR } from "./forgeTypes";

interface GitHubConfig {
    token: string,
    owner: string;
    repo: string;
}

const GITHUB_API = "https://api.github.com";

export class GitHubClient implements PrSource {
    readonly label = "GitHub";

    private client: import("axios").AxiosInstance;
    private config: GitHubConfig | null = null;

    constructor() {
        this.client = axios.create({
            baseURL: GITHUB_API,
            headers: {
                "Content-Type": "apllication/json",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });
    }

    public async initialize(): Promise<boolean> {
        const cfg    = vscode.workspace.getConfiguration("openproject");
        const token  = cfg.get<string>("github.token");
        const owner  = cfg.get<string>("github.owner");
        const repo   = cfg.get<string>("github.repo");

        if(!token || !owner || !repo) { return false; }

        this.config = { token, owner, repo };
        this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        return this.testConnection();
    }

    public async testConnection(): Promise<boolean> {
        try{
            await this.client.get(`/repos/${this.config!.owner}/${this.config!.repo}`);
            return true;
        }catch (err: any){
            const status = err.response?.status;

            if(status === 401){
                vscode.window.showErrorMessage("GitHub: invalid token");
            } else if(status === 404){
                vscode.window.showErrorMessage("GitHub: repository not found - check owner/repo settings");
            } else {
                vscode.window.showErrorMessage(`GitHub: connection failed (${status})`);
            }
            return false;
        }
    }

    public isConfigured(): boolean {
        return this.config !== null;
    }

    public async fetchPRs(): Promise<UnifiedPR[]> {
        if(!this.config) { return []; }

        const { owner, repo } = this.config;
        const since = new Date(Date.now() - 86_400_000).toISOString();

        try{
            const [openRes, closedRes] = await Promise.all([
                this.client.get<any[]>(`/repos/${owner}/${repo}/pulls`, {
                    params: { state: "open", per_page: 100},
                }),
                this.client.get<any[]>(`/repos/${owner}/${repo}/pulls`, {
                    params: { state: "closed", per_page: 50, sort: "updated", direction: "desc" },
                }),
            ]);

            const openPRs   = openRes.data.map(pr => this.mapPR(pr));
            const mergedPRs = closedRes.data
                                .filter(pr => pr.merged_at && pr.merged_at >= since)
                                .map(pr => this.mapPR(pr));

            return [...openPRs, ...mergedPRs];
        } catch (err: any) {
            console.error("GitHub: failed to fetch PRs", err.message);
            return [];
        }
    }

    private mapPR(raw: any): UnifiedPR {
        const merged = Boolean(raw.merged_at || raw.merged);
        const state = merged ? "merged" : raw.state === "open" ? "open" : "closed";

        return {
            source:       "github",
            number:       raw.number,
            title:        raw.title ?? "",
            webUrl:       raw.html_url ?? "",
            state,
            sourceBranch: raw.head?.ref ?? "",
            body:         raw.body ?? "",
        };
    }
}

export const gitHubClient = new GitHubClient();