# pulsegate

一个用于演示「如何读懂一个陌生仓库」的 Go 示例服务：**事件接入网关**。

它做的事情很小——接收事件、异步落库、按条件查询、暴露统计——但刻意写成了**分层 + 有并发 + 有取舍**的样子：

- 有明确的入口，也有明确的依赖方向；
- 有一条完整的**主数据流**可以顺着读下去；
- 有几处**值得追问的工程决策**（为什么用 worker pool？为什么有 LRU？代价是什么？）；
- 还留着**一处技术债**，用来演示「变更影响分析」。

> 这个项目是 Fieldguide 的内置示例。用 Fieldguide 打开它，可以看到分层图谱、导览，
> 并让学习教练回答「事件从 HTTP 进来之后经过了哪些环节」。

## 快速开始

```bash
make run          # 默认监听 :8080
make test         # 跑单元测试
make smoke        # 起服务 + 灌一条事件 + 打印统计
```

无需任何外部依赖（只用标准库），也没有数据库——数据存在内存环形缓冲里。

## 分层与依赖方向

```
cmd/gateway            ← 入口：装配依赖、启动 HTTP、优雅退出（唯一处理 process 的地方）
   │
   ├── internal/config     ← 配置：环境变量 + 默认值 + 校验
   │
   ├── internal/httpapi    ← 传输层：路由、中间件、JSON 编解码、状态码映射
   │        │
   │        └── internal/service   ← 业务层：写路径（Ingestor）/ 读路径（Querier）
   │                 │
   │                 ├── internal/worker   ← 并发：有界 worker pool
   │                 ├── internal/cache    ← 读优化：带 TTL 的 LRU
   │                 └── internal/store    ← 持久化边界：Store 接口 + 内存实现
   │                          │
   │                          └── internal/domain   ← 最内层：类型与不变量，谁都能依赖它
```

依赖只向内：`domain` 不 import 任何本仓库包，`httpapi` 不直接碰 `store`。

## 主数据流（写路径）

```
POST /v1/events
  → router: requestID → recover → accessLog
  → Handlers.Ingest        解析 JSON，缺省 level=info，交给 domain 校验
  → Ingestor.Accept        校验 → 按 event id 去重 → 投递到 worker pool
  → worker.Pool            有界队列 + N 个 worker（队列满立刻返回 503，而不是无限堆积）
  → store.Memory.Save      写入环形缓冲，超出容量丢弃最旧数据并计数
  → 202 { accepted, duplicates, ids }
```

读路径是对称的：

```
GET /v1/events?level=warn&limit=50
  → Handlers.List → Querier.Recent → cache.LRU 命中则直接返回
                                   → 未命中则 store.Memory.List，并回填缓存
```

写入成功后 `Querier.Invalidate()` 清空缓存——这里选择「简单正确」而不是「精细失效」。

## 可以拿去追问的设计点

| 决策 | 为什么这么做 | 代价 / 追问方向 |
|------|--------------|-----------------|
| 写路径异步入池 | 让 HTTP 请求不阻塞在存储上 | 进程崩溃会丢队列里的事件；如何做到至少一次？ |
| 队列有界 + 快速失败 | 无限队列会把「慢存储」变成「OOM」 | 背压应该暴露给调用方还是内部降级？ |
| 事件 id 去重（LRU 窗口） | 生产者超时重试不应该被重复计数 | 窗口之外的重试会被当成新事件——需要持久化幂等表吗？ |
| 读路径 cache-aside + 全量失效 | 热点轮询便宜，且实现简单 | 写多读少时缓存反而添乱；何时该换成本地快照？ |
| 内存环形缓冲 | 演示不需要部署依赖 | 换 Postgres 时 `Store` 接口够用吗？哪些语义会变？ |
| 每个事件校验而非整批拒绝 | 一条坏数据不应该毁掉整批 | 部分成功对调用方是否更难处理？ |

## 已知技术债

`internal/store/memory.go` 里显式标了一处 `TODO`：读和写共用一把互斥锁，批量增大后查询吞吐会塌。
Fieldguide 的「变更影响分析」可以拿它演示：改这个文件会波及哪些节点。

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/healthz` | 健康检查，返回版本 |
| POST | `/v1/events` | 批量接入事件，`202` 返回 accepted / duplicates / ids |
| GET | `/v1/events` | 查询事件，支持 `source` / `kind` / `level` / `limit`（1–500） |
| GET | `/v1/stats` | 存储聚合 + worker pool 计数 + 缓存命中率 + 运行时长 |

```bash
curl -X POST localhost:8080/v1/events -H 'Content-Type: application/json' -d '[
  {"source":"edge-1","kind":"request","level":"warn","payload":{"path":"/login"}}
]'
curl 'localhost:8080/v1/events?level=warn'
curl localhost:8080/v1/stats
```

## 配置

全部通过环境变量，都有安全默认值（见 `internal/config/config.go`）：

| 变量 | 默认 | 含义 |
|------|------|------|
| `PULSEGATE_ADDR` | `:8080` | 监听地址 |
| `PULSEGATE_WORKERS` | `4` | worker 数量 |
| `PULSEGATE_QUEUE_SIZE` | `256` | 队列长度（必须 ≥ batch size） |
| `PULSEGATE_BATCH_SIZE` | `32` | 单批上限 |
| `PULSEGATE_BUFFER` | `4096` | 内存环形缓冲容量 |
| `PULSEGATE_CACHE_SIZE` | `128` | 读缓存条目数 |
| `PULSEGATE_CACHE_TTL` | `5s` | 读缓存存活时间 |
| `PULSEGATE_SHUTDOWN_TIMEOUT` | `15s` | 优雅退出等待上限 |
| `PULSEGATE_LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

## 测试

```bash
go test ./...
go vet ./...
gofmt -l .        # 应为空
```

覆盖：配置默认值与校验、worker pool 的并发/限流/失败计数/取消语义、
HTTP 层的接入→查询闭环、参数校验、405 与请求 id 中间件行为。
