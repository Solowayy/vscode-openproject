import * as vscode from 'vscode';
import { MyTreeDataProvider } from './treeDataProvider';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "vscode-openproject" is now active!');

	const treeDataProvider = new MyTreeDataProvider();
	const treeView = vscode.window.createTreeView('myTreeView', {
		treeDataProvider: treeDataProvider
	});

	context.subscriptions.push(treeView);

	const disposable = vscode.commands.registerCommand('vscode-openproject.helloWorld', () => {
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}