import * as vscode from 'vscode';
import {
    CompletionSettings,
    DEFAULT_COMPLETION_SETTINGS,
    normalizeCompletionSettings,
    shouldForceSuggest
} from './completionSettings';

const COMPLETION_STORAGE_KEY = 'fakeType.completionSettings.v2';
const FILE_CONTENT_STORAGE_KEY = 'fakeType.fileContents';

interface PersistedFileContent {
    content: string;
    index: number;
    fileName: string;
}

export class CompletionController implements vscode.Disposable, vscode.WebviewViewProvider {
    public static readonly viewType = 'fakeTypeCompletionSettings';

    private readonly disposables: vscode.Disposable[] = [];
    private readonly output: vscode.OutputChannel;
    private settings: CompletionSettings;
    private view: vscode.WebviewView | undefined;
    private suggestTimer: ReturnType<typeof setTimeout> | undefined;
    private syncTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.settings = normalizeCompletionSettings(
            context.globalState.get<Partial<CompletionSettings>>(COMPLETION_STORAGE_KEY)
        );
        this.output = vscode.window.createOutputChannel('Fake Type IntelliSense');
        this.disposables.push(this.output);
    }

    register(): vscode.Disposable {
        this.disposables.push(
            vscode.window.registerWebviewViewProvider(CompletionController.viewType, this),
            vscode.workspace.onDidChangeTextDocument(event => this.onDocumentChanged(event)),
            vscode.window.onDidChangeActiveTextEditor(() => this.postState())
        );
        return this;
    }

    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this.getHtml();
        this.disposables.push(
            view.webview.onDidReceiveMessage(message => this.onWebviewMessage(message))
        );
        this.postState();
    }

    dispose(): void {
        if (this.suggestTimer) {
            clearTimeout(this.suggestTimer);
        }
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }
        while (this.disposables.length > 0) {
            this.disposables.pop()?.dispose();
        }
    }

    private async onWebviewMessage(message: any): Promise<void> {
        switch (message?.type) {
            case 'getCompletionSettings':
                this.postState();
                return;
            case 'setCompletionSettings':
                this.settings = normalizeCompletionSettings({
                    ...this.settings,
                    ...(message.settings ?? {})
                });
                await this.context.globalState.update(COMPLETION_STORAGE_KEY, this.settings);
                this.log(`settings updated: ${JSON.stringify(this.settings)}`);
                this.postState();
                return;
            case 'resetCompletionSettings':
                this.settings = { ...DEFAULT_COMPLETION_SETTINGS };
                await this.context.globalState.update(COMPLETION_STORAGE_KEY, this.settings);
                this.postState();
                return;
            case 'testCompletion':
                await this.testCompletion();
                return;
            case 'showDiagnostics':
                this.output.show(true);
                return;
        }
    }

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== event.document || !this.isMappedDocument(event.document)) {
            return;
        }

        const insertedText = event.contentChanges.map(change => change.text).join('');
        const chars = Array.from(insertedText);
        const lastChar = chars.length > 0 ? chars[chars.length - 1] : '';
        this.log(`change lang=${event.document.languageId} text=${JSON.stringify(insertedText)} v=${event.document.version}`);

        if (this.settings.syncAcceptedCompletion) {
            this.scheduleProgressSync();
        }

        if (!shouldForceSuggest(lastChar, this.settings)) {
            return;
        }

        this.scheduleSuggest(event.document.uri.toString(), lastChar);
    }

    private isMappedDocument(document: vscode.TextDocument): boolean {
        const mappings = this.context.globalState.get<Record<string, PersistedFileContent>>(
            FILE_CONTENT_STORAGE_KEY,
            {}
        );
        return Boolean(mappings[document.uri.toString()]);
    }

    private scheduleProgressSync(): void {
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }
        this.syncTimer = setTimeout(() => {
            this.syncTimer = undefined;
            void vscode.commands.executeCommand('fakeType.syncCompletionProgress');
        }, 0);
    }

    private scheduleSuggest(documentUri: string, char: string): void {
        if (this.settings.mode === 'nativeFallback' && this.suggestTimer) {
            return;
        }

        if (this.settings.mode === 'always' && this.suggestTimer) {
            clearTimeout(this.suggestTimer);
            this.suggestTimer = undefined;
        }

        const delay = this.settings.delayMs;
        this.log(`schedule suggest mode=${this.settings.mode} delay=${delay} char=${JSON.stringify(char)}`);

        this.suggestTimer = setTimeout(() => {
            this.suggestTimer = undefined;
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.uri.toString() !== documentUri) {
                return;
            }
            this.log('execute editor.action.triggerSuggest');
            void vscode.commands.executeCommand('editor.action.triggerSuggest');
        }, delay);
    }

    private async testCompletion(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            void vscode.window.showWarningMessage('Fake Type：请先打开一个代码文件再测试补全');
            return;
        }

        try {
            await vscode.commands.executeCommand('editor.action.triggerSuggest');
            this.log(`manual completion test: ${editor.document.languageId}`);
            this.view?.webview.postMessage({ type: 'completionTestResult', ok: true });
        } catch (error) {
            this.log(`manual completion test failed: ${String(error)}`);
            this.view?.webview.postMessage({ type: 'completionTestResult', ok: false });
        }
    }

    private postState(): void {
        this.view?.webview.postMessage({
            type: 'updateCompletionSettings',
            settings: this.settings,
            mapped: vscode.window.activeTextEditor
                ? this.isMappedDocument(vscode.window.activeTextEditor.document)
                : false
        });
    }

    private log(message: string): void {
        if (!this.settings.diagnostics) {
            return;
        }
        this.output.appendLine(`[${new Date().toISOString()}] ${message}`);
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{box-sizing:border-box}body{padding:10px;font-family:var(--vscode-font-family);font-size:12px;color:var(--vscode-foreground);background:var(--vscode-sideBar-background)}
.card{padding:10px;border:1px solid var(--vscode-input-border);border-radius:7px;background:var(--vscode-editor-background)}
.title{font-weight:600;margin-bottom:4px}.desc{font-size:11px;color:var(--vscode-descriptionForeground);line-height:1.5;margin-bottom:10px}.row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:9px 0}.row label{flex:1}.row select,.row input[type=number]{width:128px;padding:5px 6px;color:var(--vscode-input-foreground);background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);border-radius:4px}.switch{width:18px;height:18px}.buttons{display:flex;gap:7px;margin-top:10px}.buttons button{flex:1;padding:6px 8px;border:0;border-radius:4px;cursor:pointer;color:var(--vscode-button-foreground);background:var(--vscode-button-background)}.buttons button.secondary{color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground)}.status{margin-top:9px;padding-top:8px;border-top:1px solid var(--vscode-input-border);font-size:11px;color:var(--vscode-descriptionForeground)}.ok{color:var(--vscode-testing-iconPassed)}
</style>
</head>
<body>
<div class="card">
  <div class="title">代码补全增强</div>
  <div class="desc">预设字符现在走 VS Code 原生 typing 流程。这里控制额外的补全兜底；关闭后 VS Code 自己的补全设置仍然生效。</div>
  <div class="row"><label for="enabled">启用补全增强</label><input class="switch" id="enabled" type="checkbox"></div>
  <div class="row"><label for="mode">触发模式</label><select id="mode"><option value="native">仅原生</option><option value="nativeFallback">原生 + 兜底</option><option value="always">持续强制</option></select></div>
  <div class="row"><label for="delayMs">兜底延迟 (ms)</label><input id="delayMs" type="number" min="0" max="500" step="10"></div>
  <div class="row"><label for="triggerPolicy">触发范围</label><select id="triggerPolicy"><option value="identifier">仅标识符</option><option value="code">代码字符（推荐）</option><option value="always">所有字符</option></select></div>
  <div class="row"><label for="syncAcceptedCompletion">接受补全后同步进度</label><input class="switch" id="syncAcceptedCompletion" type="checkbox"></div>
  <div class="row"><label for="diagnostics">诊断日志</label><input class="switch" id="diagnostics" type="checkbox"></div>
  <div class="buttons"><button id="test">测试补全</button><button class="secondary" id="reset">恢复默认</button></div>
  <div class="buttons"><button class="secondary" id="showDiagnostics">查看诊断</button></div>
  <div class="status" id="status">正在读取设置…</div>
</div>
<script>
const vscode=acquireVsCodeApi();
const ids=['enabled','mode','delayMs','triggerPolicy','syncAcceptedCompletion','diagnostics'];
const els=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
let applying=false;
function collect(){return {enabled:els.enabled.checked,mode:els.mode.value,delayMs:Number(els.delayMs.value),triggerPolicy:els.triggerPolicy.value,syncAcceptedCompletion:els.syncAcceptedCompletion.checked,diagnostics:els.diagnostics.checked}}
function save(){if(!applying)vscode.postMessage({type:'setCompletionSettings',settings:collect()})}
ids.forEach(id=>els[id].addEventListener('change',save));
document.getElementById('test').addEventListener('click',()=>vscode.postMessage({type:'testCompletion'}));
document.getElementById('reset').addEventListener('click',()=>vscode.postMessage({type:'resetCompletionSettings'}));
document.getElementById('showDiagnostics').addEventListener('click',()=>vscode.postMessage({type:'showDiagnostics'}));
window.addEventListener('message',event=>{const m=event.data;if(m.type==='updateCompletionSettings'){applying=true;const s=m.settings;els.enabled.checked=s.enabled;els.mode.value=s.mode;els.delayMs.value=String(s.delayMs);els.triggerPolicy.value=s.triggerPolicy;els.syncAcceptedCompletion.checked=s.syncAcceptedCompletion;els.diagnostics.checked=s.diagnostics;document.getElementById('status').textContent=m.mapped?'当前文件已映射，可测试补全':'当前文件未映射；设置会在映射文件中生效';applying=false}else if(m.type==='completionTestResult'){const status=document.getElementById('status');status.textContent=m.ok?'已发送原生补全命令':'补全命令执行失败';status.className='status '+(m.ok?'ok':'')}});
vscode.postMessage({type:'getCompletionSettings'});
</script>
</body>
</html>`;
    }
}
