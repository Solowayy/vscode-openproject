export type UnifiedPrState = "open" | "merged" | "closed";

export interface UnifiedPR {
    source: string;

    number: number;
    title: string;
    webUrl: string;
    state: UnifiedPrState;

    sourceBranch: string;

    body: string;
}

/*
In MR title, description, source branch for wp id reference

OP#123 / op#123 / openproject#123   title + description
wp-123 / wp/123                     ---------||-------- or branch
*/

export const WP_PATTERNS: RegExp[] = [
    /(?:OP|op|openproject)#(\d+)/g,
    /\bwp[-\/](\d+)\b/gi,
];

export function extractWpId(pr: UnifiedPR): number | null {
    const targets = [pr.title, pr.body, pr.sourceBranch];

    for(const text of targets){
        for(const pattern of WP_PATTERNS){
            pattern.lastIndex = 0;
            const match = pattern.exec(text);
            if(match){
                return parseInt(match[1], 10);
            }
        }
    }

    return null;
}

export type PrStateCache = Map<string, UnifiedPrState>;

export interface PrSource {
    readonly label: string;

    isConfigured(): boolean;

    fetchPRs(): Promise<UnifiedPR[]>;
}