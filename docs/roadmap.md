# Fieldguide 路线图

> 版本：v0.5 | 状态：Phase 1 完成，Phase 2 智能层近完成，Phase 3 核心链路已通

---

## 总览

| Phase | 名称 | 目标 | 周期（估） | 状态 |
|-------|------|------|-----------|------|
| 0 | 设计 | 产品与技术文档定稿（含 UA 集成） | 1 周 | ✅ 完成 |
| 1 | 桌面壳 + UA 集成 | Electron 脚手架、项目库、嵌入 UA 图谱 | 3–4 周 | ✅ 完成 |
| 2 | 智能层打通 | LLM 配置桥接、Tour/聊天/diff 桌面化 | 3–4 周 | 🔵 近完成 |
| 3 | 理论 + 桥接 | 论文/PDF 与代码对照 | 4–5 周 | 🔵 核心已通 |
| 4 | 发布 | 安装包、体验 polish、上游同步 | 持续 | ⬜ 未开始 |

**原则**：体验打磨优先；**复用 UA 已有能力，不重复造轮子**；每 Phase 结束有可演示的完整用户路径。

**相对 v0.2 的变化**：Phase 1/2 周期缩短——索引、图谱 UI、多 Agent 由 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) 提供。

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
- [x] [fieldguide-demo-spec.md](./fieldguide-demo-spec.md)
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
