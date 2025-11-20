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
exports.MyTreeDataProvider = exports.MyTreeItem = void 0;
const vscode = __importStar(require("vscode"));
class MyTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    children;
    constructor(label, collapsibleState, children) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.children = children;
    }
}
exports.MyTreeItem = MyTreeItem;
class MyTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Головні елементи
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
exports.MyTreeDataProvider = MyTreeDataProvider;
//# sourceMappingURL=treeDataProvider.js.map