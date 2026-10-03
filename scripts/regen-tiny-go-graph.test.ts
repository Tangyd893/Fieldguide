/**
 * Regenerate the tiny-go fixture's knowledge graph with the real pipeline.
 *
 *   pnpm regen:tiny-go-graph
 *
 * Why this exists:
 *
 * 1. The committed fixture was stale — it held only `contains` edges and **no
 *    import edges at all**, because it predates the Go package-import resolver.
 *    Regenerating it through `indexProject` turns tiny-go into a usable second
 *    benchmark repo: `findPath` can only answer "A 怎么调到 B" when cross-file
 *    edges exist, so a path dataset is impossible on the stale graph.
 * 2. The curated notes below are written in **Chinese** on purpose. The main
 *    benchmark (pulsegate) carries English summaries, which is why Chinese
 *    natural-language questions retrieve poorly there (Recall@5 12.8%). Keeping
 *    one small repo indexed in Chinese gives the thesis a controlled contrast:
 *    same question set, same retrieval code, different index language.
 *
 * Structure-only, no LLM: the fixture must regenerate offline and deterministically.
 * `analyzedAt` is the one volatile field (it changes on every regen).
 */
import { describe, it, expect, vi } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: () => process.env.TEMP || process.cwd(),
  },
}))

import { indexProject } from '../src/main/ua/client'
import { loadGraph, findPath } from '../src/main/ua/graph-reader'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = join(repoRoot, 'tests', 'fixtures', 'tiny-go')
const graphPath = join(fixtureRoot, '.understand-anything', 'knowledge-graph.json')

/** Curated Chinese notes: what a reader needs to know, offline and no LLM. */
const FILE_NOTES: Record<string, { summary: string; tags: string[]; complexity?: string }> = {
  'cmd/main.go': {
    summary: '程序入口：构造内存存储，注入 HTTP 处理器，注册 /hello 与 /items 两个路由并启动监听。只做装配，不含业务规则。',
    tags: ['入口', '装配', '路由注册', 'http'],
    complexity: 'moderate',
  },
  'internal/service/handler.go': {
    summary: '服务层：Handler 持有存储接口，Hello 返回问候语，ListItems 把存储中的数据编码成 JSON 返回。',
    tags: ['服务层', '处理器', 'json', 'http'],
    complexity: 'moderate',
  },
  'internal/store/db.go': {
    summary: '存储层：内存数据存储，用读写锁保护切片；NewDB 预置两条记录，All 返回切片副本以避免调用方改到内部状态。',
    tags: ['存储层', '读写锁', '内存', '并发安全'],
    complexity: 'moderate',
  },
}

/** Symbol-level notes, keyed by node id (asserted to exist, so drift fails loudly). */
const SYMBOL_NOTES: Record<string, { summary: string; tags: string[] }> = {
  'function:cmd/main.go:main': {
    summary: '创建存储与处理器，注册路由，阻塞在 HTTP 监听上。',
    tags: ['入口', '装配'],
  },
  'class:internal/service/handler.go:Handler': {
    summary: '处理器类型，依赖存储接口，便于替换实现。',
    tags: ['服务层', '依赖注入'],
  },
  'function:internal/service/handler.go:NewHandler': {
    summary: '处理器构造函数，注入存储依赖。',
    tags: ['服务层', '构造函数'],
  },
  'function:internal/service/handler.go:Hello': {
    summary: '读取查询参数 name，缺省为 World，向响应写入问候语。',
    tags: ['http', '查询参数'],
  },
  'function:internal/service/handler.go:ListItems': {
    summary: '调用存储的 All 取数据，设置 Content-Type 后编码为 JSON。',
    tags: ['http', 'json', '读取路径'],
  },
  'class:internal/store/db.go:Item': {
    summary: '存储记录类型，带 JSON 标签。',
    tags: ['数据模型'],
  },
  'class:internal/store/db.go:DB': {
    summary: '内存存储类型：读写锁 + 记录切片。',
    tags: ['存储层', '并发安全'],
  },
  'function:internal/store/db.go:NewDB': {
    summary: '构造存储并预置两条示例记录。',
    tags: ['存储层', '构造函数'],
  },
  'function:internal/store/db.go:All': {
    summary: '加读锁后复制切片返回，保证调用方不会改到内部状态。',
    tags: ['存储层', '读取路径', '切片副本'],
  },
}

describe('tiny-go fixture graph', () => {
  it(
    're-indexes the fixture with the real pipeline and re-applies curated Chinese notes',
    async () => {
      const result = await indexProject(
        fixtureRoot,
        'tiny-go',
        undefined,
        undefined,
        false, // full index
        undefined, // no LLM — offline and deterministic
        undefined,
        'zh',
      )
      expect(result.success, result.error).toBe(true)

      const graph = JSON.parse(readFileSync(graphPath, 'utf-8')) as {
        nodes: Array<Record<string, unknown> & { id: string; type?: string; filePath?: string }>
        edges: Array<{ source: string; target: string; type?: string }>
        layers?: unknown[]
        tour?: unknown[]
      }

      // The whole point of regenerating: Go package imports must now produce
      // cross-file edges, otherwise path questions are unanswerable here.
      // NOTE: the persisted edge type is `imports` (UA GraphBuilder naming), not
      // `import` as some docs claim — graph algorithms must stay type-agnostic.
      const importEdges = graph.edges.filter((e) => String(e.type ?? '').startsWith('import'))
      expect(importEdges.length, 'no import edges — Go module-path resolution regressed').toBeGreaterThanOrEqual(3)
      expect(graph.edges.every((e) => e.source && e.target)).toBe(true)
      expect(graph.nodes.length).toBeGreaterThanOrEqual(13)

      // Curated notes must all land; a mismatch means node ids drifted.
      const byId = new Map(graph.nodes.map((n) => [n.id, n]))
      const byFile = new Map(graph.nodes.map((n) => [String(n.filePath ?? ''), n]))

      for (const [filePath, note] of Object.entries(FILE_NOTES)) {
        const node = byFile.get(filePath)
        expect(node, `no node for ${filePath}`).toBeDefined()
        node!.summary = note.summary
        node!.tags = note.tags
        if (note.complexity) node!.complexity = note.complexity
      }
      for (const [id, note] of Object.entries(SYMBOL_NOTES)) {
        const node = byId.get(id)
        expect(node, `no node for ${id}`).toBeDefined()
        node!.summary = note.summary
        node!.tags = note.tags
      }

      writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf-8')

      // Path queries the dataset depends on — verified here so the dataset can't
      // reference a route the graph does not actually have.
      const reloaded = loadGraph(fixtureRoot)
      expect(reloaded).not.toBeNull()
      const routes: Array<[string, string, number]> = [
        ['file:cmd/main.go', 'file:internal/store/db.go', 1],
        ['file:internal/service/handler.go', 'file:internal/store/db.go', 1],
        ['function:cmd/main.go:main', 'class:internal/store/db.go:DB', 3],
      ]
      for (const [from, to, hops] of routes) {
        const path = findPath(reloaded!, from, to, 12)
        expect(path.found, `no path ${from} → ${to}`).toBe(true)
        expect(path.hops, `hops ${from} → ${to}`).toBe(hops)
      }

      console.log(
        `\n[tiny-go] nodes=${graph.nodes.length} edges=${graph.edges.length} imports=${importEdges.length} → ${graphPath}`,
      )
    },
    180_000,
  )
})
