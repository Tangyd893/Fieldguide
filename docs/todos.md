# Fieldguide 待办清单

> 最后更新：2026-07-05  
> 来源：完成度评估（相对完整路线图约 **55–60%**，Phase 1 MVP 约 **95%**）  
> 产品分阶段任务见 [roadmap.md](./roadmap.md)；本文仅跟踪**下一步工程待办**。

---

## 当前快照

| Phase | 完成度 | 备注 |
|-------|--------|------|
| 0 设计 + Spike | 100% | 文档与 UA 集成 Spike 已通过 |
| 1 桌面壳 + UA | ~98% | 结构索引、Dashboard 嵌入、项目库、Onboarding 已可用；`fieldguide-demo` 代码就绪待推送 GitHub org |
| 2 智能层 | ~65% | LLM/聊天/Tour/postMessage/CostDialog/增量后端已实现；diff/领域视图待做 |
| 3 理论 + 桥接 | ~70% | arXiv/论文库/桥接 Tab/PDF分块/向量RAG/query_paper 已实现；跨源 Tour/Agent 未做 |
| 4 发布 | ~20% | builder 配置有，`resources/icon.ico` 缺失，未实测安装包 |

---

## 待办（按优先级）

### P0 — 解锁核心学习体验

- [x] **p2-ua-llm** · 接入 UA LLM 索引（摘要、Tour、架构分析），扩展 [`src/main/ua/client.ts`](../src/main/ua/client.ts)  
  - Phase 2 · 阻塞「读懂新项目」主链路  
  - 已完成：LLM 文件摘要、架构层检测（layers）、Tour 生成（含 heuristic fallback），batch 3 文件/120s 超时/15KB 截断

- [x] **p2-postmessage** · Dashboard ↔ 壳层 postMessage（节点高亮、Tour 同步、Ctrl+K 跳转）  
  - Phase 2 · 涉及 [`GraphPanel.tsx`](../src/renderer/views/CodeMap/GraphPanel.tsx)、[`App.tsx`](../src/renderer/App.tsx)  
  - 已完成：双向 postMessage 协议（shell→Dashboard: selectNode/focusNode/startTour 等；Dashboard→shell: nodeSelected/tourStepChanged），通过 dashboard.ts HTML 注入 bridge 脚本

- [x] **p3-lancedb** · PDF 分块 + SQLite 向量检索 + `query_paper`  
  - Phase 3.2–3.3；使用 SQLite (better-sqlite3) 存储向量 + 纯 TS 余弦相似度（替代 LanceDB，避免 electron-rebuild 原生依赖问题）
  - 实现：`src/main/vector/chunk.ts`（pdf-parse + 段落感知分块 512 token/64 重叠）、`src/main/vector/embed.ts`（OpenAI 兼容 /embeddings）、`src/main/vector/index.ts`（SQLite paper_chunks 表 + indexPaper/queryPaper）
  - 新增 IPC：`paper:index`、`paper:query`、`paper:indexStatus`
  - chat:send 自动 RAG：用户提问时自动检索 top-3 相关 chunk 注入 system prompt

### P1 — Phase 1 收尾 + 冷启动

- [x] **p1-onboarding-ui** · Onboarding Demo 三选一 UI 接线  
  - [`OnboardingWizard.tsx`](../src/renderer/views/OnboardingWizard.tsx) 三选项已接线（demo clone / 本地文件夹 dialog / skip）

- [x] **p1-fieldguide-demo** · 创建 `fieldguide-demo` 仓库  
  - Demo URL: `https://github.com/fieldguide-app/fieldguide-demo`（代码已就绪于 `D:\workspace\coding\fieldguide-demo`，待推送至 GitHub org）
  - 规格见 [fieldguide-demo-spec.md](./fieldguide-demo-spec.md)
  - 已完成：Go 三层架构 HTTP 服务（~350 行），标准库实现，go build + go vet 通过

- [x] **p1-phase1-tail** · Phase 1 收尾：本地文件夹选择器、抽取 `graph-reader.ts`  
  - 已完成：`dialog:openFolder` IPC + preload API + 类型定义；[`graph-reader.ts`](../src/main/ua/graph-reader.ts) 提供 loadGraph/getNode/getNeighbors/searchNodes/getNodeSource/isGraphStale/getGraphStats  
  - 新增 IPC: `graph:getNode`, `graph:neighbors`, `graph:search`, `graph:getSource`, `graph:stats`

### P2 — 差异化与工程基线

- [x] **p3-bridge-tab** · 顶栏「桥接」Tab 接入 [`ConceptBridge`](../src/renderer/views/Theory/ConceptBridge.tsx)  
  - 已完成：[`BridgeView.tsx`](../src/renderer/views/Bridge/BridgeView.tsx) 含论文列表侧栏 + ConceptBridge 面板

- [x] **p2-cost-dialog** · LLM 索引成本确认对话框  
  - 已完成：[`CostDialog.tsx`](../src/renderer/views/CostDialog.tsx) 接入 `App.tsx`，全量/跳过 LLM 双模式 + token 预估

- [x] **p2-incremental-partial** · 增量索引（后端 + stale 触发）  
  - 已完成：`client.ts` 增量模式、`ProjectLibrary` stale badge「更新索引」按钮  
  - 待补：ready 状态下手动选择「增量 / 全量」的显式 UI（roadmap 2.7）

- [x] **eng-vitest** · Vitest 单测基线  
  - 已完成：32 测试全通过（config-bridge 8 + graph-reader 16 + IPC 8），[`vitest.config.ts`](../vitest.config.ts)

- [x] **eng-tsconfig** · TypeScript 工程配置分层，消除 TS6305  
  - 已完成：`tsconfig.json`（renderer）+ `tsconfig.node.json`（main/preload/shared）+ `tsconfig.vitest.json`（测试）  
  - `pnpm typecheck` = 依次检查 renderer / main+preload+shared / 测试三份 tsconfig

- [x] **eng-workspace** · pnpm workspace 与目录对齐  
  - 已完成：移除无效的 `src/*` workspace 条目；新增 `resources/` 占位（待补 `icon.ico`）  
  - UA 依赖：`../Understand-Anything/understand-anything-plugin/packages/*`

- [x] **eng-docs-sync** · 同步 [`README.md`](../README.md)、[`roadmap.md`](./roadmap.md)、[`doc-index.md`](./doc-index.md) 至实际完成项  
  - 已完成：更新了 README（状态、测试数、完成/待办列表）、roadmap（Phase 完成度、task 状态标记）、doc-index（demo/fixture 状态）、fieldguide-demo-spec（验收清单）

### P3 — Phase 2/4 后续

- [ ] **p2-diff** · 集成 UA `/understand-diff`（修改文件后影响节点高亮）  
  - roadmap 2.6 / F-11

- [ ] **p2-domain-view** · 领域视图（UA domain Tab 或 Dashboard 内切换）  
  - roadmap 2.10

- [ ] **p3-cross-tour** · 概念桥接 → 对照 Tour 自动生成 + 跨源 Agent  
  - roadmap 3.6–3.8 / F-15

- [ ] **p4-release** · NSIS 安装包实测 + 设置页日志/诊断入口  
  - [`logger.ts`](../src/main/logger.ts) 已有；[`SettingsPanel.tsx`](../src/renderer/views/SettingsPanel.tsx) 未暴露  
  - 阻塞项：补 `resources/icon.ico` 后跑 `pnpm dist`

---

## 目录与配置索引（维护参考）

```
Fieldguide/
├── docs/                    设计文档（入口：doc-index.md）
├── resources/               应用图标、安装包资源（icon.ico 待补）
├── scripts/                 Spike 脚本（spike-electron.mjs 等）
├── src/
│   ├── main/                Electron 主进程
│   │   ├── ua/              UA 集成层（client / dashboard / config-bridge / graph-reader）
│   │   ├── ipc/             IPC handler 聚合（index.ts）
│   │   └── db/              SQLite 接入
│   ├── preload/             contextBridge API
│   ├── renderer/            React UI
│   └── shared/              三端共用类型与 IPC schema
├── tests/fixtures/tiny-go/  测试 fixture（graph JSON + 样例 Go 项目）
├── tsconfig.json            renderer 类型检查
├── tsconfig.node.json       main / preload / shared 类型检查
└── tsconfig.vitest.json     单测类型检查
```

| 命令 | 检查范围 |
|------|----------|
| `pnpm typecheck` | renderer + main/preload/shared + 测试文件 |
| `pnpm test:unit` | `src/**/__tests__/**/*.test.ts` |
| `pnpm dev` | electron-vite 开发（依赖 sibling UA workspace） |

---

## 维护说明

- 完成一项后，将 `- [ ]` 改为 `- [x]`，并在提交说明中注明 id（如 `p2-ua-llm`）。
- 新增待办请标明优先级（P0–P3）与对应 roadmap 任务 ID。
- 大范围优先级调整时，同步更新本文件与 Cursor 计划中的 todos。
- 改 tsconfig / workspace / 目录结构后，跑 `pnpm typecheck && pnpm test:unit` 验证。
