"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const workPackageTreeProvider_1 = require("./providers/workPackageTreeProvider");
const apiClient_1 = require("./api/apiClient");
async function activate(context) {
    console.log('OpenProject розширення активовано');
    // Створення та ініціалізація Tree Provider
    const projectTreeProvider = new workPackageTreeProvider_1.ProjectTreeProvider();
    // Реєструємо Tree View
    const treeView = vscode.window.createTreeView('openproject.projectsView', {
        treeDataProvider: projectTreeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);
    // Ініціалізуємо провайдер
    // await projectTreeProvider.initialize();
    // ============================================
    // КОМАНДИ
    // ============================================
    // Команда: Налаштувати підключення
    const configureCommand = vscode.commands.registerCommand('openproject.configure', async () => {
        const url = await vscode.window.showInputBox({
            prompt: 'Введіть URL вашого OpenProject',
            placeHolder: 'https://your-openproject.com',
            value: vscode.workspace.getConfiguration('openproject').get('url'),
            validateInput: (value) => {
                if (!value) {
                    return 'URL не може бути порожнім';
                }
                if (!value.startsWith('http')) {
                    return 'URL має починатися з http або https';
                }
                return null;
            }
        });
        if (!url) {
            return;
        }
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Введіть ваш API ключ',
            password: true,
            value: vscode.workspace.getConfiguration('openproject').get('apiKey'),
            validateInput: (value) => {
                if (!value) {
                    return 'API ключ не може бути порожнім';
                }
                return null;
            }
        });
        if (!apiKey) {
            return;
        }
        // Збереження конфігурації
        const config = vscode.workspace.getConfiguration('openproject');
        await config.update('url', url, vscode.ConfigurationTarget.Global);
        await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        // Ініціалізація клієнта
        const success = await apiClient_1.apiClient.initialize();
        if (success) {
            vscode.window.showInformationMessage('✅ OpenProject успішно налаштовано!');
            projectTreeProvider.refresh();
        }
        else {
            vscode.window.showErrorMessage('❌ Не вдалося підключитися до OpenProject');
        }
    });
    // Команда: Оновити дерево
    const refreshCommand = vscode.commands.registerCommand('openproject.refresh', () => {
        vscode.window.showInformationMessage('🔄 Оновлення даних...');
        projectTreeProvider.refresh();
    });
    // Команда: Відкрити робочий пакет
    const openWorkPackageCommand = vscode.commands.registerCommand('openproject.openWorkPackage', async (workPackage) => {
        // Отримуємо повні дані про робочий пакет
        const fullWorkPackage = await apiClient_1.apiClient.getWorkPackage(workPackage.id);
        if (!fullWorkPackage) {
            vscode.window.showErrorMessage('Не вдалося завантажити робочий пакет');
            return;
        }
        const panel = vscode.window.createWebviewPanel('workPackageDetail', `#${fullWorkPackage.id} - ${fullWorkPackage.subject}`, vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        panel.webview.html = getWorkPackageWebviewContent(fullWorkPackage);
    });
    // Команда: Створити новий робочий пакет
    // const createWorkPackageCommand = vscode.commands.registerCommand(
    //     'openproject.createWorkPackage',
    //     async (treeItem?: ProjectTreeItem) => {
    //         let project: Project | undefined = treeItem?.project;
    //         // Якщо проект не вибрано, запитуємо користувача
    //         if (!project) {
    //             const projects = await apiClient.getProjects();
    //             if (projects.length === 0) {
    //                 vscode.window.showWarningMessage('Немає доступних проектів');
    //                 return;
    //             }
    //             const selectedProject = await vscode.window.showQuickPick(
    //                 projects.map(p => ({ 
    //                     label: p.name, 
    //                     description: p.identifier,
    //                     project: p 
    //                 })),
    //                 { placeHolder: 'Оберіть проект' }
    //             );
    //             if (!selectedProject) {
    //                 return;
    //             }
    //             project = selectedProject.project;
    //         }
    //         const subject = await vscode.window.showInputBox({
    //             prompt: 'Введіть назву робочого пакету',
    //             placeHolder: 'Назва задачі...',
    //             validateInput: (value) => {
    //                 if (!value || value.trim().length === 0) {
    //                     return 'Назва не може бути порожньою';
    //                 }
    //                 return null;
    //             }
    //         });
    //         if (!subject) {
    //             return;
    //         }
    //         const description = await vscode.window.showInputBox({
    //             prompt: 'Введіть опис (необов\'язково)',
    //             placeHolder: 'Опис задачі...'
    //         });
    //         // Створюємо робочий пакет
    //         const created = await apiClient.createWorkPackage({
    //             projectId: project.id,
    //             subject: subject.trim(),
    //             description: description?.trim()
    //         });
    //         if (created) {
    //             vscode.window.showInformationMessage(`✅ Робочий пакет "${subject}" створено!`);
    //             projectTreeProvider.refresh();
    //         } else {
    //             vscode.window.showErrorMessage('❌ Не вдалося створити робочий пакет');
    //         }
    //     }
    // );
    // Реєстрація всіх команд
    context.subscriptions.push(configureCommand, refreshCommand
    // openWorkPackageCommand,
    // createWorkPackageCommand
    );
    // Автоматична ініціалізація при старті (якщо налаштовано)
    const config = vscode.workspace.getConfiguration('openproject');
    if (config.get('url') && config.get('apiKey')) {
        apiClient_1.apiClient.initialize().then(success => {
            if (success) {
                projectTreeProvider.refresh();
            }
        });
    }
}
function getWorkPackageWebviewContent(workPackage) {
    const statusName = workPackage._links.status?.title || 'Невідомо';
    const typeName = workPackage._links.type?.title || 'Невідомо';
    const projectName = workPackage._links.project?.title || 'Невідомо';
    const assigneeName = workPackage._links.assignee?.title || 'Не призначено';
    const priorityName = workPackage._links.priority?.title || 'Невідомо';
    return `<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Робочий пакет #${workPackage.id}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
        }
        
        .header {
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 25px;
        }
        
        h1 {
            color: var(--vscode-editor-foreground);
            font-size: 24px;
            margin-bottom: 5px;
        }
        
        .id-badge {
            display: inline-block;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 10px;
        }
        
        .info-section {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .info-section h2 {
            color: var(--vscode-foreground);
            font-size: 16px;
            margin-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 140px 1fr;
            gap: 12px;
            align-items: start;
        }
        
        .label {
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
        }
        
        .value {
            color: var(--vscode-foreground);
        }
        
        .description {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 15px;
            border-radius: 4px;
            margin-top: 10px;
        }
        
        .description h3 {
            margin-top: 15px;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }
        
        .description p {
            margin-bottom: 10px;
        }
        
        .description ul, .description ol {
            margin-left: 20px;
            margin-bottom: 10px;
        }
        
        .description code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        
        .empty-state {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <span class="id-badge">#${workPackage.id}</span>
            <span style="color: var(--vscode-descriptionForeground);">${typeName}</span>
        </div>
        <h1>${workPackage.subject}</h1>
    </div>
    
    <div class="info-section">
        <h2>📋 Основна інформація</h2>
        <div class="info-grid">
            <div class="label">Проект:</div>
            <div class="value">${projectName}</div>
            
            <div class="label">Тип:</div>
            <div class="value">${typeName}</div>
            
            <div class="label">Статус:</div>
            <div class="value">${statusName}</div>
            
            <div class="label">Пріоритет:</div>
            <div class="value">${priorityName}</div>
            
            <div class="label">Виконавець:</div>
            <div class="value">${assigneeName}</div>
        </div>
    </div>

    ${workPackage.description?.html ? `
        <div class="info-section">
            <h2>📝 Опис</h2>
            <div class="description">
                ${workPackage.description.html}
            </div>
        </div>
    ` : `
        <div class="info-section">
            <h2>📝 Опис</h2>
            <div class="empty-state">Опис відсутній</div>
        </div>
    `}
</body>
</html>`;
}
function deactivate() {
    console.log('OpenProject розширення деактивовано');
}
//# sourceMappingURL=extension.js.map