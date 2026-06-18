import * as vscode from "vscode";
import { apiClient } from "../api/apiClient";
import { PrSource, UnifiedPR, PrStateCache, UnifiedPrState, extractWpId } from "../api/forgeTypes";

const STATUS_IN_PROGRESS = "7";
const STATUS_CLOSED      = "12";

const DEF_POLL_INTERVAL_MS = 60_000;

export class PrMonitorService implements vscode.Disposable {
    private timer: NodeJS.Timeout | null = null;
    private stateCache: PrStateCache = new Map();
    private statusBarItem: vscode.StatusBarItem;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly sources: PrSource[],
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100,
        );
        this.statusBarItem.command = "openproject.prMonitor.pollNow";
        context.subscriptions.push(this.statusBarItem);
    }

    public start(): void {
        if(this.timer) { return; }

        const activeSources = this.sources.filter(s => s.isConfigured());
        if(activeSources.length === 0){
            console.log("PrMonitorService: no source configured");
            return;
        }

        const labels = activeSources.map(s => s.label).join(" + ");
        const intervalMs = this.getIntervalMs();

        console.log(`PrMonitorService: starting poll for [${labels}] every ${intervalMs / 1000}s`);;

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
        console.log("PrMonitorService: stopped");
    }

    public async pollNow(): Promise<void> {
        await this.poll();
    }

    public dispose(): void {
        this.stop();
    }

    private async poll(): Promise<void> {
        if(!apiClient.isConfigured()) { return; }

        const activeSources = this.sources.filter(s => s.isConfigured());
        if(activeSources.length === 0) { return; }

        this.updateStatusBar("polling");

        try{
            const results = await Promise.allSettled(
                activeSources.map(s => s.fetchPRs()),
            );

            const allPRs: UnifiedPR[] = results.flatMap((result, i) => {
                if(result.status === "fulfilled"){
                    return result.value;
                }
                console.error(`PrMonitorService: ${activeSources[i].label} fetch failed`, result.reason);
                return [];
            });

            for(const pr of allPRs){
                const wpId = extractWpId(pr);
                if(wpId !== null){
                    await this.handleTransition(pr, wpId);
                }
            }

            this.updateStatusBar("idle", new Date());
        }catch (err: any) {
            console.error("PrMonitorService: poll error", err.message);
            this.updateStatusBar("error");
        }
    }
    

    private async handleTransition(pr: UnifiedPR, wpId: number): Promise<void> {
        const key           = `${pr.source}:${pr.number}`;
        const previousState = this.stateCache.get(key);
        const currentState  = pr.state;

        this.stateCache.set(key, currentState);

        if(previousState === currentState) { return; }

        console.log(
            `PrMonitorService: [${pr.source}] #${pr.number} "${pr.title}"` + 
            `${previousState ?? "new"} -> ${currentState} (WP #${wpId})`,
        );

        // if(currentState === "open"){
        //     await this.transitionWp(wpId, STATUS_IN_PROGRESS, pr, "opened");
        // } 
        if(currentState === "merged"){
            await this.transitionWp(wpId, STATUS_CLOSED, pr, "merged");
        }
    }

    private async transitionWp(
        wpId: number,
        targetStatusId: string,
        pr: UnifiedPR,
        trigger: string,
    ): Promise<void>{
        const success = await apiClient.updateWorkPackage(wpId, {statusId: targetStatusId});

        if(success){
            const label = targetStatusId === STATUS_IN_PROGRESS ? "In Progress" : "Closed";
            const sourceTag = pr.source === "gitlab" ? `MR |${pr.number}` : `PR #${pr.number}`;
            const actionLabel = pr.source === "gitlab" ? "Open MR" : "Open PR";

            vscode.window
                .showInformationMessage(
                    `WP #${wpId} -> ${label}  (${sourceTag} ${trigger})`,
                    actionLabel,
                )
                .then(choice => {
                    if(choice === actionLabel){
                        vscode.env.openExternal(vscode.Uri.parse(pr.webUrl));
                    }
                });
        } else {
            console.error(
                `PrMonitorService: failed to update WP #${wpId} for [${pr.source}] #${pr.number}`,
            );
        }
    }

    private getIntervalMs(): number{
        const cfg = vscode.workspace.getConfiguration("openproject");
        const seconds = cfg.get<number>("prMonitor.pollIntervalSeconds");
        return seconds && seconds >= 10 ?
            seconds * 1000 :
            DEF_POLL_INTERVAL_MS;
    }

    private updateStatusBar(state: "idle" | "polling" | "error", lastPolled?: Date): void {
        const activeLabels = this.sources
            .filter(s => s.isConfigured())
            .map(s => s.label)
            .join(" + ") || "PR";

        switch(state) {
            case "polling":
                this.statusBarItem.text    = "$(sync-spin) PR monitor...";
                this.statusBarItem.tooltip = `Polling ${activeLabels} for changes`;
                break;
            case "error":
                this.statusBarItem.text    = "$(warning) PR monitor";
                this.statusBarItem.tooltip = `Last poll failed - click to retry`;
                break;
            default:
                const time = lastPolled ?
                    `Last polled: ${lastPolled.toLocaleTimeString()}` :
                    "Not yet polled";
                this.statusBarItem.text    = "$(git-pull-request) PR monitor";
                this.statusBarItem.tooltip = `${activeLabels}\n${time}\nClick to poll now`;
        }

        this.statusBarItem.show();
    }
}