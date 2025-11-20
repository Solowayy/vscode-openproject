import * as vscode from 'vscode';

export class MyTreeItem extends vscode.TreeItem {
    constructor( public readonly label: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState, public readonly children?: MyTreeItem[]) {
    super(label, collapsibleState);
    }
}

export class MyTreeDataProvider implements vscode.TreeDataProvider<MyTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MyTreeItem | undefined | null | void> = new vscode.EventEmitter<MyTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MyTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MyTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: MyTreeItem): Thenable<MyTreeItem[]> {
        if (!element) {
            return Promise.resolve([
                new MyTreeItem('Test 1', vscode.TreeItemCollapsibleState.Collapsed, [
                    new MyTreeItem('SubTest 1.1', vscode.TreeItemCollapsibleState.None),
                    new MyTreeItem('SubTest 1.2', vscode.TreeItemCollapsibleState.None)
                ]),
                new MyTreeItem('Test 2', vscode.TreeItemCollapsibleState.Collapsed, [
                    new MyTreeItem('SubTest 2.1', vscode.TreeItemCollapsibleState.None)
                ]),
                new MyTreeItem('Test 3', vscode.TreeItemCollapsibleState.None)
            ]);
        } 
        else {
            return Promise.resolve(element.children || []);
        }
    }
}