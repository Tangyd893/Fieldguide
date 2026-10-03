# Fieldguide 测试策略

> 版本：v0.3 | 状态：设计定稿（Phase 0，已纳入 Understand-Anything 集成）

---

## 一、目标

保证 **UA 集成层**、Fieldguide IPC 契约、论文/桥接逻辑可回归验证。UA core 自带测试（`pnpm --filter @understand-anything/core test`），Fieldguide **不重复测试 parser 细节**。

---

## 二、测试金字塔

| 层级 | 范围 | 工具 | 引入 Phase |
|------|------|------|------------|
| 上游 | UA `@understand-anything/core` | pnpm test（UA 仓库） | Spike |
| 单元 | `ua/client`、config-bridge、graph-reader、IPC 错误 | Vitest | 1 |
| 集成 | fixture 项目 → UA pipeline → JSON 断言 | Vitest + temp dir | 1 |
| IPC | Main handler、`IpcResult` 形状 | Vitest | 1 |
| E2E | 添加项目 → Dashboard 可见 | Playwright + Electron | 1–2 |
| 人工 | 三用户场景 + 最终验收清单 | 每 Phase 结束 | 0+ |

---

## 三、单元测试

### 3.1 UA 集成层

**目录**：`src/main/ua/__tests__/`

| 用例 | 断言 |
|------|------|
| `config-bridge` | Fieldguide `locale` → UA `language` 映射正确 |
| `graph-reader` | 读取 fixture `knowledge-graph.json` 返回元数据 |
| `client` mock | pipeline 调用参数含正确 `root_path` |
| pipeline 失败 | 映射为 `IpcError`（如 `PARSE_ERROR`） |

### 3.2 ~~Tree-sitter Parser~~（已移除）

Parser 与 node ID 规则由 **UA 负责**。Fieldguide 仅对 **UA 官方 fixture graph** 做 smoke 断言（节点数下限、关键 path 存在）。

### 3.3 ~~Node ID 稳定性~~（已移除）

增量索引行为跟随 UA 版本；升级 UA 时跑集成测试回归。

### 3.3 Content Hash / 增量（UA）

| 用例 | 预期 |
|------|------|
| UA 增量模式 | 改 1 文件后重索引，graph 更新且耗时显著低于全量 |

由 UA 保证；Fieldguide 集成测试验证 **触发增量后 JSON mtime 更新**。

### 3.4 IPC 错误形状

**目录**：`src/main/ipc/__tests__/`

- 每个 handler 失败路径返回 `{ ok: false, error: { code, message, retryable } }`
- `retryable` 与 [architecture.md](./architecture.md) §7.5 表一致

---

## 四、集成测试

### 4.1 Fixture

- **代码 fixture**：`tests/fixtures/tiny-go/`（规格 [fixtures-tiny-go-spec.md](./fixtures-tiny-go-spec.md)）
- **图谱 fixture**：从 UA 仓库复制样例 graph，或索引 tiny-go 一次后 commit JSON（小体积）

**目标**：`ua/client` 索引 tiny-go 后：
- 存在 `knowledge-graph.json`
- `nodes.length` ≥ 预期下限
- 含入口文件节点

### 4.2 索引流水线

在 temp 目录复制 fixture → 调用 `ua/client` pipeline → 断言 `knowledge-graph.json` 存在且 nodes 数量合理。

**性能基准**（CI 可选，非阻塞）：
- tiny-go（<500 行）：Parse < 5s

---

## 五、E2E 测试（Phase 2+）

工具：Playwright Electron 模式或 `@playwright/test` + custom fixture。

| 场景 | 步骤 |
|------|------|
| 静态浏览 | 添加 fixture → UA 索引 → Dashboard 节点可见 |
| Tour | mock LLM 或真实 Key → Tour 步骤可播放 |
| 引导 | 清空 config → wizard 完成 |

E2E 不调用真实 LLM；Analyze 阶段 mock 或使用 recorded fixtures。

---

## 六、人工验收

### 6.1 每 Phase Demo 路径

见 [roadmap.md](./roadmap.md) 各 Phase「用户路径（Demo）」。

### 6.2 最终验收（design-review §3.5）

- [ ] 新用户 15 分钟内：添加项目 → 跟完 Tour → 口述主链路
- [ ] 论文段落 ↔ 代码节点 ≤3 次点击
- [ ] 全局搜索 / 聊天一键跳节点
- [ ] 无网络 / 无 API Key 时静态浏览流畅
- [ ] 索引失败、LLM 限流文案可操作
- [ ] 图谱、笔记、桥接重启不丢

---

## 七、评测流水线（C1 / C2 / 答案级）

评测分两层，**只有一层需要 API Key**：

| 层 | 命令 | 需要 Key | 产物 |
|----|------|----------|------|
| 检索层（离线） | `pnpm eval:agent` | 否 | `docs/eval/agent-baseline.md` |
| 答案层（录制 + 离线评分） | `pnpm eval:record-answers` → `pnpm eval:answers` | 录制需要，评分不需要 | `eval/answers/*.json` → `docs/eval/agent-answers.md` |

规则（改动评测时一并遵守）：

1. **数据集是数据，不是代码**：`eval/datasets/*.qa.json`；支持多仓库（`repos` + 逐题 `repo`），
   某仓库不在本机时该数据集标记为「跳过」而不是静默消失，报告里能看见覆盖缺口。
2. **文档由命令生成**：`docs/eval/*.md` 均由脚本重写，禁止手改数字；`formatResultsTable` 必须
   带上该次运行真正的 k，否则 @10 的分表会被标成 @5（已有回归测试）。
3. **回答先录制、后评分**：录制是唯一花钱的步骤，产物提交进仓库；评分在 CI 离线跑，
   因此「引用忠实度 / 幻觉率」这类需要真实回答的指标也进入了可复现范围。
   引用口径写在录制文件的 `citationSemantics` 里：`nodeRefs` 是「Agent 依据的节点」，
   不是「答案正文点名的引用」。
4. **测试仓库本身也要生成得出来**：`pnpm regen:tiny-go-graph` 用真实流水线重建 fixture 图谱，
   并在脚本内断言 `imports` 边数与三条路径的跳数（1 / 1 / 3）——stale fixture 曾导致
   tiny-go 只有 `contains` 边、路径题无解。
5. **指标口径统一**：检索召回与引用召回都按「被满足的期望项（节点 / 文件分别计数）」计算，
   两个指标族因此可比（见 `src/main/eval/metrics.ts` 的注释与 `metrics.test.ts` 的回归用例）。

---

## 八、CI（现状）

`.github/workflows/ci.yml` 在 `windows-latest` 上跑：typecheck → lint → 单测 → `qa:baseline`
→ 场景冒烟 → `pnpm eval:agent`（召回崩塌或路径失效会让 CI 失败），并上传基准报告为构建产物。

**不在 CI**：`pnpm test:e2e`（CI 无法构建 Dashboard dist，会以「环境缺件」恒红）、
`qa:graph` / `qa:his-go`（依赖 sibling 仓库或打包产物）、`pnpm eval:record-answers`（需要 Key 与费用）。

---

## 九、隐私类功能的测试方式（以本地使用日志为例）

本地使用日志（`src/main/usage-log.ts`）的卖点不是功能而是**承诺**，所以它的测试也按承诺来写：

| 承诺 | 怎么测 |
|---|---|
| 默认关闭、关闭时不写盘 | 单测断言日志目录不存在；E2E 断言关闭状态下 `usage:summary.totalEvents === 0` 且导出 0 条 |
| 不记录自由文本 | 单测用"敌意载荷"（未知字段 `content`、超长字符串）断言被丢弃；E2E 把一句话同时塞进未知字段与标识符字段，然后**读取磁盘上真实导出的 Markdown**，断言其中既没有那句话、也没有笔记正文 |
| 标识符字段只放标识符 | 形状校验（拒绝空白/换行/超长），超长标识符**整字段丢弃**而不是截断——截断后的 id 是错 id，比缺失更糟 |
| 崩溃残留可读 | 单测写入一行被截断的 JSONL，断言汇总跳过该行而不是整体失败 |
| 埋点不得影响功能 | 渲染层 `track()` 不 await、不抛错；主进程 `usage:record` 永远返回 ok |

> 这类功能的验收标准是**断言的强度**，而不是"我们小心地写了"。相关 E2E：`e2e/usage.spec.ts`（2 例）。

---

## 十、不在范围

- UA parser / Agent 输出质量（依赖上游 + 人工 spot check）
- 重复 UA 已有单测
- LLM 自由文本质量的自动评分（只评可判定的引用与路径）
