# Lumina Note：Codex（openai.chatgpt）VS Code 扩展宿主子集计划

目标：在不嵌入 VS Code Workbench 的前提下，在 Lumina Note（Tauri）内以“尽量接近 VS Code/Cursor”的方式运行 `openai.chatgpt` 扩展，实现可登录、可对话、可读取上下文，并可持续扩展到更多 VS Code 扩展。

## 当前状态（已完成的 POC）
- 已能启动 Node 扩展宿主、加载扩展并成功 `activate`（`/health ok:true`）。
- 已能检测到 `chatgpt.sidebarView` 并通过 iframe 加载 webview。
- 仍存在 webview 侧运行时报错（例如 `Cannot read properties of undefined (reading 'plugins')`），导致 UI 不可用。

## VS Code 体验基线（openai.chatgpt v0.5.59）

这些信息来自 `d:\Desktop\Lumina Note\.tmp_codex_ext\openai.chatgpt\extension\package.json`，用于定义“我们要让扩展原样跑起来”的验收基线（不修改扩展本身）。

- 侧边栏入口（Activity Bar）
  - container id：`codexViewContainer`
  - title：`Codex`
  - icon：`resources/blossom-white.svg`
- 视图（Webview View）
  - view id（即本项目里的 `viewType`）：`chatgpt.sidebarView`
  - type：`webview`
  - name：`Codex`
- 相关命令（部分）
  - `chatgpt.openSidebar`：打开侧边栏
  - `chatgpt.openCommandMenu`：打开命令菜单
  - `chatgpt.newCodexPanel` / `chatgpt.newChat`：新建会话/线程（具体 UI 由扩展实现）
- UX 基线（用户视角）
  - 点击侧边栏 Codex 图标后，左侧面板出现 Codex UI（未登录时展示登录按钮）。
  - 点击登录按钮会打开系统默认浏览器完成授权，然后回到应用内完成登录。

---

## 里程碑计划表

> 每个里程碑都包含：范围（Scope）、交付物（Deliverables）、验收方式（How to verify）、预期结果（Expected outcome）。

| Milestone | Scope | Deliverables | How to verify | Expected outcome |
|---|---|---|---|---|
| M0：基线可复现 | 固化复现路径与日志采集 | Codex 面板提供一键复制诊断信息（扩展版本、viewType、host origin、webview URL、最近错误） | Dev 模式下能稳定导出诊断信息 | 任意人可复现并提供足够定位信息 |
| M1：定位 webview 崩溃根因 | 追踪 `plugins` 报错来自哪个资源/初始化逻辑 | 记录 webview 资源加载日志；输出报错对应的 URL/文件名 | 打开 iframe 后可定位到具体报错资源 | 明确“缺哪个注入对象/接口”导致崩溃 |
| M2：webview 加载稳定化 | 解决 404/CSP/资源路径问题 | `/ext/*` 资源服务稳定；`asWebviewUri/baseUri` 重写正确；避免 inline script 触发 CSP | Network 里 `assets/*.js` 全部 200，刷新不随机 404 | webview 稳定加载到可运行状态 |
| M3：补齐 Codex webview 最小宿主注入 | 按 M1 结论补齐 webview 期望的全局/桥接 | 在注入脚本或 `vscode` shim 中补齐对象形状；消息桥语义对齐 | iframe 不再报 `plugins`，UI 至少能渲染壳层/加载态 | Codex UI 从白屏进入可渲染阶段 |
| M4：登录链路（外部浏览器） | 对齐 VS Code：外部浏览器登录 + 回调 | 实现/打通 `vscode.env.openExternal` + `vscode.window.registerUriHandler`；Tauri 注册自定义协议并转发给 Node host | 点登录会打开浏览器；授权后回到 LN 完成登录 | 登录体验接近 VS Code |
| M5：凭据与状态持久化 | 登录态与配置持久化 | `vscode.secrets` 落到系统安全存储；`globalState/workspaceState` 持久化到 `app_data_dir` | 重启后保持登录，不反复要求登录 | 登录/会话稳定可靠 |
| M6：核心使用闭环（聊天可用） | 让 Codex 在 LN 内可持续对话 | 补齐扩展实际调用到的最小 API（commands/config/outputChannel 等）并处理必要通知 | webview 可发送消息并收到回复，常见操作不报错 | 达到“能登录+能聊天+不易崩” |
| M7：上下文接入（文档/选区） | 映射 LN 当前内容到 VS Code 语义 | 实现 `workspace`/`window.activeTextEditor` 的最小映射；将 LN 当前文档/选区喂给扩展（先只读） | Codex 能读取/引用当前笔记内容 | 体验接近“对当前文件/选区提问” |
| M8：产品化 UI（非 Dev 面板） | 从 Debug overlay 迁移到正式入口 | LN 侧边栏新增 Codex 入口；面板可停靠/记忆宽度；视觉风格对齐 | 无需快捷键打开；布局不遮挡；主题一致 | 用户感知为内置功能 |
| M9：扩展兼容层抽象 | 为未来兼容更多扩展做结构准备 | 将 shim 拆成 capability 模块（auth/secrets/workspace/webview/commands）；缺失 API 有清晰诊断 | 新增第二个扩展不需推倒重写 | 代码可维护、可扩展 |
| M10：回归测试与发布准备 | 把关键路径自动化 | vitest 覆盖启动/注入/消息/持久化；Dev/Release 构建检查；错误报告导出 | `npm run test:run` 通过；Release 构建可跑 | 达到可持续迭代工程状态 |

---

## 完成定义（Definition of Done）

当以下条件同时满足，认为“完成”：
1) 用户可在 Lumina Note 中通过侧边栏入口打开 Codex 面板并看到与 VS Code 类似的 UI；
2) 用户可通过外部浏览器完成登录，重启后保持登录；
3) 基础对话可用，且不会因常见交互导致白屏/崩溃；
4) 至少支持读取当前笔记内容/选区的上下文；
5) 有一套最小回归测试覆盖：启动、注入、消息、持久化。

## 风险与注意事项（简要）
- “完全等同 VS Code”的体验在不嵌入 workbench 的前提下很难保证；本计划目标是“可用 + 尽量接近一致”。
- 扩展随版本升级可能引入新的 VS Code API 依赖，需要持续补齐 capability。
- Marketplace 下载在部分网络环境可能失败，需要提供 VSIX 手动导入兜底。
