# 场景 A/B/C 用户自测记录

> 版本：v1.1 | 自动化 smoke：`pnpm qa:scenario` · `pnpm qa:graph` · `pnpm qa:his-go` | 人工验收：见下表

## 自动化 smoke（开发机）

| 日期 | 命令 | 结果 | 备注 |
|------|------|------|------|
| 2026-07-13 | `pnpm qa:scenario` | ✅ 通过 | tiny-go fixture + 模块存在性检查 |
| 2026-07-16 | `node scripts/his-go-smoke.mjs` | ✅ 通过 | HIS-Go: 3656 nodes, 3298 edges, 516 files |
| 2026-07-16 | `pnpm qa:graph` | ✅ 通过 | Demo 13 nodes + Dashboard dist + HIS-Go + bridge 源码接线 |
| 2026-07-16 | `pnpm test:unit`（含 `index-project.test.ts`） | ✅ 83 passed / 2 skipped | **真跑** `indexProject(tiny-go)` 全量 + 零变更增量保节点数 |

### 图谱路径自动验收明细（2026-07-16）

| 检查项 | 结果 |
|--------|------|
| Demo `resources/sample-project` 图谱节点 > 0 | ✅ 13 nodes，13 可点击 filePath |
| UA Dashboard dist（打包或 sibling） | ✅ `dist/win-unpacked/resources/dashboard/index.html` |
| 壳层 `tourStepChanged` / `nodeSelected→openFile` | ✅ 源码接线存在 |
| HIS-Go 图谱 | ✅ 3656 nodes / 3298 edges |
| `indexProject` 写出 `knowledge-graph.json` | ✅ vitest live pipeline |
| 增量零变更不归零 nodeCount | ✅ vitest |
| **iframe 内点击节点 → 打开文件（GUI）** | ⬜ 需人工点一次确认；**根因已修**：UA `window.__uaStore` + 桥接 `getState()`（见 2026-07-16 修复） |

## 场景 A：读懂新项目（30 分钟）

| 步骤 | 验收项 | 自动 | 人工 | 结果 |
|------|--------|------|------|------|
| A1 | 添加本地项目或安装 Demo | — | ⬜ | |
| A2 | 索引完成，节点数 > 0 | ✅ fixture + live index + HIS-Go | ⬜ | 自动侧已通过 |
| A3 | 跟随 Tour 完成至少一条路径 | — | ⬜ | Demo/HIS-Go 当前 Tour 可能为空（无 LLM） |
| A4 | Ctrl+K 搜索节点可跳转 | ✅ search API / HIS-Go handler 141 hits | ⬜ | |
| A5 | 30 分钟内能口述入口、主数据流、3 个精读文件 | — | ⬜ | |

**人工记录**（测试人 / 日期 / 项目名）：

```
测试人：
日期：
项目名：

入口：
主数据流：
精读 3 文件：
Tour 体验：
```

### 用户自测指南（30 分钟）

**准备**：启动 `pnpm dev`，配置 LLM（可选），选 HIS-Go 或 Demo。

| 时间 | 步骤 | 检查点 |
|------|------|--------|
| 0–5 min | 打开项目 / 装 Demo | 项目库有条目 |
| 5–15 min | 代码地图看图谱 | iframe 有节点（非 dashboardUnavailable） |
| 15–20 min | 点击一节点 | 代码面板打开对应文件 |
| 20–30 min | Tour / 搜索 / 口述 | 能说出入口与主链路 |

## 场景 B：论文 ↔ 实现

| 步骤 | 验收项 | 自动 | 人工 | 结果 |
|------|--------|------|------|------|
| B1 | 概念桥接表 / Agent 模块存在 | ✅ qa:scenario | ⬜ | |
| B2 | PDF / 桥接 UI 路径 | — | ⬜ | |

## 场景 C：影响评估

| 步骤 | 验收项 | 自动 | 人工 | 结果 |
|------|--------|------|------|------|
| C1 | diff 模块 + overlay 字段 | ✅ qa:scenario | ⬜ | |
| C2 | index cancel | ✅ | ⬜ | |
| C3 | Dashboard 高亮受影响节点 | ✅ diff 模块 | ⬜ | 需 GUI |

## GUI 最小验收（请勾）

在 `pnpm dev` 或 `dist/win-unpacked/Fieldguide.exe`：

- [ ] 内置 Demo → 代码地图可见节点
- [ ] 点击节点 → 左侧/代码面板打开文件
- [ ]（可选）HIS-Go 打开后节点可点；diff 分析后有高亮
