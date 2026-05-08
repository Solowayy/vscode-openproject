import * as vscode from "vscode";
import { gitLabClient } from "../api/gitlabClient";
import { apiClient} from "../api/apiClient";
import { GitLabMR, MrStateCache, MrWpLink} from "../api/gitlabTypes";

const STATUS_IN_PROGRESS = "7";
const STATUS_IN_TESTING  = "9";

const DEF_POLL_INTERVAL_MS = 60_000;


export class MrMonitorService implements vscode.Disposable {
    private timer: NodeJS.Timeout | null = null;
    private stateCache: MrStateCache = new Map();
    private statusBarItem: vscode.StatusBarItem;

    constructor(private readonly context: vscode.ExtensionContext){
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100,
        );
        this.statusBarItem.command = "openproject.mrMonitor.pollNow";
        context.subscriptions.push(this.statusBarItem);
    }

    public start(): void {
        if(this.timer) { return; }

        if(!gitLabClient.isConfigured()) {
            console.log("MrMonitorService: GitLab not configured");
            return;
        }

        const intervalMs = this.getIntervalMs();
        console.log(`MrMonitorService: statring poll every ${intervalMs / 1000}s`);

        this.updateStatusBar("idle");

        this.poll();
        this.timer = setInterval(() => this.poll(), intervalMs);
    }

    public stop(): void {
        if(this.timer){
            clearInterval(this.timer);
            this.timer = null;
        }

        this.statusBarItem.hide();
        console.log("MrMonitorService: stopped");
    }

    public async pollNow(): Promise<void> {
        await this.poll();
    }

    public dispose(): void {
        this.stop();
    }


    private async poll(): Promise<void> {
        if (!gitLabClient.isConfigured() || !apiClient.isConfigured()) { return; }

        this.updateStatusBar("polling");

        try{
            const mrs = await gitLabClient.getMergeRequests();

            const links: MrWpLink[] = mrs
                .map(mr => {
                    const wpId = gitLabClient.extractWpId(mr);
                    return wpId ? { mr, wpId} : null;
                })
                .filter((l): l is MrWpLink => l !== null);

                for(const link of links){
                    await this.handleTransition(link);
                }

                this.updateStatusBar("idle", new Date());
        }catch(err: any){
            console.log("MrMonitorService: poll error", err.message);
            this.updateStatusBar("error");
        }
    }


    private async handleTransition(link: MrWpLink): Promise<void> {
        const { mr, wpId } = link;
        const key = mr.iid.toString();
        const previousState = this.stateCache.get(key);
        const currentState = mr.state;

        this.stateCache.set(key, currentState);

        const isTransition =previousState !== currentState;

        if(!isTransition) { return; }

        console.log(
            `MrMonitorService: MR !${mr.iid} "${mr.title}" -> ${previousState ?? "new"} -> ${currentState} (WP #${wpId})`
        );

        if(currentState === "opened"){
            await this.trasitionWp(wpId, STATUS_IN_PROGRESS, mr, "opened");
        }else if(currentState === "merged"){
            await this.trasitionWp(wpId, STATUS_IN_TESTING, mr, "merged");
        }
    }

    private async trasitionWp(
        wpId: number,
        targerStatusId: string,
        mr: GitLabMR,
        trigger: string,
    ): Promise<void> {

        const success = await apiClient.updateWorkPackage(wpId, {
            statusId: targerStatusId,
        });

        if(success){
            const label = targerStatusId === STATUS_IN_PROGRESS
                ? "In Progress"
                : "In Testing";

            vscode.window
                .showInformationMessage(
                    `WP #${wpId} -> ${label}  (MR !${mr.iid} ${trigger})`,
                    "Open MR",
                )
                .then(choice => {
                    if(choice === "Open MR"){
                        vscode.env.openExternal(vscode.Uri.parse(mr.web_url));
                    }
                });
        }else{
            console.error(
                `MrMonitorService: failed to update WP #${wpId} for MR !${mr.iid}`
            );
        }
    }

    private getIntervalMs(): number {
        const cfg = vscode.workspace.getConfiguration("openproject");
        const seconds = cfg.get<number>("gitlab.pollIntervalSeconds");
        return seconds && seconds >= 10
            ? seconds * 1000
            : DEF_POLL_INTERVAL_MS;
    }

    private updateStatusBar(
        state: "idle" | "polling" | "error",
        lastPolled?: Date,
    ): void {

        switch(state){
            case "polling":
                this.statusBarItem.text = "$(sync-spin) GitLab MR monitor...";
                this.statusBarItem.tooltip = "Polling GitLab for MR changes";
                break;
            case "error":
                this.statusBarItem.text = "$(warning) GitLab MR monitor";
                this.statusBarItem.tooltip = "Last poll failed - click to retry";
                break;
            default: {
                const time = lastPolled
                    ? `Last polled: ${lastPolled.toLocaleTimeString()}`
                    : "Not yet polled";
                this.statusBarItem.text = "${git-pull-request} MR monitor";
                this.statusBarItem.tooltip = `${time}\nClick to poll now`;
            }
        }
        this.statusBarItem.show();
    }
}
