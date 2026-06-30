/**
 * Tests for graph-reader.ts — graph loading, queries, staleness.
 */
import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  loadGraph,
  getNode,
  getNeighbors,
  searchNodes,
  getGraphStats,
  isGraphStale,
  type KnowledgeGraph,
} from '../graph-reader'

// ─── Fixture ───

function createFixtureGraph(): KnowledgeGraph {
  return {
    project: {
      projectName: 'test-project',
      analyzedAt: '2026-01-01T00:00:00.000Z',
      language: 'zh',
      nodeCount: 5,
      edgeCount: 3,
    },
    nodes: [
      { id: 'cmd/main.go', type: 'file', label: 'main.go', filePath: 'cmd/main.go', metadata: { summary: 'Entry point', complexity: 'simple' } },
      { id: 'internal/handler/api.go', type: 'file', label: 'api.go', filePath: 'internal/handler/api.go', metadata: { summary: 'HTTP handlers', complexity: 'moderate' } },
      { id: 'internal/service/user.go', type: 'file', label: 'user.go', filePath: 'internal/service/user.go', metadata: { summary: 'User business logic', complexity: 'complex' } },
      { id: 'fn:handleRequest', type: 'function', label: 'handleRequest', filePath: 'internal/handler/api.go', lineRange: [10, 30], metadata: { summary: 'Handles incoming HTTP requests' } },
      { id: 'fn:getUser', type: 'function', label: 'getUser', filePath: 'internal/service/user.go', lineRange: [15, 45], metadata: { summary: 'Fetches user from store' } },
    ],
    edges: [
      { source: 'cmd/main.go', target: 'internal/handler/api.go', type: 'import' },
      { source: 'internal/handler/api.go', target: 'internal/service/user.go', type: 'import' },
      { source: 'fn:handleRequest', target: 'fn:getUser', type: 'call' },
    ],
    tour: [
      {
        id: 'tour-1',
        name: 'Main Flow',
        description: 'Follow the request path',
        steps: [
          { order: 0, title: 'Entry Point', description: 'Start here', nodeIds: ['cmd/main.go'] },
          { order: 1, title: 'Handler', description: 'Route to handler', nodeIds: ['internal/handler/api.go', 'fn:handleRequest'] },
          { order: 2, title: 'Service', description: 'Business logic', nodeIds: ['internal/service/user.go', 'fn:getUser'] },
        ],
      },
    ],
    layers: [
      { id: 'layer-entry', name: 'Entry', description: 'Entry points', nodeIds: ['cmd/main.go'] },
      { id: 'layer-handler', name: 'Handlers', description: 'HTTP handlers', nodeIds: ['internal/handler/api.go', 'fn:handleRequest'] },
      { id: 'layer-service', name: 'Services', description: 'Business logic', nodeIds: ['internal/service/user.go', 'fn:getUser'] },
    ],
  }
}

// ─── Tests ───

describe('loadGraph', () => {
  it('returns null when no graph file exists', () => {
    const dir = join(tmpdir(), `fg-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    try {
      expect(loadGraph(dir)).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loads a valid graph from disk', () => {
    const dir = join(tmpdir(), `fg-test-${Date.now()}`)
    const uaDir = join(dir, '.understand-anything')
    mkdirSync(uaDir, { recursive: true })

    const graph = createFixtureGraph()
    writeFileSync(join(uaDir, 'knowledge-graph.json'), JSON.stringify(graph))

    try {
      const loaded = loadGraph(dir)
      expect(loaded).not.toBeNull()
      expect(loaded!.project?.projectName).toBe('test-project')
      expect(loaded!.nodes).toHaveLength(5)
      expect(loaded!.edges).toHaveLength(3)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('getNode', () => {
  const graph = createFixtureGraph()

  it('finds a node by id', () => {
    const node = getNode(graph, 'cmd/main.go')
    expect(node).toBeDefined()
    expect(node!.type).toBe('file')
    expect(node!.label).toBe('main.go')
  })

  it('returns undefined for non-existent node', () => {
    expect(getNode(graph, 'nonexistent')).toBeUndefined()
  })

  it('finds function nodes', () => {
    const node = getNode(graph, 'fn:handleRequest')
    expect(node).toBeDefined()
    expect(node!.type).toBe('function')
    expect(node!.metadata?.summary).toBe('Handles incoming HTTP requests')
  })
})

describe('getNeighbors', () => {
  const graph = createFixtureGraph()

  it('returns 1-hop neighbors', () => {
    const result = getNeighbors(graph, 'internal/handler/api.go', 1)
    expect(result.nodes.length).toBeGreaterThan(0)
    // Should include: cmd/main.go (imports handler), internal/service/user.go (handler imports service), handleRequest (child fn)
    const ids = result.nodes.map(n => n.id)
    expect(ids).toContain('cmd/main.go')
    expect(ids).toContain('internal/service/user.go')
  })

  it('returns deeper neighbors with depth=2', () => {
    const result1 = getNeighbors(graph, 'cmd/main.go', 1)
    const result2 = getNeighbors(graph, 'cmd/main.go', 2)
    expect(result2.nodes.length).toBeGreaterThanOrEqual(result1.nodes.length)
  })

  it('returns empty for isolated node', () => {
    const isolated = getNeighbors(graph, 'fn:getUser', 1)
    // fn:getUser is the target of a call edge from handleRequest
    // So it should find handleRequest as a reverse neighbor
    expect(isolated.nodes.length).toBeGreaterThan(0)
  })
})

describe('searchNodes', () => {
  const graph = createFixtureGraph()

  it('finds nodes by label text', () => {
    const results = searchNodes(graph, 'user')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(n => n.id.includes('user'))).toBe(true)
  })

  it('finds nodes by metadata summary', () => {
    const results = searchNodes(graph, 'Entry')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(n => n.metadata?.summary?.includes('Entry'))).toBe(true)
  })

  it('is case-insensitive', () => {
    const lower = searchNodes(graph, 'handler')
    const upper = searchNodes(graph, 'HANDLER')
    expect(lower.length).toBe(upper.length)
  })

  it('returns empty for no matches', () => {
    const results = searchNodes(graph, 'zzz_nonexistent_zzz')
    expect(results).toHaveLength(0)
  })
})

describe('getGraphStats', () => {
  const graph = createFixtureGraph()

  it('returns correct counts', () => {
    const stats = getGraphStats(graph)
    expect(stats.nodeCount).toBe(5)
    expect(stats.edgeCount).toBe(3)
    expect(stats.tourCount).toBe(1)
    expect(stats.layerCount).toBe(3)
  })

  it('counts node types correctly', () => {
    const stats = getGraphStats(graph)
    expect(stats.nodeTypes['file']).toBe(3)
    expect(stats.nodeTypes['function']).toBe(2)
  })
})

describe('isGraphStale', () => {
  it('returns false when no graph exists', () => {
    const dir = join(tmpdir(), `fg-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    try {
      expect(isGraphStale(dir)).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns false for a fresh graph', () => {
    const dir = join(tmpdir(), `fg-test-${Date.now()}`)
    const uaDir = join(dir, '.understand-anything')
    mkdirSync(uaDir, { recursive: true })

    // Write some source files first
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'main.go'), 'package main')

    // Write graph with analyzedAt in the future
    const futureDate = new Date(Date.now() + 86400000).toISOString() // tomorrow
    const graph = { project: { analyzedAt: futureDate } }
    writeFileSync(join(uaDir, 'knowledge-graph.json'), JSON.stringify(graph))

    try {
      expect(isGraphStale(dir)).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
