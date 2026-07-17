# 周易宇宙观卦

一个以 Three.js 呈现六十四卦与三钱起卦过程的交互式《周易》应用，包含完整 384 条爻辞、变卦分析，以及通过本机 Grok CLI 生成的结构化 AI 解读。

## 本地运行

需要 Node.js 与已经登录的 `grok` CLI。

```bash
npm install
npm start
```

浏览器访问 `http://127.0.0.1:4173/`。

## macOS 桌面端

开发模式：

```bash
npm run desktop
```

构建 Apple Silicon ARM64 应用：

```bash
npm run build:mac
```

构建结果位于 `dist/mac-arm64/周易宇宙观卦.app`。桌面端会使用随机的本地端口，并自动查找 `~/.local/bin/grok`、`~/.grok/bin/grok`、Homebrew 及系统常见安装位置。

## 项目结构

- `index.html`：完整交互界面、Three.js 场景和易学数据
- `server.mjs`：本地静态服务与 Grok CLI API
- `electron/main.mjs`：macOS 桌面窗口与应用生命周期
- `scripts/generate-icon.swift`：生成 macOS 应用图标

AI 解读用于辅助梳理处境和行动，不作为宿命化预测、医疗诊断或投资指令。
