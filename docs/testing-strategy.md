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

## 七、CI 建议（Phase 1 起）

```yaml
# .github/workflows/test.yml
- cd vendor/Understand-Anything && pnpm --filter @understand-anything/core test  # 或 npm 依赖时跳过
- pnpm run test:unit
- pnpm run test:integration
```

Windows runner 必跑（Electron + UA native 依赖）。

---

## 八、不在范围

- UA parser / Agent 输出质量（依赖上游 + 人工 spot check）
- 重复 UA 已有单测
- LLM 输出质量自动化评分
