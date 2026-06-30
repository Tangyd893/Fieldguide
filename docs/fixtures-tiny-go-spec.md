# tests/fixtures/tiny-go 规格

> 版本：v0.1 | 状态：待创建（Phase 1）  
> 用途：Vitest 集成测试与 UA Spike 的**最小 Go 项目** fixture。

---

## 目录结构

```
tests/fixtures/tiny-go/
├── go.mod
├── cmd/
│   └── main.go
├── internal/
│   ├── service/
│   │   └── handler.go
│   └── store/
│       └── db.go
└── README.md                # 一行说明：仅用于 Fieldguide 测试
```

---

## 代码要求

| 文件 | 职责 |
|------|------|
| `cmd/main.go` | `main()`、HTTP 监听或调用 service |
| `internal/service/handler.go` | 业务函数，import store |
| `internal/store/db.go` | 数据访问 |

**行数**：总计 < 150 行（保持索引极速）。

---

## 集成测试断言（实现期）

索引后（`ua/client` 或 Spike 脚本）：

- [ ] 存在 `{fixture}/.understand-anything/knowledge-graph.json`
- [ ] `nodes.length >= 6`（下限，可按实际调整）
- [ ] 存在入口文件相关节点（如含 `main.go` path）
- [ ] import 边连接 main → service → store（若 UA graph 含边）

见 [testing-strategy.md §4](./testing-strategy.md)。

---

## 创建清单

- [ ] 在 Fieldguide 仓库创建 `tests/fixtures/tiny-go/`
- [ ] `go mod init` 可构建
- [ ] 本地 UA 索引一次，确认 graph 符合断言
- [ ] 在 [doc-index.md §5.3](./doc-index.md) 打勾
