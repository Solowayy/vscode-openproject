import * as vscode from "vscode";
import { WorkPackage } from "../api/types";

export class WorkPackageWebviewManager {
  public static async createOrShow(
    extensionUri: vscode.Uri,
    workPackage: WorkPackage,
  ) {
    const panel = vscode.window.createWebviewPanel(
      "workPackageDetail",
      `#${workPackage.id} - ${workPackage.subject}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      },
    );

    const { apiClient } = require("../api/apiClient");

    // Extract Project ID from _links.project.href (e.g. "/api/v3/projects/1")
    let projectId: number | undefined;
    if (workPackage._links && workPackage._links.project && workPackage._links.project.href) {
      const match = workPackage._links.project.href.match(/\/projects\/(\d+)/);
      if (match) {
        projectId = parseInt(match[1], 10);
      }
    }

    const [types, statuses, priorities] = await Promise.all([
      apiClient.getTypes(projectId),
      apiClient.getStatuses(),
      apiClient.getPriorities()
    ]);

    panel.webview.html = this.getHtmlForWebview(
      panel.webview,
      extensionUri,
      workPackage,
      types,
      statuses,
      priorities
    );

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "save":
            // Execute the updateWorkPackage command
            const success = await vscode.commands.executeCommand(
              "openproject.updateWorkPackage",
              workPackage.id,
              message.data,
            );

            if (success) {
              // Send success message back to webview to switch to view mode
              panel.webview.postMessage({ command: "updateSuccess" });

              // Update the panel title if subject changed
              if (message.data.subject) {
                panel.title = `#${workPackage.id} - ${message.data.subject}`;
              }
            } else {
              // Send error message back to webview
              panel.webview.postMessage({ command: "updateError" });
            }
            return;
        }
      },
      undefined,
      [],
    );
  }

  private static getHtmlForWebview(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    workPackage: WorkPackage,
    types: any[],
    statuses: any[],
    priorities: any[]
  ): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "media", "style.css"),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "media", "main.js"),
    );

    const statusName = workPackage._links.status?.title || "Unknown";
    const typeName = workPackage._links.type?.title || "Unknown";
    const projectName = workPackage._links.project?.title || "Unknown";
    const assigneeName = workPackage._links.assignee?.title || "Unassigned";
    const priorityName = workPackage._links.priority?.title || "Unknown";

    const generateOptions = (items: any[], currentName: string) => {
      return items.map(item =>
        `<option value="${item.id}" ${item.name === currentName ? "selected" : ""}>${item.name}</option>`
      ).join('');
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>Work Package #${workPackage.id}</title>
</head>
<body>
    <!-- VIEW CONTAINER -->
    <div id="view-container">
        <div class="header">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <span class="id-badge">#${workPackage.id}</span>
                    <span style="color: var(--vscode-descriptionForeground);">${typeName}</span>
                </div>
                <div class="actions">
                    <button id="btn-edit" class="btn btn-primary">Edit</button>
                </div>
            </div>
            <h1>${workPackage.subject}</h1>
        </div>
        
        <div class="info-section">
            <h2>📋 Basic Information</h2>
            <div class="info-grid">
                <div class="label">Project:</div>
                <div class="value">${projectName}</div>
                
                <div class="label">Type:</div>
                <div class="value">${typeName}</div>
                
                <div class="label">Status:</div>
                <div class="value">${statusName}</div>
                
                <div class="label">Priority:</div>
                <div class="value">${priorityName}</div>
                
                <div class="label">Assignee:</div>
                <div class="value">${assigneeName}</div>
            </div>
        </div>

        ${workPackage.description?.html
        ? `
            <div class="info-section">
                <h2>📝 Description</h2>
                <div class="description">
                    ${workPackage.description.html}
                </div>
            </div>
        `
        : `
            <div class="info-section">
                <h2>📝 Description</h2>
                <div class="empty-state">No description available</div>
            </div>
        `
      }
    </div>

    <!-- EDIT CONTAINER -->
    <div id="edit-container" class="hidden">
        <div class="header">
            <h2>Edit Work Package #${workPackage.id}</h2>
        </div>

        <div class="form-group">
            <label for="input-subject">Subject</label>
            <input type="text" id="input-subject" class="form-control" value="${workPackage.subject
      }">
        </div>

        <div class="form-group">
            <label for="input-description">Description (Markdown)</label>
            <textarea id="input-description" class="form-control">${workPackage.description?.raw || ""
      }</textarea>
        </div>

        <div class="info-grid form-group">
            <div class="label">Type</div>
            <select id="select-type" class="form-control">
                ${generateOptions(types, typeName)}
            </select>

            <div class="label">Status</div>
            <select id="select-status" class="form-control">
                ${generateOptions(statuses, statusName)}
            </select>

            <div class="label">Priority</div>
            <select id="select-priority" class="form-control">
                 ${generateOptions(priorities, priorityName)}
            </select>
        </div>

        <div class="actions">
            <button id="btn-cancel" class="btn btn-secondary">Cancel</button>
            <button id="btn-save" class="btn btn-primary">Save Changes</button>
        </div>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
