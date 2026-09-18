/**
 * Regenerate the bundled demo's prebuilt knowledge graph.
 *
 * The Demo must open with a rich graph on a machine with **no LLM key**, so the
 * graph is produced by the real pipeline (structure only, no LLM) and then
 * enriched with the curated notes below. Generating it here — instead of
 * hand-writing JSON — means the shipped demo graph can never drift from what
 * the app actually builds.
 *
 * Why a `.test.ts` under scripts/: it needs the electron mock and vitest's TS
 * pipeline to import main-process code headlessly. vitest.config.ts only
 * includes `src/**\/__tests__\/**\/*.test.ts`, so this never runs in the default
 * suite — it is invoked explicitly:
 *
 *   pnpm regen:sample-graph
 */
import { describe, it, expect, vi } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: () => process.env.TEMP || process.cwd(),
  },
}))

import { indexProject } from '../src/main/ua/client'
import { ensureProjectGraphLayers } from '../src/main/ua/ensure-layers'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const demoRoot = join(repoRoot, 'resources', 'sample-project')
const graphPath = join(demoRoot, '.understand-anything', 'knowledge-graph.json')

/** Curated, offline-friendly metadata: what a reader needs to know at a glance. */
const FILE_NOTES: Record<string, { summary: string; tags: string[]; complexity?: string }> = {
  'cmd/gateway/main.go': {
    summary: 'Entry point: loads config, wires store/cache/worker-pool/services, serves HTTP and shuts down gracefully on SIGINT/SIGTERM. No business rules live here.',
    tags: ['entrypoint', 'wiring', 'graceful-shutdown', 'signal'],
    complexity: 'moderate',
  },
  'internal/config/config.go': {
    summary: 'Environment-driven configuration with safe defaults and a Validate step that rejects unsafe combinations (worker count, queue < batch, unknown log level).',
    tags: ['config', 'env', 'validation', 'defaults'],
  },
  'internal/domain/event.go': {
    summary: 'Innermost layer: the Event type, its Level enum and the Validate invariants. Imports nothing from the repo, so every other layer may depend on it.',
    tags: ['domain', 'invariants', 'validation'],
    complexity: 'simple',
  },
  'internal/store/store.go': {
    summary: 'The persistence boundary: a Store interface plus Query/Stats types. The service layer depends on this interface, not on a backend.',
    tags: ['interface', 'persistence', 'boundary'],
    complexity: 'simple',
  },
  'internal/store/memory.go': {
    summary: 'Bounded in-memory ring buffer holding the newest N events. Carries an explicit tech-debt TODO: one mutex guards reads and writes, so query throughput degrades as batches grow.',
    tags: ['ring-buffer', 'mutex', 'tech-debt', 'bounded-memory'],
    complexity: 'complex',
  },
  'internal/cache/lru.go': {
    summary: 'Concurrency-safe LRU with capacity and TTL limits, built on container/list. Serves repeated reads so the store mutex stays out of the hot path.',
    tags: ['lru', 'ttl', 'cache', 'data-structure'],
    complexity: 'moderate',
  },
  'internal/worker/pool.go': {
    summary: 'Bounded worker pool: N goroutines draining a fixed-size queue, with context cancellation, fast ErrQueueFull back-pressure and submit/process/fail/drop counters.',
    tags: ['worker-pool', 'goroutine', 'back-pressure', 'context'],
    complexity: 'complex',
  },
  'internal/service/ingest.go': {
    summary: 'Write path: validates the batch, deduplicates by event id inside a bounded window, then hands the work to the pool. Partial success is intentional.',
    tags: ['service', 'write-path', 'idempotency', 'dedupe'],
  },
  'internal/service/query.go': {
    summary: 'Read path: cache-aside over the Store interface, with a filter-derived cache key and full invalidation after every write.',
    tags: ['service', 'read-path', 'cache-aside'],
  },
  'internal/httpapi/handlers.go': {
    summary: 'Thin HTTP handlers: decode JSON, call one service method, map domain errors onto status codes (202/400/422/503).',
    tags: ['http', 'handlers', 'status-codes'],
  },
  'internal/httpapi/router.go': {
    summary: 'Routes plus the middleware chain (request id, panic recovery, access log) and a method switch that returns 405 with an Allow header.',
    tags: ['router', 'middleware', 'observability'],
  },
  'internal/httpapi/router_test.go': {
    summary: 'End-to-end HTTP tests over httptest: ingest→list round trip, level defaults, malformed batches, limit validation, 405 handling and /v1/stats shape.',
    tags: ['test', 'httptest', 'integration'],
  },
  'internal/config/config_test.go': {
    summary: 'Tests for environment parsing, defaults, TTL parsing and every Validate rejection path.',
    tags: ['test', 'config'],
    complexity: 'simple',
  },
  'internal/worker/pool_test.go': {
    summary: 'Worker pool tests: drains all jobs, fails fast when the queue is full, counts handler failures, honours a cancelled context and waits on shutdown.',
    tags: ['test', 'concurrency', 'worker-pool'],
  },
  'README.md': {
    summary: 'Project narrative: what pulsegate is, the layer diagram, the write/read data flow, the design trade-offs worth questioning, known tech debt and the config table.',
    tags: ['docs', 'architecture', 'onboarding'],
    complexity: 'simple',
  },
  'Makefile': {
    summary: 'Build helpers: build with an injected version, run, test, vet, gofmt, and a smoke target that boots the server and posts an event.',
    tags: ['build', 'tooling'],
    complexity: 'simple',
  },
}

function fallbackSummary(filePath: string): string {
  const base = filePath.split('/').pop() || filePath
  return `${base} — part of the pulsegate demo.`
}

interface GraphNode {
  id: string
  type?: string
  name?: string
  label?: string
  filePath?: string
  summary?: string
  tags?: string[]
  complexity?: string
  metadata?: Record<string, unknown>
}

interface Graph {
  project?: Record<string, unknown>
  nodes: GraphNode[]
  edges: unknown[]
  layers?: Array<{ id?: string; name: string; description?: string; nodeIds?: string[] }>
  tour?: unknown[]
  [k: string]: unknown
}

/**
 * Architecture layers for the demo.
 *
 * The heuristic detector only labels a handful of files, which makes the layered
 * Dashboard view look empty. These layers follow the real dependency direction
 * (docs & tooling → entry → transport → service → concurrency/cache → store →
 * domain/config) so every node lands in exactly one layer.
 */
const LAYER_PLAN: Array<{ id: string; name: string; description: string; prefixes: string[] }> = [
  {
    id: 'layer:entry',
    name: 'Entry',
    description: '进程入口：只做依赖装配、启动 HTTP、优雅退出，不含业务规则。',
    prefixes: ['cmd/'],
  },
  {
    id: 'layer:transport',
    name: 'Transport',
    description: 'HTTP 边界：路由、中间件（请求 id / recover / 访问日志）、JSON 编解码与状态码映射。',
    prefixes: ['internal/httpapi/'],
  },
  {
    id: 'layer:service',
    name: 'Service',
    description: '业务层：写路径 Ingestor（校验 → 去重 → 投递）与读路径 Querier（cache-aside）。',
    prefixes: ['internal/service/'],
  },
  {
    id: 'layer:concurrency',
    name: 'Concurrency',
    description: '有界 worker pool：队列满即快速失败，而不是把慢存储变成内存增长。',
    prefixes: ['internal/worker/'],
  },
  {
    id: 'layer:cache',
    name: 'Cache',
    description: '带容量与 TTL 限制的 LRU，挡住重复的读请求。',
    prefixes: ['internal/cache/'],
  },
  {
    id: 'layer:persistence',
    name: 'Persistence',
    description: '持久化边界：Store 接口 + 内存环形缓冲实现（含一处并发技术债）。',
    prefixes: ['internal/store/'],
  },
  {
    id: 'layer:domain',
    name: 'Domain',
    description: '最内层：Event 类型与不变量，不依赖本仓库任何其他包。',
    prefixes: ['internal/domain/'],
  },
  {
    id: 'layer:config',
    name: 'Configuration',
    description: '环境变量配置：默认值 + 启动期校验。',
    prefixes: ['internal/config/'],
  },
  {
    id: 'layer:tooling',
    name: 'Docs & Tooling',
    description: '项目说明与构建辅助：先读 README 认识全貌，再顺着分层读代码。',
    prefixes: ['README.md', 'Makefile', 'go.mod'],
  },
]

/** Guided tour through the real data flow; node ids are resolved after indexing. */
const TOUR_PLAN: Array<{ title: string; description: string; match: string[] }> = [  {
    title: '从入口开始',
    description: '先看 cmd/gateway/main.go 是怎么把各层装起来的——它只做装配，不含业务规则。',
    match: ['cmd/gateway/main.go'],
  },
  {
    title: 'HTTP 边界',
    description: 'internal/httpapi 把请求翻译成服务调用：路由、中间件、状态码映射都在这一层。',
    match: ['internal/httpapi/router.go', 'internal/httpapi/handlers.go'],
  },
  {
    title: '写路径：校验与投递',
    description: 'Ingestor 校验事件、按 id 去重，再把批次交给 worker pool——请求不会阻塞在存储上。',
    match: ['internal/service/ingest.go', 'internal/worker/pool.go'],
  },
  {
    title: '数据最终落在哪',
    description: 'Store 接口是持久化边界，内存环形缓冲是演示实现；注意那个 TODO，它标出了并发瓶颈。',
    match: ['internal/store/store.go', 'internal/store/memory.go'],
  },
  {
    title: '读路径：缓存是怎么插进来的',
    description: 'Querier 用 cache-aside 挡在 Store 前面；写入后整体失效，简单但正确。',
    match: ['internal/service/query.go', 'internal/cache/lru.go'],
  },
]

describe('regenerate bundled demo graph', () => {
  it(
    'indexes resources/sample-project and writes an enriched knowledge graph',
    async () => {
      expect(existsSync(demoRoot)).toBe(true)

      const result = await indexProject(
        demoRoot,
        'pulsegate-demo',
        undefined,
        undefined,
        false, // full index
        undefined, // no LLM
        undefined,
        'zh',
      )
      expect(result.success, result.error).toBe(true)
      expect(result.nodeCount).toBeGreaterThan(0)

      await ensureProjectGraphLayers(demoRoot, 'zh')

      const graph = JSON.parse(readFileSync(graphPath, 'utf-8')) as Graph
      expect(graph.nodes.length).toBe(result.nodeCount)

      // Enrich node metadata with the curated notes.
      let enriched = 0
      for (const node of graph.nodes) {
        const filePath = node.filePath || ''
        const note = FILE_NOTES[filePath]
        node.metadata = node.metadata || {}
        if (note) {
          node.metadata.summary = note.summary
          node.metadata.tags = note.tags
          if (note.complexity) node.metadata.complexity = note.complexity
          enriched += 1
        } else if (!node.metadata.summary) {
          node.metadata.summary = fallbackSummary(filePath)
        }
        if (typeof node.metadata.summary === 'string') node.summary = node.metadata.summary
        if (Array.isArray(node.metadata.tags)) node.tags = node.metadata.tags as string[]
        if (typeof node.metadata.complexity === 'string') {
          node.complexity = node.metadata.complexity as string
        }
      }

      // Replace the sparse heuristic layers with the curated architecture layers.
      const assigned = new Set<string>()
      const layers = LAYER_PLAN.map((plan) => {
        const nodeIds = graph.nodes
          .filter((n) => {
            const fp = n.filePath || ''
            return plan.prefixes.some((prefix) => fp === prefix || fp.startsWith(prefix))
          })
          .map((n) => n.id)
        for (const id of nodeIds) assigned.add(id)
        return { id: plan.id, name: plan.name, description: plan.description, nodeIds }
      }).filter((layer) => layer.nodeIds.length > 0)

      // Anything unmatched (stray files) lands in a catch-all so the Dashboard
      // never shows unassigned nodes.
      const leftovers = graph.nodes.filter((n) => !assigned.has(n.id)).map((n) => n.id)
      if (leftovers.length > 0) {
        layers.push({
          id: 'layer:other',
          name: 'Other',
          description: '未归入以上分层的文件。',
          nodeIds: leftovers,
        })
      }
      graph.layers = layers

      // Rebuild the tour, resolving ids that actually exist in this graph.
      const byPath = new Map<string, string>()
      for (const node of graph.nodes) {
        if (node.filePath && node.type === 'file') byPath.set(node.filePath, node.id)
      }

      const steps = TOUR_PLAN.map((plan, index) => {
        const nodeIds = plan.match
          .map((fragment) => {
            if (byPath.has(fragment)) return byPath.get(fragment)!
            for (const [p, id] of byPath) {
              if (p.includes(fragment)) return id
            }
            return undefined
          })
          .filter((id): id is string => Boolean(id))
        return { order: index + 1, title: plan.title, description: plan.description, nodeIds }
      }).filter((step) => step.nodeIds.length > 0)

      graph.tour = [
        {
          id: 'tour:pulsegate-main-flow',
          title: '主数据流：从 HTTP 入口到落库',
          description: '跟着这条路径读完 pulsegate 的核心链路，每一步都说明「为什么这样分层」。',
          steps,
        },
      ]

      writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf-8')

      // The demo must be usable offline: every file node carries a summary,
      // every node sits in a layer, and the tour points at real nodes.
      const fileNodes = graph.nodes.filter((n) => n.type === 'file')
      expect(fileNodes.length).toBeGreaterThan(10)
      expect(fileNodes.every((n) => Boolean(n.metadata?.summary))).toBe(true)
      expect((graph.layers?.length ?? 0)).toBeGreaterThanOrEqual(8)

      const layered = new Set(graph.layers!.flatMap((l) => l.nodeIds ?? []))
      expect(layered.size).toBe(graph.nodes.length)
      expect(steps.length).toBeGreaterThanOrEqual(4)

      const known = new Set(graph.nodes.map((n) => n.id))
      for (const step of steps) {
        for (const id of step.nodeIds) expect(known.has(id)).toBe(true)
      }

      console.log(
        `demo graph: ${graph.nodes.length} nodes / ${graph.edges.length} edges · `
        + `${graph.layers?.length ?? 0} layers · ${steps.length} tour steps · ${enriched} curated notes`,
      )
    },
    180_000,
  )
})
