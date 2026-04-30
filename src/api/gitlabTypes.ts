export interface GitLabConfig {
    url: string;
    token: string;
    projectId: number;
}

export interface GitLabMR {
    id: number;
    iid: number;
    title: string;
    description: string;
    state: "opened" | "closed" | "locked" | "merged";
    source_branch : string;
    web_url: string;
}


export type MrStateCache = Map<string, GitLabMR["state"]>;

export interface MrWpLink {
    mr: GitLabMR;
    wpId: number;
}