# Fieldguide

[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](./NOTICE.md)
[![Built on UA](https://img.shields.io/badge/built--on-Understand--Anything-blueviolet)](https://github.com/Egonex-AI/Understand-Anything)

> Fieldguide 是面向**项目学习**的本地桌面应用：用**知识图谱**看清仓库结构，用**问答 Agent**带着你读代码、追链路、连论文。
>
> **图谱用来教，Agent 用来问，目标是学会这个项目。**

---

## 为什么存在

打开一个陌生仓库，常见的卡点不是「缺工具」，而是：

- **不知道从哪读起** — 入口、核心、边界糊成一团
- **看图仍看不懂** — 静态架构图告诉你有什么，不告诉你怎么学
- **问答对不上项目** — 通用聊天不知道你的图谱、Tour 和当前焦点

Fieldguide 把学习压成三件事：

1. **知识图谱** — 把仓库解析成可探索的代码地图：节点、边、架构层、引导 Tour。点节点能跳到源码，顺着依赖走。
2. **问答 Agent** — 内置学习教练（Coach）：带着项目身份、当前焦点与图谱上下文回答「这是干什么的 / 从哪进 / 和谁连」。先给上下文，再按需查图，而不是空聊。
3. **项目学习** — 以「学会这个项目」为主线：多项目库、索引与 Tour、论文与代码概念桥接，把理论与实现放在同一张学习路径上。

> Fieldguide 不是又一个图谱可视化，也不是通用 IDE 聊天。它是**图谱 + Agent + 项目学习**合在一起的本地学习工作台。

---

## 它最终的样子

像一本野外指南：打开陌生仓库，图谱告诉你「入口 / 心脏 / 边界」；卡住时问 Agent，它按你的图与焦点讲解；需要理论时，在同一应用里把论文段落桥接到对应实现。

当前已实现的核心：

- **知识图谱**：交互式代码地图、架构层、Tour、节点 ↔ 源码联动
- **问答 Agent**：学习教练（上下文打包、图谱工具、论文 RAG 引用）
- **项目学习**：多项目库、LLM / 启发式索引、论文阅读与概念桥接
- 5 套主题 + 双面板布局；Windows NSIS 安装包

macOS / Linux 支持后续评估。

---

## 架构：拼图，不是造轮子

图谱与索引能力来自 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)（MIT）。Fieldguide 在其上叠加**项目学习壳**与**问答 Agent**：

```
  用户（学项目 / 问问题）
   |
   v
+-------------------+     postMessage      +------------------+
|   Fieldguide 壳   | <------------------> |  UA Dashboard    |
|   (Electron +     |     iframe 桥接       |  (知识图谱渲染)  |
|    React UI)      |                       +------------------+
|                   |                              ^
|  - 项目库 / 学习  |        @understand-anything   |
|  - 问答 Agent     |           /core              |
|  - 理论 / 桥接    |        (索引引擎)             |
|  - 设置 / i18n    |                              |
+-------------------+                    +------------------+
                                         |  .understand-anything/
                                         |  knowledge-graph.json
                                         +------------------+
```

- **壳层**（Fieldguide）：项目管理、问答 Agent、理论与桥接、设置、主题
- **图谱层**（UA Dashboard）：iframe 渲染；节点选中、Tour、缩放与壳联动
- **索引层**（UA Core）：解析 + LLM 摘要 → `.understand-anything/knowledge-graph.json`
- **数据层**：本地优先（配置 / 论文 / 桥接在 `%APPDATA%/Fieldguide/`；图谱在项目目录）

---

## 模块说明

### 知识图谱

> 不是给你一张图，是带你走一条路。

仓库 → 知识图谱：节点浏览、架构分层、引导 Tour；选中节点可打开对应源码。无 LLM Key 时仍可看结构图。

### 问答 Agent

> 问的是「这个项目」，不是泛泛的代码助手。

学习教练注入项目身份、layers、Tour、当前焦点与图谱检索结果；工具可查邻居、层、Tour 步骤；聊天可引用论文段落。与图谱焦点联动：你在图上点到哪，Agent 就围着哪讲。

### 项目学习

多项目（Git clone / 本地目录）、索引与 stale 提示、启发式 Tour fallback；理论 Tab（arXiv / PDF）与概念桥接，把论文段落和代码节点串成对照学习路径。

### 外观与主题

5 套预设（parchment / forest / slate / midnight / paper-dark），界面缩放 50%–200%，布局持久化。

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
# 4. 索引完成后：在「代码地图」看图谱 / Tour，在聊天里问学习教练
```

**无 LLM Key 也能用**：图谱退化为结构图，仍可浏览节点与源码；配 Key 后 Agent 与摘要/Tour 更完整。

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
| [spike-ua.md](docs/spike-ua.md) | UA 集成 Spike（历史记录） |
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
