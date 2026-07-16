# Fieldguide

[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](./NOTICE.md)
[![Built on UA](https://img.shields.io/badge/built--on-Understand--Anything-blueviolet)](https://github.com/Egonex-AI/Understand-Anything)

> Fieldguide 把代码库变成可探索、可导览、可提问的知识地图，并与论文 / 文档学习打通，形成「理论 <-> 实现」的学习闭环。
>
> **图谱用来教，不是用来炫。**

---

## 为什么存在

软件开发者面临一个不对称的困境：**写代码的工具越来越好，但读懂代码的能力没有跟上。**

一个优秀的开源项目摆在面前——几万行代码、几十个模块、散落的文档和 commit 历史。你知道它值得学，但不知道从哪里开始。另一边，arXiv 上的论文解释了这些设计背后的理论，可论文和代码之间隔着一道鸿沟：论文里的公式对应哪段实现？代码里的决策源自哪篇文献？

Fieldguide 的回答是：**不要分开学，把它们放在一起。**

它是一个本地桌面应用，做三件事：

1. **代码地图** — 把陌生仓库拆成可导览的路径：入口 -> 核心逻辑 -> 边界 -> 扩展。不是给你看一张静态架构图，而是带你走一条 Tour。
2. **理论学习** — 在同一个应用里搜 arXiv 论文、读 PDF、向论文提问。不用切窗口，不用复制粘贴。
3. **概念桥接** — 把论文段落和代码节点手动关联起来，生成对照 Tour。读到「Multi-Head Attention」时，一键跳到项目里的实现。

三者串成一条线：**从代码出发发现问题 -> 在论文中找到答案 -> 把答案映射回代码**。

> Fieldguide 不是 IDE 插件，不是学术 citation 工具，也不是单纯的知识图谱可视化。它是长期陪伴的本地学习工作台。

---

## 它最终的样子

想象你面前摊开一本野外指南（field guide）——观鸟的人用它辨认林子里的每一种鸟，植物学家用它对照叶脉和花序。Fieldguide 就是开发者版的野外指南：你打开一个陌生的代码仓库，它告诉你「这是入口，这是心脏，这是边界」；你读到一篇论文，它帮你找到对应的实现。

当前已实现的部分：

- 代码地图（交互式知识图谱 + 引导 Tour）
- 多项目库（Git clone / 本地文件夹管理）
- LLM 索引（文件摘要、架构层检测、Tour 生成）
- 理论 Tab（arXiv 搜索、PDF 阅读与摘要注入聊天）
- 论文 RAG（PDF 分块 + 向量检索 + 聊天自动引用）
- 概念桥接（论文 <-> 代码关联 + 对照 Tour）
- 5 套主题 + 界面缩放 + 双面板布局持久化
- Windows NSIS 安装包

macOS / Linux 支持后续评估。

---

## 架构：拼图，不是造轮子

Fieldguide 的设计哲学是**复用，不重复**。代码地图的核心能力来自 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)（MIT）——它提供 Tree-sitter 解析、多 Agent 索引流水线和交互式 Dashboard。Fieldguide 不自研索引管线，只做三件事：

```
  用户
   |
   v
+-------------------+     postMessage      +------------------+
|   Fieldguide 壳   | <------------------> |  UA Dashboard    |
|   (Electron +     |     iframe 桥接       |  (知识图谱渲染)  |
|    React UI)      |                       +------------------+
|                   |                              ^
|  - 项目库         |        @understand-anything   |
|  - 理论 Tab       |           /core              |
|  - 概念桥接       |        (索引引擎)             |
|  - 设置 / i18n    |                              |
+-------------------+                    +------------------+
                                         |  .understand-anything/
                                         |  knowledge-graph.json
                                         +------------------+
```

- **壳层**（Fieldguide）：Electron + React + TypeScript，负责项目管理、理论学习、桥接、设置、主题
- **图谱层**（UA Dashboard）：嵌入 iframe，通过 postMessage 实现节点高亮、Tour 同步、Ctrl+K 跳转
- **索引层**（UA Core）：Tree-sitter 解析 + LLM 摘要，产物写入 `.understand-anything/knowledge-graph.json`
- **数据层**：本地优先。配置 / 论文 / 桥接存 `%APPDATA%/Fieldguide/`（SQLite）；图谱产物在项目目录内

这种分层意味着：UA 升级时 Fieldguide 跟着受益，Fieldguide 不需要维护图谱渲染的复杂度。

---

## 模块说明

### 代码地图

> 不是给你一张图，是带你走一条路。

基于 Understand-Anything 的索引流水线，把代码仓库解析为知识图谱。交互式 Dashboard 支持节点浏览、架构分层、引导 Tour。无 LLM Key 时退化为结构图（无摘要 / 无 Tour），仍可浏览。

### 项目库

同时管理多个项目——Git clone 或本地文件夹。stale badge 提示索引是否过期，一键更新。

### LLM 索引

文件摘要、架构层检测、Tour 生成。含 heuristic fallback——LLM 不可用时退化为基于结构的启发式 Tour。

### 理论 Tab

在应用内搜索 arXiv 论文、下载 PDF、做笔记、向论文提问。PDF 分块后存入 SQLite 向量库，聊天时自动引用相关段落。

### 概念桥接

手动把论文段落和代码节点关联。AI 可推荐桥接。生成对照 Tour——读论文时看到实现，读代码时看到理论依据。

### 外观与主题

5 套预设（parchment / forest / slate / midnight / paper-dark），界面缩放 50%–200%，UI / 代码字体分开配置，侧栏宽度与布局持久化。

---

## 快速开始

```bash
# 1. 前置条件
node -v    # >= 20 LTS
pnpm -v    # >= 9

# 2. 克隆 + 构建 UA Dashboard
git clone https://github.com/Tangyd893/Fieldguide.git
cd Fieldguide
pnpm bootstrap:ua   # clone UA、构建 Dashboard -> resources/dashboard
pnpm install
pnpm dev            # 启动桌面应用

# 3. 首次启动向导：选语言 -> 配 LLM Key（可跳过）-> 选 Demo / 本地项目
# 4. 索引完成后，在「代码地图」Tab 浏览图谱或跟随 Tour
```

**无 LLM Key 也能用**：UA 退化为结构图，仍可浏览节点、边、源码。

### 仓库布局

`pnpm bootstrap:ua` 会自动准备 sibling UA 并把 Dashboard 复制到本仓库：

```text
D:\workspace\coding\
  Fieldguide\                 <- 本仓库
    resources\dashboard\      <- bootstrap 生成，图谱 iframe 优先加载
  Understand-Anything\        <- sibling（workspace:@understand-anything/core）
```

若启动时提示 Dashboard 不可用，重新执行 `pnpm bootstrap:ua`。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Electron 33 + electron-vite |
| UI | React 18 + TypeScript 5.7 + Tailwind + Radix UI |
| 图谱 | @understand-anything/core + Dashboard (iframe + postMessage) |
| 数据 | SQLite (better-sqlite3) + 本地文件系统 |
| 论文 | pdf-parse + pdfjs-dist + 向量检索 |
| 国际化 | i18next（简中 / 繁中 / en-US） |
| LLM | OpenAI 兼容 API（用户自配 Key） |

---

## 打包（Windows NSIS）

> 工作目录始终是 Fieldguide 根目录。

### 产物

| 产物 | 路径 | 说明 |
|------|------|------|
| 安装包 | `dist\Fieldguide Setup 0.2.0.exe` | 双击安装 |
| 免安装版 | `dist\win-unpacked\Fieldguide.exe` | 直接运行 |

### 标准流程

```powershell
# 1. 确保 Dashboard 已构建
pnpm bootstrap:ua

# 2. 打包（建议先关掉正在运行的 Fieldguide）
pnpm dist
```

`pnpm dist` = `prepare-pack` -> `electron-vite build` -> `electron-builder --win --publish never`。

### 备用流程

`dist\` 被锁 或 node-gyp 找不到 VS 时：

```powershell
node scripts\prepare-pack.mjs
pnpm exec electron-vite build
npx electron-builder --win --publish never --config.directories.output=dist-build --config.npmRebuild=false
```

产物在 `dist-build\`（同结构）。

### 常见问题

| 现象 | 处理 |
|------|------|
| `Dashboard dist not found` | 先跑 Dashboard 的 `npx vite build` |
| `EBUSY` / asar 无法删除 | 关掉 Fieldguide / 资源管理器预览后再 `pnpm dist` |
| `node-gyp` / Visual Studio | 用备用流程（`npmRebuild=false` + `dist-build`） |
| UA commit mismatch 警告 | 可继续；完整校验见 `scripts/prepare-pack.mjs` |

---

## 项目结构

```
Fieldguide/
  docs/                       设计文档
  src/
    main/                     Electron 主进程
      ua/                     UA 集成层（client / dashboard / config-bridge / graph-reader）
      ipc/                    IPC handler 聚合
      db/                     SQLite 接入
    preload/                  contextBridge 暴露的安全 API
    renderer/                 React UI（Tab / Onboarding / Settings / Bridge / Theory ...）
    shared/                   三端共用的类型与 IPC schema
  tests/                      Vitest + 集成测试
  resources/                  应用图标、安装包资源、Dashboard、sample-project
  out/ / dist/ / dist-build/  构建与打包产物（git ignored）
  pnpm-workspace.yaml         引用本地 UA core
```

---

## 当前状态

**Phase 0 设计** ✅ · **Phase 1 桌面壳 + UA 集成** ✅ · **Phase 2 智能层** ✅ · **Phase 3 理论 + 桥接** ✅ · **Phase 4 发布** 🔵

- [x] 产品命名与设计文档全套
- [x] Electron 脚手架 + UA 集成层
- [x] LLM 索引（摘要 / 架构层 / Tour / heuristic fallback）
- [x] postMessage 双向通信（节点高亮 / Tour 同步 / Ctrl+K 跳转）
- [x] 理论 Tab（arXiv 搜索 / PDF 摘要 / RAG）
- [x] 概念桥接（论文 <-> 代码 + AI 推荐 + 对照 Tour）
- [x] Obsidian UX（主题 v2 + 分屏 + 索引进度 + Lucide 图标）
- [x] 三语 i18n
- [x] Vitest 47 tests 通过
- [x] NSIS 安装包可构建
- [ ] Phase 4：干净机器实测 + 场景 A 用户自测（见 `docs/todos.md`）

---

## 设计文档

> 面向贡献者。用户请看「快速开始」即可。

| 文档 | 说明 |
|------|------|
| [doc-index.md](docs/doc-index.md) | 文档地图、一致性检查、动工门禁 |
| [understand-anything-integration.md](docs/understand-anything-integration.md) | UA 集成规格 |
| [getting-started.md](docs/getting-started.md) | 动工前引导 |
| [product-spec.md](docs/product-spec.md) | 产品需求 |
| [architecture.md](docs/architecture.md) | 技术架构 |
| [ui-spec.md](docs/ui-spec.md) | 界面与交互 |
| [roadmap.md](docs/roadmap.md) | 路线图 |
| [todos.md](docs/todos.md) | 工程待办 |
| [design-review.md](docs/design-review.md) | 设计审视 |
| [onboarding-spec.md](docs/onboarding-spec.md) | 首次启动引导 |
| [testing-strategy.md](docs/testing-strategy.md) | 测试策略 |
| [spike-ua.md](docs/spike-ua.md) | UA 集成 Spike |
| [fieldguide-demo-spec.md](docs/fieldguide-demo-spec.md) | Demo 仓库规格 |
| [fixtures-tiny-go-spec.md](docs/fixtures-tiny-go-spec.md) | 测试 fixture 规格 |

建议阅读顺序：doc-index -> understand-anything-integration -> getting-started -> product-spec -> architecture -> ui-spec -> roadmap。

---

## 动工前（贡献者门禁）

准备写代码时，请先阅读：

1. [doc-index.md](docs/doc-index.md) — 文档地图、一致性检查、动工门禁
2. [understand-anything-integration.md](docs/understand-anything-integration.md) — UA 集成边界、数据流
3. [getting-started.md](docs/getting-started.md) — 动工清单、Phase 边界
4. 完成 [spike-ua.md](docs/spike-ua.md) — UA 集成 Spike（**硬门禁**）

**禁止**：

- 自研 Tree-sitter parser / FileAnalyzer / 独立画图谱（UA 已有能力）
- 把图谱节点 / 边写入 SQLite（权威源是 `.understand-anything/knowledge-graph.json`）
- 引入与 UA Dashboard 重复的图谱渲染组件

---

## 致谢与许可

- **代码地图引擎**：[Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) · MIT（上游）
- **Fieldguide**：MIT（与上游一致）；UA 归属保留于 [NOTICE.md](./NOTICE.md)

---

<p align="center">
  <sub>图谱用来教，不是用来炫。 -- Fieldguide</sub>
</p>
