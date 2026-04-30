const window = {
    showErrorMessage: (msg) => console.error("[mock]", msg),
    showInformationMessage: (msg) => console.log("[mock]", msg),
    showWarningMessage: (msg) => console.warn("[mock]", msg),
    createStatusBarItem: () => ({
        text: "", tooltip: "", command: "",
        show: () => {}, hide: () => {}, dispose: () => {}
    }),
};

const workspace = {
    getConfiguration: () => ({
        get: (key) => {
            const cfg = {
                "gitlab.url": "http://localhost:3101",
                "gitlab.token": "test-token",
                "gitlab.projectId": 1,
            };
            return cfg[key] ?? "";
        }
    })
};

const Uri = { parse: (s) => s };
const env = { openExternal: () => {} };
const StatusBarAlignment = { Left: 1, Right: 2 };
const ConfigurationTarget = { Global: 1 };

module.exports = { window, workspace, Uri, env, StatusBarAlignment, ConfigurationTarget };