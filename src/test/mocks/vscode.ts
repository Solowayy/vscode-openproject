export const window = {
    showErrorMessage: (msg: string) => console.error("[mock]", msg),
    showInformationMessage: (msg: string) => console.log("[mock]", msg),
    showWarningMessage: (msg: string) => console.warn("[mock]", msg),
    createStatusBarItem: () => ({
        text: "", tooltip: "", command: "",
        show: () => {}, hide: () => {}, dispose: () => {}
    }),
};

export const workspace = {
    getConfiguration: () => ({
        get: (key: string) => {
            const cfg: Record<string, any> = {
                "gitlab.url":     "http://localhost:3101",
                "gitlab.token":   "test-token",
                "gitlab.projectId": 1,
            };
            return cfg[key];
        }
    })
};

export const Uri = { parse: (s: string) => s };
export const env = { openExternal: () => {} };
export const StatusBarAlignment = { Left: 1, Right: 2 };
export const ConfigurationTarget = { Global: 1 };