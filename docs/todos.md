# Fieldguide 待办清单

> 最后更新：2026-06-30  
> 来源：完成度评估（相对完整路线图约 **55–60%**，Phase 1 MVP 约 **95%**）  
> 产品分阶段任务见 [roadmap.md](./roadmap.md)；本文仅跟踪**下一步工程待办**。

---

## 当前快照

| Phase | 完成度 | 备注 |
|-------|--------|------|
| 0 设计 + Spike | 100% | 文档与 UA 集成 Spike 已通过 |
| 1 桌面壳 + UA | ~95% | 结构索引、Dashboard 嵌入、项目库、Onboarding 已可用 |
| 2 智能层 | ~55% | LLM 配置/聊天/摘要/Tour/postMessage 已实现，diff/增量索引/成本提示待做 |
| 3 理论 + 桥接 | ~45% | arXiv/论文库/桥接 Tab 已实现，LanceDB RAG 未完成 |
| 4 发布 | ~20% | builder 配置有，未实测安装包 |

---

## 待办（按优先级）

### P0 — 解锁核心学习体验

- [x] **p2-ua-llm** · 接入 UA LLM 索引（摘要、Tour、架构分析），扩展 [`src/main/ua/client.ts`](../src/main/ua/client.ts)  
  - Phase 2 · 阻塞「读懂新项目」主链路  
  - 已完成：LLM 文件摘要、架构层检测（layers）、Tour 生成（含 heuristic fallback），batch 3 文件/120s 超时/15KB 截断

- [x] **p2-postmessage** · Dashboard ↔ 壳层 postMessage（节点高亮、Tour 同步、Ctrl+K 跳转）  
  - Phase 2 · 涉及 [`GraphPanel.tsx`](../src/renderer/views/CodeMap/GraphPanel.tsx)、[`App.tsx`](../src/renderer/App.tsx)（现有 TODO）
  - 已完成：双向 postMessage 协议（shell→Dashboard: selectNode/focusNode/startTour 等；Dashboard→shell: nodeSelected/tourStepChanged），通过 dashboard.ts HTML 注入 bridge 脚本

### P1 — Phase 1 收尾 + 冷启动

- [x] **p1-onboarding-demo** · Onboarding Demo 三选一接线 + 创建/对接 `fieldguide-demo` 仓库  
  - [`OnboardingWizard.tsx`](../src/renderer/views/OnboardingWizard.tsx) UI 已有，三选项已接线（demo clone/本地文件夹选择器 dialog/skip）
  - Demo URL: `https://github.com/fieldguide-app/fieldguide-demo`（待仓库创建）

- [x] **p1-phase1-tail** · Phase 1 收尾：本地文件夹选择器、抽取 `graph-reader.ts`  
  - 已完成：`dialog:openFolder` IPC + preload API + 类型定义；[`graph-reader.ts`](../src/main/ua/graph-reader.ts) 提供 loadGraph/getNode/getNeighbors/searchNodes/getNodeSource/isGraphStale/getGraphStats
  - 新增 IPC: `graph:getNode`, `graph:neighbors`, `graph:search`, `graph:getSource`, `graph:stats`

### P2 — 差异化与工程基线

- [x] **p3-bridge-tab** · 顶栏「桥接」Tab 接入 [`ConceptBridge`](../src/renderer/views/Theory/ConceptBridge.tsx)，替换 `App.tsx` 中的 `PlaceholderView`
  - 已完成：[`BridgeView.tsx`](../src/renderer/views/Bridge/BridgeView.tsx) 含论文列表侧栏 + ConceptBridge 面板

- [x] **eng-vitest** · Vitest 单测基线（`ua/client`、graph 读取、IPC 错误路径）  
  - 已完成：32 测试全通过（config-bridge 8 + graph-reader 16 + IPC 8），[`vitest.config.ts`](../vitest.config.ts)

- [ ] **eng-docs-sync** · 同步 [`README.md`](../README.md)、[`roadmap.md`](./roadmap.md) 至 Phase 1 进行中及实际完成项  
  - 🔵 进行中：roadmap.md Phase 状态已更新，todos.md 已完成项已标记

### P3 — Phase 3/4 后续

- [ ] **p3-lancedb** · PDF 分块 + LanceDB 论文 RAG + `query_paper`  
  - Phase 3.2–3.3；当前仅有 arXiv PDF 下载与摘要注入聊天

- [ ] **p4-release** · NSIS 安装包实测 + 设置页日志/诊断入口  
  - [`logger.ts`](../src/main/logger.ts) 已有；设置页未暴露

---

## 维护说明

- 完成一项后，将 `- [ ]` 改为 `- [x]`，并在提交说明中注明 id（如 `p2-ua-llm`）。
- 新增待办请标明优先级（P0–P3）与对应 roadmap 任务 ID。
- 大范围优先级调整时，同步更新本文件与 Cursor 计划中的 todos。
