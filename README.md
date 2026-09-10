# Fake Type

> VS Code 可重复代码/终端演示工具：预先准备内容，用键盘节奏控制展示过程。

Fake Type 适合课堂教学、产品演示、录屏、培训和可重复的技术展示。v0.2.0 重新接入 VS Code 原生 typing pipeline，让预设输入与 IntelliSense、语言服务和 Tab/Enter 补全更自然地协同工作。

> 在考试、竞赛或其他有明确规则的评测场景中，请先确认规则是否允许使用自动化演示工具。

## v0.2.0 重点更新

### 原生 IntelliSense 输入链路

旧版本直接通过 `TextEditor.edit()` 写入预设字符，这类程序化文档修改不会完整经过 VS Code 的原生键入事件链，因此部分语言的 IntelliSense 不会像正常输入一样触发。

v0.2.0 在 Fake Type 接管物理按键后，把“应该出现的下一个预设字符”交给 VS Code 的 `default:type` 原生编辑器处理器。因此：

- 任意键仍然只输出预设代码
- VS Code 能收到正常的 typing 事件
- JavaScript / TypeScript / Python / C/C++ / HTML / CSS 等语言扩展可以按自己的规则提供补全
- `.` 等语言服务 trigger character 可以正常参与补全
- Tab / Enter 接受补全后，可自动同步 Fake Type 的预设进度

### 侧边栏代码补全控制

左侧 Fake Type 面板新增 **代码补全** 区域，可以直接调整：

- **启用补全增强**：单独开启/关闭 Fake Type 的补全增强；关闭不会关闭 VS Code 自己的 IntelliSense
- **触发模式**
  - `仅原生`：完全依赖 VS Code / 语言扩展自身的 Quick Suggestions
  - `原生 + 兜底`：优先使用原生触发，并在设定延迟后主动调用一次 Suggest（默认，推荐）
  - `持续强制`：对符合条件的输入持续请求 Suggest，适合原生 Quick Suggestions 配置较保守的环境
- **兜底延迟**：0–500 ms，默认 80 ms
- **触发范围**：仅标识符 / 代码字符 / 所有字符
- **接受补全后同步进度**：补全一次插入多个字符时，自动跳过预设中已完成的部分
- **诊断日志**：记录补全触发过程，方便定位语言服务或设置问题
- **测试补全**：直接调用当前编辑器的原生 Suggest 命令，快速判断当前语言环境是否存在可用补全

## 其他功能

### 代码映射

- 为不同文件设置独立的预设代码
- 任意普通按键推进一个预设字符
- 映射和进度自动持久化
- 支持暂停/恢复
- Ctrl+Z 或手动修改后可重新同步进度
- Backspace / Delete 保留原有处理逻辑

### 终端演示

- 自定义终端前缀
- 预设命令与输出
- 使用键盘逐字符推进预设终端内容
- 多条终端内容可依次演示

## 推荐使用方式

1. 安装 Release 中的 `fake-type-0.2.0.vsix`
2. 点击 VS Code 左侧活动栏的 **Fake Type** 图标
3. 在 **代码映射** 中选择目标文件并粘贴预设代码
4. 在 **代码补全** 中保持默认的“原生 + 兜底 / 80ms / 代码字符”
5. 打开目标代码文件并开始输入
6. 补全列表出现时，可正常使用 Tab 或 Enter 接受 VS Code / 语言扩展提供的候选项

## IntelliSense 没有出现时

先打开 **代码补全 → 测试补全**。

如果测试补全本身也没有候选项，通常说明问题来自当前文件语言模式、语言扩展或 VS Code 的 IntelliSense 设置，而不是 Fake Type。可以检查：

- 右下角文件语言模式是否正确
- 对应语言扩展是否已启用
- `editor.quickSuggestions` 是否允许当前上下文显示建议
- `editor.suggestOnTriggerCharacters` 是否启用
- 当前光标位置是否本来就存在可用候选项

如果“测试补全”可以显示候选，但自动输入时没有出现，打开 **诊断日志**，继续输入几次，然后点击 **查看诊断** 检查触发记录。

## 安装

### 从 VSIX 安装

1. 下载 GitHub Release 附件 `fake-type-0.2.0.vsix`
2. 在 VS Code 中打开扩展面板
3. 点击扩展面板右上角 `...`
4. 选择 **从 VSIX 安装...**
5. 选择下载的文件并按提示重新加载

### 从源码构建

```bash
git clone https://github.com/HAOZI-qwq/fake-type.git
cd fake-type
npm ci
npm test
npm run compile
npx --yes @vscode/vsce package
```

## 快捷键

默认：`Ctrl+F2`（macOS 为 `Cmd+F2`）用于暂停/恢复 Fake Type。可以在 VS Code 键盘快捷方式中搜索 `fakeType.toggle` 修改。

## 开发与自动构建

仓库的 GitHub Actions 会自动执行：

```text
npm ci
→ npm test
→ npm run compile
→ VSIX package
→ Upload Artifact
```

`main` 分支首次出现新版本号时，流水线还会创建对应 GitHub Release 并上传版本化 VSIX。

## 许可证

见 [LICENSE](LICENSE)。
