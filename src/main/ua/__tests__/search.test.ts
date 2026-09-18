/**
 * Node search: deterministic substring matcher + backend reporting.
 *
 * The UA `SearchEngine` may or may not load depending on the environment, so these
 * tests assert ranking/limit contracts and backend tagging rather than a fixed backend.
 */
import { describe, it, expect } from 'vitest'
import { substringSearch, searchNodesDetailed, type SearchableNode } from '../search'

function node(id: string, name: string, extra: Partial<SearchableNode> = {}): SearchableNode {
  return {
    id,
    type: extra.type ?? 'function',
    name,
    filePath: extra.filePath,
    summary: extra.summary ?? '',
    tags: extra.tags ?? [],
    complexity: 'moderate',
  }
}

const NODES: SearchableNode[] = [
  node('fn:handleRequest', 'handleRequest', { summary: 'HTTP entry point for auth', filePath: 'internal/http/router.go' }),
  node('fn:handleLogin', 'handleLogin', { summary: 'login handler', filePath: 'internal/http/auth.go' }),
  node('fn:hashPassword', 'hashPassword', { summary: 'bcrypt wrapper', filePath: 'internal/service/user.go' }),
  node('c:TokenStore', 'TokenStore', { type: 'class', summary: 'in-memory token store', filePath: 'internal/store/token.go' }),
  node('f:main.go', 'main.go', { type: 'file', summary: 'process entry, wires handlers', filePath: 'cmd/api/main.go' }),
]

describe('substringSearch', () => {
  it('returns nothing for an empty or whitespace query', () => {
    expect(substringSearch(NODES, '', 10)).toEqual([])
    expect(substringSearch(NODES, '   ', 10)).toEqual([])
  })

  it('ranks exact name match first, then prefix, then contained', () => {
    const hits = substringSearch(NODES, 'handleRequest', 10)
    expect(hits[0].nodeId).toBe('fn:handleRequest')
    expect(hits[0].score).toBe(1)
  })

  it('is case-insensitive and matches summaries/tags', () => {
    const bySummary = substringSearch(NODES, 'bcrypt', 10)
    expect(bySummary.map((h) => h.nodeId)).toEqual(['fn:hashPassword'])

    const upper = substringSearch(NODES, 'HANDLELOGIN', 10)
    expect(upper.map((h) => h.nodeId)).toContain('fn:handleLogin')
  })

  it('honours the limit and stays deterministic across equal scores', () => {
    // 2 prefix hits (handleRequest/handleLogin) + 1 summary-only hit (main.go "handlers")
    const all = substringSearch(NODES, 'handle', 10)
    expect(all.length).toBe(3)

    const limited = substringSearch(NODES, 'handle', 1)
    expect(limited.length).toBe(1)
    // A name-prefix hit must outrank the summary-only hit
    expect(limited[0].score).toBeGreaterThan(all[all.length - 1].score)
    expect(['fn:handleLogin', 'fn:handleRequest']).toContain(limited[0].nodeId)

    // Same input twice → same order (tie-break by nodeId)
    const a = substringSearch(NODES, 'internal', 10).map((h) => h.nodeId)
    const b = substringSearch(NODES, 'internal', 10).map((h) => h.nodeId)
    expect(a).toEqual(b)
  })

  it('returns no hits when nothing matches', () => {
    expect(substringSearch(NODES, 'zzz-not-present', 10)).toEqual([])
  })
})

describe('searchNodesDetailed', () => {
  it('reports a backend for a live query', async () => {
    const { hits, backend } = await searchNodesDetailed(NODES, 'token')
    expect(['ua', 'substring']).toContain(backend)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.map((h) => h.nodeId)).toContain('c:TokenStore')
  })

  it('short-circuits an empty query without touching the engine', async () => {
    const result = await searchNodesDetailed(NODES, '  ')
    expect(result).toEqual({ hits: [], backend: 'substring' })
  })

  it('never returns ids outside the supplied node set', async () => {
    const { hits } = await searchNodesDetailed(NODES, 'auth', 3)
    const ids = new Set(NODES.map((n) => n.id))
    for (const hit of hits) expect(ids.has(hit.nodeId)).toBe(true)
    expect(hits.length).toBeLessThanOrEqual(3)
  })
})
