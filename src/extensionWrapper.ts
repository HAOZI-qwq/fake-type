import * as vscode from 'vscode';
import { activate as activateFakeType, deactivate as deactivateFakeType } from './extension';
import { shouldTriggerSuggestion, SuggestionTriggerScheduler } from './suggestionTrigger';

interface PersistedFileContent {
    content: string;
}

const STORAGE_KEY = 'fakeType.fileContents';

export function activate(context: vscode.ExtensionContext) {
    activateFakeType(context);

    const suggestionScheduler = new SuggestionTriggerScheduler(
        () => vscode.commands.executeCommand('editor.action.triggerSuggest'),
        60
    );

    context.subscriptions.push({
        dispose: () => suggestionScheduler.dispose()
    });

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document !== event.document) {
                return;
            }

            const filePath = event.document.uri.toString();
            const mappings = context.globalState.get<Record<string, PersistedFileContent>>(STORAGE_KEY, {});
            const mapping = mappings[filePath];
            if (!mapping) {
                return;
            }

            if (shouldTriggerSuggestion(event.document.getText(), mapping.content)) {
                suggestionScheduler.schedule();
            }
        })
    );
}

export function deactivate() {
    deactivateFakeType();
}
