import * as vscode from 'vscode';
import { activate as activateFakeType, deactivate as deactivateFakeType } from './extension';
import { CompletionController } from './completionController';

export function activate(context: vscode.ExtensionContext) {
    activateFakeType(context);

    const completionController = new CompletionController(context);
    context.subscriptions.push(completionController.register());
}

export function deactivate() {
    deactivateFakeType();
}
