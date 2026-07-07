# Fieldguide

> 把代码库变成可探索、可导览、可提问的知识地图，并与论文 / 文档学习打通，形成「理论 ↔ 实现」的学习闭环。
>
> **图谱用来教，不是用来炫。**

[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](./NOTICE.md)
[![Built on UA](https://img.shields.io/badge/built--on-Understand--Anything-blueviolet)](https://github.com/Egonex-AI/Understand-Anything)

---

## 为什么是 Fieldguide

面向 AI 时代**主动学习前沿技术**的软件开发者——既需要读懂优秀开源项目的工程实践，也需要消化 arXiv 论文与文档中的理论。Fieldguide 不是 IDE 插件、不是学术 citation 工具、也不是单纯的知识图谱可视化，它是**长期陪伴的本地学习工作台**，把三件事串成一条主线：

1. **代码地图**：把陌生仓库拆成入口 → 核心逻辑 → 边界 → 扩展的可导览路径
2. **理论学习**：在同一应用内读 arXiv 论文、做 PDF 笔记、向论文提问
3. **概念桥接**：把论文段落 ↔ 代码节点手动关联起来，生成对照 Tour

**核心约束**：代码地图能力来自 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)（MIT）——复用其 Tree-sitter + 多 Agent 索引流水线与交互式 Dashboard。Fieldguide 不重复造索引轮子，只构建独立的桌面壳、理论学习、概念桥接与跨源 Agent。

---

## 它能做什么

| 模块 | 作用 | 实现来源 | 当前状态 |
|------|------|----------|----------|
| 代码地图 | 交互式知识图谱、架构分层、引导 Tour | **[Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)** | ✅ Phase 1 |
| 项目库 | 多项目 Git clone / 本地文件夹、stale badge | Fieldguide | ✅ Phase 1 |
| 首次引导 | 语言、LLM Key、projectsRoot、Demo 三选一 | Fieldguide | ✅ Phase 1 |
| postMessage 联动 | Dashboard ↔ 壳层节点高亮 / Tour 同步 / Ctrl+K 跳转 | UA + Fieldguide | ✅ Phase 2 |
| LLM 索引 | 文件摘要、架构层检测、Tour 生成（含 heuristic fallback） | UA + Fieldguide | ✅ Phase 2 |
| 理论 Tab | arXiv 搜索、PDF 下载与摘要注入聊天 | Fieldguide | ✅ Phase 3 |
| 概念桥接 | 论文段落 ↔ UA node id 手动关联 | Fieldguide | ✅ Phase 3 |
| 论文 RAG | PDF 分块 + SQLite 向量检索 + `query_paper` + 聊天自动引用 | Fieldguide | ✅ Phase 3.2–3.3 |
| 增量索引 | stale badge + 「更新索引」按钮 | UA + Fieldguide | ✅ Phase 2.7 |
| diff 影响 | 修改文件后高亮受影响节点 | UA + Fieldguide | ⏳ Phase 2.6 |
| NSIS 安装包 | 干净机器可一键安装运行 | Fieldguide | ⏳ Phase 4 |

**已通过的基线**：`pnpm test:unit` → 47 tests pass（config-bridge 10 + graph-reader 16 + IPC 8 + vector 15）。`pnpm typecheck` 三份 tsconfig 均通过。

---

## 快速开始

> 用户视角：装好 → 选项目 → 跟 Tour → 提问。

```bash
# 1. 准备
node -v    # >= 20 LTS
pnpm -v    # >= 9

# 2. clone + 启动
git clone https://github.com/Tangyd893/Fieldguide.git
cd Fieldguide
pnpm install
pnpm dev    # 启动 Electron 桌面应用

# 3. 首次启动向导：选语言 → 配 LLM Key（可跳过）→ 选 Demo / 本地项目
# 4. 索引完成后，在「代码地图」Tab 浏览图谱或跟随 Tour
```

**无 LLM Key 也能用**：UA 会退化为结构图（无摘要 / 无 LLM Tour），仍可浏览节点、边、源码。

**生产构建**：`pnpm dist` → `dist/Fieldguide Setup x.y.z.exe`（NSIS 安装包）。

---

## 技术概要

- **平台**：Windows 桌面（Electron 33）；macOS / Linux 后续评估
- **代码地图**：`@understand-anything/core` + Dashboard 嵌入（iframe + postMessage 桥）
- **Fieldguide 栈**：Electron + React 18 + TypeScript 5.7 + Vite（electron-vite）+ Tailwind
- **数据**：本地优先；配置 / 论文 / 桥接存 `%APPDATA%/Fieldguide/`（SQLite via better-sqlite3）；图谱产物在 `{project}/.understand-anything/`（与 UA 一致）
- **语言**：默认简体中文；支持繁中、en-US（与 UA `zh` / `zh-TW` / `en` 映射）
- **LLM**：OpenAI 兼容 API（用户自配 Key，如 DeepSeek / MiMo / MiniMax）

---

## 项目结构

```
Fieldguide/
├── docs/                       设计文档（见「设计文档」章节）
├── src/
│   ├── main/                   Electron 主进程
│   │   ├── ua/                 UA 集成层（client / dashboard / config-bridge / graph-reader）
│   │   ├── ipc/                IPC handler 聚合
│   │   └── db/                 SQLite 接入
│   ├── preload/                contextBridge 暴露的安全 API
│   ├── renderer/               React UI（顶栏 Tab / Onboarding / Settings / Bridge / Theory …）
│   └── shared/                 三端共用的类型与 IPC schema
├── tests/                      Vitest + 集成测试
├── resources/                  应用图标、安装包资源
├── out/ / dist/                构建产物（git ignored）
└── pnpm-workspace.yaml         引用本地 UA core
```

---

## 设计文档

> 面向开发者 / 贡献者。**用户请看「快速开始」即可。**

| 文档 | 说明 |
|------|------|
| [docs/doc-index.md](docs/doc-index.md) | **文档索引**：地图、决策表、一致性检查、动工门禁 |
| [docs/understand-anything-integration.md](docs/understand-anything-integration.md) | **UA 集成规格**：复用范围、架构、风险、Spike |
| [docs/getting-started.md](docs/getting-started.md) | **动工前引导**：清单、原则、顺序、陷阱、验收 |
| [docs/product-spec.md](docs/product-spec.md) | 产品需求：愿景、用户场景、功能边界、非目标 |
| [docs/architecture.md](docs/architecture.md) | 技术架构：Electron、UA 集成层、数据模型、Agent |
| [docs/ui-spec.md](docs/ui-spec.md) | 界面与交互：布局、图谱、Tour、视觉规范 |
| [docs/roadmap.md](docs/roadmap.md) | 分阶段路线图与验收标准 |
| [docs/todos.md](docs/todos.md) | **工程待办**：下一步任务、优先级与完成状态 |
| [docs/design-review.md](docs/design-review.md) | 设计审视：用户 × 开发者双视角、已决项 |
| [docs/onboarding-spec.md](docs/onboarding-spec.md) | 首次启动引导：语言、项目根目录、Demo |
| [docs/testing-strategy.md](docs/testing-strategy.md) | 测试策略：单测、集成、E2E、验收清单 |
| [docs/spike-ua.md](docs/spike-ua.md) | UA 集成 Spike 记录（Phase 1 动工前必填，硬门禁） |
| [docs/fieldguide-demo-spec.md](docs/fieldguide-demo-spec.md) | 引导用 Demo 仓库规格 |
| [docs/fixtures-tiny-go-spec.md](docs/fixtures-tiny-go-spec.md) | 测试 fixture `tiny-go` 规格 |

**建议阅读顺序**：doc-index → understand-anything-integration → getting-started → product-spec → architecture → ui-spec → roadmap。

---

## 当前状态

**Phase 0 设计** ✅ · **Phase 1 桌面壳 + UA 集成** ✅（≈ 98%）· **Phase 2 智能层** 🔵（≈ 65%）· **Phase 3 理论 + 桥接** 🔵（≈ 70%）· **Phase 4 发布** ⬜（≈ 20%）

### 已完成

- [x] 产品命名与定位（Fieldguide）
- [x] 设计文档全套（含 UA 集成规格、引导、测试策略）
- [x] 技术路线：基于 UA 构建代码地图，不自研索引管线
- [x] Electron 脚手架（electron-vite + pnpm workspace + UA 依赖）
- [x] Phase 1 主体：项目库、结构索引、Dashboard 嵌入、Onboarding、i18n、graph-reader
- [x] Phase 2 LLM 索引（文件摘要、架构层检测、Tour 生成，含 heuristic fallback）
- [x] postMessage 双向通信（节点高亮 / Tour 同步 / Ctrl+K 跳转）
- [x] 桥接 Tab（论文 ↔ 代码概念链接）
- [x] Vitest 单测基线（47 tests 通过，含 vector 模块 15 测试）
- [x] LLM 成本确认对话框（CostDialog）
- [x] PDF 分块 + SQLite 向量 RAG + `query_paper` + 聊天自动 RAG
- [x] `fieldguide-demo` 仓库代码就绪（Go 三层架构，~350 行）

### 进行中 / 待办

- [ ] Phase 2 剩余：diff 集成、领域视图
- [ ] Phase 3 剩余：跨源 Tour + Agent（桥接自动生成）
- [ ] Phase 4：NSIS 安装包实测 + 设置页日志 / 诊断入口 + `icon.ico`

详见 [docs/todos.md](docs/todos.md) 与 [docs/roadmap.md](docs/roadmap.md)。

---

## 动工前（贡献者门禁）

准备写代码时，请先阅读：

1. **[docs/doc-index.md](docs/doc-index.md)** — 文档地图、一致性检查表、动工门禁
2. **[docs/understand-anything-integration.md](docs/understand-anything-integration.md)** — UA 集成边界、数据流、仓库结构
3. **[docs/getting-started.md](docs/getting-started.md)** — 动工清单、Phase 边界、实施顺序
4. 完成 **[docs/spike-ua.md](docs/spike-ua.md)** — UA 集成 Spike（**硬门禁**）

**禁止**：

- 自研 Tree-sitter parser / FileAnalyzer / 独立画布（UA 已有能力）
- 把图谱节点 / 边写入 SQLite（权威源是 `.understand-anything/knowledge-graph.json`）
- 引入与 UA Dashboard 重复的图谱渲染组件

---

## 致谢与许可证

- **代码地图引擎**：[Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) · MIT（上游）
- **Fieldguide**：实现期采用 MIT（与上游一致）；UA 归属保留于 [NOTICE.md](./NOTICE.md)

---

<p align="center">
  <sub>图谱用来教，不是用来炫。 —— Fieldguide</sub>
</p>