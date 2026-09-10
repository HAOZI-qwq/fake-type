import fs from 'node:fs';

const file = 'src/extension.ts';
let source = fs.readFileSync(file, 'utf8');

const oldTypingBlock = `            // 获取下一个要输出的字符
            const nextChar = fileContent.content[fileContent.index];
            fileContent.index++;

            // 插入预备的字符
            const success = await editor.edit(editBuilder => {
                for (const selection of editor.selections) {
                    if (selection.isEmpty) {
                        editBuilder.insert(selection.start, nextChar);
                    } else {
                        editBuilder.replace(selection, nextChar);
                    }
                }
            }, { undoStopBefore: false, undoStopAfter: false });

            if (!success) {
                // 如果编辑失败，回退索引
                fileContent.index--;
            }
`;

const newTypingBlock = `            // 获取下一个要输出的字符
            const nextChar = fileContent.content[fileContent.index];

            // 关键：将预设字符送入 VS Code 原生 typing handler。
            // default:type 与可覆盖的 type 命令共享原始编辑器 Handler，
            // 因此会产生 onDidType/keyboard typing 事件，让 IntelliSense 按原生路径工作。
            try {
                await vscode.commands.executeCommand('default:type', { text: nextChar });
                fileContent.index++;
            } catch (error) {
                console.error('[Fake Type] default:type failed:', error);
                continue;
            }
`;

if (!source.includes(oldTypingBlock)) {
    throw new Error('Expected mapped editor.edit typing block was not found; refusing unsafe patch.');
}
source = source.replace(oldTypingBlock, newTypingBlock);

const anchor = `    // 监听编辑器切换
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            updateStatusBar();
        })
    );
`;

const replacement = `${anchor}
    // 供补全控制器在 Tab/Enter 接受原生补全后立即同步映射进度
    context.subscriptions.push(
        vscode.commands.registerCommand('fakeType.syncCompletionProgress', () => {
            syncContentIndex(false);
        })
    );
`;

if (!source.includes(anchor)) {
    throw new Error('Expected active-editor listener anchor was not found; refusing unsafe patch.');
}
source = source.replace(anchor, replacement);

fs.writeFileSync(file, source);
console.log('Applied Fake Type v0.2.0 native typing patch.');
