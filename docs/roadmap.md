# Fieldguide 路线图

> 版本：v0.7 | 状态：Phase 1–3 完成，Phase 4 发布验收中；Phase 5 理解工作台（分屏面板 + 架构/知识/面试）与 Phase 6 Obsidian 联动（F-17）进行中

---

## 总览

| Phase | 名称 | 目标 | 周期（估） | 状态 |
|-------|------|------|-----------|------|
| 0 | 设计 | 产品与技术文档定稿（含 UA 集成） | 1 周 | ✅ 完成 |
| 1 | 桌面壳 + UA 集成 | Electron 脚手架、项目库、嵌入 UA 图谱 | 3–4 周 | ✅ 完成 |
| 2 | 智能层打通 | LLM 配置桥接、Tour/聊天/diff 桌面化 | 3–4 周 | 🔵 近完成 |
| 3 | 理论 + 桥接 | 论文/PDF 与代码对照 | 4–5 周 | 🔵 核心已通 |
| 4 | 发布 | 安装包、体验 polish、上游同步 | 持续 | 🔵 进行中（与 Phase 5 错峰） |
| 5 | 理解工作台 | 架构总览 / 知识 / 面试面板 + 布局预设 + 渐进分析 | 6–8 周 | 🔵 进行中 |
| 6 | Obsidian 联动 | vault CLI 门禁 + 卡片/索引单向同步 + Agent 回读（F-17） | 3–4 周 | 🔵 进行中（已实现 P0–P3，文档 P4） |

**原则**：体验打磨优先；**复用 UA 已有能力，不重复造轮子**；Fieldguide **保持产品独立**（默认不耦合 Obsidian / 外部 PKB；Phase 6 起可由用户显式绑定一个 vault 做单向导出，随时可解绑）；每 Phase 结束有可演示的完整用户路径。

**相对 v0.2 的变化**：Phase 1/2 周期缩短——索引、图谱 UI、多 Agent 由 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) 提供。

---

## Phase 6 — Obsidian 联动（F-17）

### 目标

用户在设置页**显式绑定**一个 Obsidian vault，把项目拆解产物单向导出为 Markdown 卡片与索引（MOC）到 `<vault>/<folder>/<project>/`；应用内知识仍是唯一事实来源。绑定与新建 vault 均以**官方 Obsidian CLI** 可用为前提（`obsidian` / `Obsidian.com`，需 1.12.7+ 安装器、设置 → General 中启用 CLI、且 Obsidian 正在运行）。

### 任务

| ID | 任务 | 验收标准 |
|----|------|---------|
| 6.0 | 设置页 Obsidian 分类 + CLI 门禁 | CLI 三态（可用/未安装/Obsidian 未运行）可见；不可用时「选择目录」「新建 vault」禁用并给出修复步骤 |
| 6.1 | vault 选择 / 新建 / 注册引导 | 选择目录与新建 vault 均先校验 CLI；新建后轮询 `obsidian vaults` 直到 Obsidian 识别 |
| 6.2 | 卡片与索引同步引擎 | dry-run 预览；托管块 + 内容 hash；用户改动不被覆盖；二次同步 0 写入 |
| 6.3 | Vault 面板 + 冲突处理 | 卡片状态（已同步/你已修改/需要处理/缺失）可见；冲突三选一；清理只删未被改动的文件 |
| 6.4 | Agent vault 工具与回读 | 未绑定 vault 时工具不出现在 tool schema；批注可被引用 |

### 刻意不做

- 双向同步（Obsidian 侧改动只回读为上下文，不合并进 SQLite）
- 接管 Obsidian 自身配置（`obsidian.json` 等）
- Dataview / Bases / 插件依赖
- 移动端、每项目独立 vault、每个图节点一条笔记

---

## Phase 5 — 理解工作台（Architecture / Knowledge / Interview）

### 目标

把 Refactor Guide 三大能力落地为**应用内面板 + 分析产物**，用户通过有限分屏搭配理解项目。

### 任务

| ID | 任务 | 验收标准 |
|----|------|---------|
| 5.0 | 面板契约 + 布局预设 + 文档 | `PanelTab` 含 overview/knowledge/interview；旧布局可迁移；明确无 Obsidian 同步 |
| 5.1 | ArchitectureSummary + overview 面板 | Demo/tiny-go 可说入口、分层、主数据流 |
| 5.2 | knowledge_nodes + knowledge 面板 | 索引后可见知识卡；可跳转代码节点 |
| 5.3 | interview_questions + interview 面板 | 抽题 → 对照答案 → 跳转知识/代码 |
| 5.4 | 渐进四阶段进度 + 推荐搭配 | 无 Key 启发式；有 Key 可跑满；预设一键恢复 |

### 刻意不做

- 双向同步 / Dataview 依赖 / 移动端 / 每项目独立 vault
- 无限面板插件生态
- 完整 UA domain / graph-reviewer（除非直接服务 overview）

---

## Phase 0 — 设计 ✅

### 交付物

- [x] [README.md](../README.md)
- [x] [understand-anything-integration.md](./understand-anything-integration.md)
- [x] [product-spec.md](./product-spec.md)
- [x] [architecture.md](./architecture.md)
- [x] [ui-spec.md](./ui-spec.md)
- [x] [roadmap.md](./roadmap.md)
- [x] [design-review.md](./design-review.md)
- [x] [onboarding-spec.md](./onboarding-spec.md)
- [x] [testing-strategy.md](./testing-strategy.md)
- [x] [doc-index.md](./doc-index.md)
- [x] [spike-ua.md](./spike-ua.md)（模板）
- [x] 内置 `resources/sample-project/` Demo（取代独立 fieldguide-demo 仓库规格）
- [x] [fixtures-tiny-go-spec.md](./fixtures-tiny-go-spec.md)
- [x] [../NOTICE.md](../NOTICE.md)

### 验收

- 文档覆盖：愿景、UA 集成、架构、UI、阶段边界
- 明确 UA 复用边界与 Fieldguide 自建边界
- 产品名 Fieldguide 定稿

### 下一步

Phase 1 第 0 周：UA 集成 Spike → 任务 1.0 / 1.1

---

## Phase 1 — 桌面壳 + UA 集成

### 目标

用户能添加项目，通过 UA pipeline 完成索引，在嵌入的 UA Dashboard 中浏览知识图谱；Fieldguide 提供项目库、引导与桌面壳——**不自研 parser/图谱渲染**。

### 任务

| ID | 任务 | 验收标准 |
|----|------|---------|
| 0.0 | **UA 集成 Spike** | core pipeline + Dashboard 在 Electron 中可加载；见 integration §九 |
| 1.0 | 首次引导 wizard + locale | 四步 wizard；locale 同步 `ua.language` |
| 1.1 | Electron + electron-vite + pnpm workspace + UA 依赖 | `pnpm dev` 启动；UA core 可 import |
| 1.2 | 顶栏 Tab + 项目库 + 代码地图容器 | 符合 ui-spec；中央预留 Dashboard 嵌入区 |
| 1.3 | SQLite（projects/index_jobs）+ config 读写 | 重启后配置持久化 |
| 1.4 | 添加本地项目 + Git clone | Git 默认 `{projectsRoot}/{slug}/` |
| 1.5 | `ua/client.ts` 封装 pipeline | 触发索引 → `{root}/.understand-anything/knowledge-graph.json` |
| 1.6 | `index:progress` IPC | 转发 UA 进度到状态栏 |
| 1.7 | 嵌入 UA Dashboard | 缩放、平移、选中节点可用 |
| 1.8 | `graph-reader.ts` + `graph:get` IPC | 从 JSON 读取图谱元数据供壳层使用 |
| 1.9 | i18n 三语 Fieldguide shell | 简中/繁中/en-US |
| 1.10 | `src/shared/` IPC 类型 + IpcResult | 三端共用 |
| 1.11 | stale badge | 对比图谱 indexedAt 与源码 mtime |

### 用户路径（Demo）

1. 首次启动 → 引导（语言 + projectsRoot + Demo）
2. 触发 UA 索引（有 Key 时含摘要/Tour；无 Key 时结构图）
3. 打开代码地图 → UA Dashboard 展示节点与边
4. 点击节点 → Dashboard 内查看源码与关系

### 验收标准

- [x] `fieldguide-demo` 或 tiny-go：索引成功并生成 `knowledge-graph.json`
- [ ] Dashboard 首屏 < 3 秒
- [ ] 无 API Key 时仍可浏览结构图（UA 静态能力）
- [ ] 崩溃重启后项目列表保留

### 不在 Phase 1

- 自研 Tree-sitter parser
- 理论模块、概念桥接
- 论文 LanceDB

---

## Phase 2 — 智能层桌面化

### 目标

在桌面环境中完整使用 UA 智能能力：摘要、Tour、代码问答、diff；Fieldguide 负责 LLM 配置桥接与壳层联动。

### 任务

| ID | 任务 | 验收标准 |
|----|------|---------|
| 2.1 | `config-bridge.ts` LLM 同步至 UA | ✅ 设置页测试连接后 UA 索引可用 |
| 2.2 | locale → UA language 映射 | ✅ 简中 UI + 中文摘要/Tour |
| 2.3 | Tour 在 Dashboard 内可播放 | ✅ LLM 生成 Tour，Dashboard 内可导航 |
| 2.4 | 集成 UA 代码问答 | ✅ 右栏 ChatPanel 提问有节点引用 |
| 2.5 | 语义搜索可用 | ✅ NodeSearchBar 搜索函数/类/文件 |
| 2.6 | `/understand-diff` 等价集成 | 修改文件后影响节点高亮 |
| 2.7 | 增量索引 UI | ✅ 「更新索引」仅处理变更文件；stale badge |
| 2.8 | LLM 成本提示 | ✅ CostDialog 全量/跳过双模式 + token 预估 |
| 2.9 | 左栏 Tour 列表与 Dashboard 联动 | ✅ postMessage 同步当前步骤 |
| 2.10 | 领域视图（UA domain） | 业务域 Tab 或 Dashboard 内切换 |
| 2.11 | Ctrl+K 跳节点 / 开始 Tour | ✅ Ctrl+K 搜索节点 + postMessage 通知 Dashboard |

### 用户路径（Demo）

1. 配置 API Key → 深度索引 demo 项目
2. 跟随 Tour「入口 → 核心逻辑」
3. 提问：「认证在哪？」→ 跳转节点

### 验收标准

- [ ] 30 分钟内口述主链路（用户自测）
- [ ] API 失败有明确提示
- [ ] **未自研 FileAnalyzer 等 Agent**（code review 检查）

---

## Phase 3 — 理论 + 桥接

### 目标

论文与代码在同一应用内对照学习（**Fieldguide 核心差异化，UA 不覆盖**）。

### 任务

| ID | 任务 | 验收标准 |
|----|------|---------|
| 3.1 | arXiv API 搜索 + 论文库 | 搜索「RAG」可收藏 |
| 3.2 | PDF 导入 + 分块 + 向量存储 | ✅ 10MB PDF < 1 分钟；SQLite 替代 LanceDB |
| 3.3 | 论文 RAG + query_paper | ✅ 命中正确段落；chat:send 自动 RAG |
| 3.4 | PDF 阅读器 + 笔记 | 高亮持久化 |
| 3.5 | 概念桥接 UI + concept_links | ✅ 手动关联论文段落与 UA node id |
| 3.6 | 扩展 Agent：link_concept + 对照 Tour | ≥3 步对照 Tour |
| 3.7 | 理论 Tab 与代码地图平等导航 | 顶栏无主次差异 |
| 3.8 | 跨源 Agent | 同时引用论文 chunk 与代码节点 |

### 用户路径（Demo）

1. 导入 RAG 相关 PDF
2. 索引相关开源仓库（UA）
3. 桥接：论文段落 ↔ splitter 代码节点
4. 生成对照 Tour

### 验收标准

- [ ] 论文 RAG 3 组人工问题命中预期
- [ ] 完整「概念 ↔ 实现」Tour 可播放
- [ ] 桥接数据重启保留

---

## Phase 4 — 发布与打磨

### 目标

可安装的 Windows 版本；UA 上游版本锁定与更新策略落地。

### 任务

| ID | 任务 | 验收标准 |
|----|------|---------|
| 4.1 | electron-builder NSIS | 干净机器可安装运行 |
| 4.2 | UA 版本锁定 + 更新文档 | package.json / submodule pin |
| 4.3 | i18n 文案 polish | 三语补全 |
| 4.4 | `fieldguide-demo` 就绪 | 引导可一键体验 |
| 4.5 | 日志 + 索引统计 | 设置页可排查 |
| 4.6 | Dashboard 主题与 Fieldguide 统一（可选） | 视觉割裂减轻 |
| 4.7 | EPUB / Markdown（可选） | 按需求评估 |

### 验收标准

- [ ] Win10/11 无开发环境可运行
- [ ] 关于页注明 UA 归属（MIT）
- [ ] 卸载可选保留 `%APPDATA%/Fieldguide`

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| UA core API 不稳定 | 集成阻塞 | Phase 1 第 0 周 Spike；submodule pin |
| Dashboard 嵌入体验割裂 | 产品感差 | Phase 2 主题统一；长期评估组件移植 |
| UA 大版本 breaking | 维护成本 | 锁定版本；集成测试 fixture |
| LLM 成本 | 用户顾虑 | UA 增量 + 成本对话框 |
| 范围蔓延 | 延期 | 禁止自研 UA 已有模块 |

---

## 里程碑时间线（参考）

```
Week 1        Phase 0 设计 ✅
Week 2        Phase 1 Spike + 脚手架
Week 3-5      Phase 1 UA 集成 + 项目库
Week 6-9      Phase 2 智能层桌面化
Week 10-14    Phase 3 理论桥接
Week 15+      Phase 4 发布
```

---

## Phase 1 启动清单

- [x] 设计文档定稿（含 UA 集成）
- [x] clone [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)，完成 Spike（integration §九）
- [x] Node.js LTS + pnpm + Windows 构建环境
- [x] Git 仓库 init（Fieldguide 目录）
- [x] `fieldguide-demo` 仓库创建（代码就绪，待推送 GitHub org）

确认后执行 **0.0 Spike** → **1.1 脚手架**。详见 [getting-started.md](./getting-started.md)。
