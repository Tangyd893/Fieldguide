/**
 * Tests for mergeIncrementalGraph — the incremental indexing merge logic.
 *
 * We test against in-memory graphs written to temp directories, so no
 * Electron or UA core dependency is needed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mergeIncrementalGraph } from '../client'

let tmpDir: string

beforeEach(() => {
  tmpDir = join(tmpdir(), `fg-merge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(tmpDir, '.understand-anything'), { recursive: true })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeExistingGraph(dir: string, graph: any) {
  writeFileSync(join(dir, '.understand-anything', 'knowledge-graph.json'), JSON.stringify(graph))
}

describe('mergeIncrementalGraph', () => {
  it('keeps unchanged nodes and removes/replaces changed ones', () => {
    // Existing graph with 3 file nodes
    const existing = {
      project: { analyzedAt: '2026-01-01T00:00:00Z' },
      nodes: [
        { id: 'file:a.go', type: 'file', name: 'a.go', filePath: 'a.go' },
        { id: 'fn:a.go:foo', type: 'function', name: 'foo', filePath: 'a.go' },
        { id: 'file:b.go', type: 'file', name: 'b.go', filePath: 'b.go' },
        { id: 'fn:b.go:bar', type: 'function', name: 'bar', filePath: 'b.go' },
        { id: 'file:c.go', type: 'file', name: 'c.go', filePath: 'c.go' },
      ],
      edges: [
        { source: 'file:a.go', target: 'fn:a.go:foo', type: 'contains' },
        { source: 'file:b.go', target: 'fn:b.go:bar', type: 'contains' },
        { source: 'fn:a.go:foo', target: 'fn:b.go:bar', type: 'call' },
      ],
      layers: [{ id: 'L1', name: 'Core', nodeIds: ['file:a.go'] }],
      tour: [{ id: 'T1', name: 'Main Flow', steps: [] }],
    }
    writeExistingGraph(tmpDir, existing)

    // Simulate incremental: only b.go changed
    const partial = {
      nodes: [
        { id: 'file:b.go', type: 'file', name: 'b.go', filePath: 'b.go' },
        { id: 'fn:b.go:bar', type: 'function', name: 'bar', filePath: 'b.go' },
        { id: 'fn:b.go:baz', type: 'function', name: 'baz', filePath: 'b.go' }, // new!
      ],
      edges: [
        { source: 'file:b.go', target: 'fn:b.go:bar', type: 'contains' },
        { source: 'file:b.go', target: 'fn:b.go:baz', type: 'contains' },
      ],
    }
    const changedFiles = [{ path: 'b.go' }]

    mergeIncrementalGraph(tmpDir, partial, changedFiles)

    // Should have: a.go (2 nodes) + c.go (1 node) + b.go (3 new nodes) = 6
    expect(partial.nodes.length).toBe(6)

    // a.go nodes preserved
    expect(partial.nodes.find((n: any) => n.id === 'file:a.go')).toBeTruthy()
    expect(partial.nodes.find((n: any) => n.id === 'fn:a.go:foo')).toBeTruthy()

    // c.go preserved
    expect(partial.nodes.find((n: any) => n.id === 'file:c.go')).toBeTruthy()

    // b.go old nodes removed, new nodes present
    expect(partial.nodes.find((n: any) => n.id === 'fn:b.go:baz')).toBeTruthy()

    // Edges: a.go→foo (kept) + b.go→bar + b.go→baz (new) = 3
    // The call edge a.go:foo→b.go:bar is removed because b.go nodes were replaced
    expect(partial.edges.length).toBe(3)

    // Cross-file edge referencing removed target is dropped
    expect(partial.edges.find((e: any) => e.source === 'fn:a.go:foo' && e.target === 'fn:b.go:bar')).toBeFalsy()

    // Layers and tours preserved
    expect(partial.layers).toEqual(existing.layers)
    expect(partial.tour).toEqual(existing.tour)
  })

  it('does nothing when no existing graph file exists', () => {
    const partial = {
      nodes: [{ id: 'file:x.go', type: 'file', name: 'x.go', filePath: 'x.go' }],
      edges: [],
    }
    const changedFiles = [{ path: 'x.go' }]

    mergeIncrementalGraph(tmpDir, partial, changedFiles)

    // Partial unchanged — treated as full graph
    expect(partial.nodes.length).toBe(1)
  })

  it('does nothing when existing graph is corrupt JSON', () => {
    writeFileSync(join(tmpDir, '.understand-anything', 'knowledge-graph.json'), 'not valid json{{{')

    const partial = {
      nodes: [{ id: 'file:y.go', type: 'file', name: 'y.go', filePath: 'y.go' }],
      edges: [],
    }
    mergeIncrementalGraph(tmpDir, partial, [{ path: 'y.go' }])

    // Partial unchanged
    expect(partial.nodes.length).toBe(1)
  })

  it('handles empty existing nodes array', () => {
    writeExistingGraph(tmpDir, { nodes: [], edges: [], project: {} })

    const partial = {
      nodes: [{ id: 'file:z.go', type: 'file', name: 'z.go', filePath: 'z.go' }],
      edges: [],
    }
    mergeIncrementalGraph(tmpDir, partial, [{ path: 'z.go' }])

    // Since existing nodes was empty, partial becomes the graph
    expect(partial.nodes.length).toBe(1)
  })

  it('preserves unchanged nodes when no file overlap', () => {
    // Existing graph with nodes for a.go only
    const existing = {
      nodes: [
        { id: 'file:a.go', type: 'file', name: 'a.go', filePath: 'a.go' },
        { id: 'fn:a.go:foo', type: 'function', name: 'foo', filePath: 'a.go' },
      ],
      edges: [{ source: 'file:a.go', target: 'fn:a.go:foo', type: 'contains' }],
    }
    writeExistingGraph(tmpDir, existing)

    // Incremental: only b.go changed (no overlap with a.go)
    const partial = {
      nodes: [{ id: 'file:b.go', type: 'file', name: 'b.go', filePath: 'b.go' }],
      edges: [],
    }
    mergeIncrementalGraph(tmpDir, partial, [{ path: 'b.go' }])

    // All a.go nodes kept + new b.go node = 3
    expect(partial.nodes.length).toBe(3)
    expect(partial.nodes.find((n: any) => n.id === 'file:a.go')).toBeTruthy()
    expect(partial.nodes.find((n: any) => n.id === 'file:b.go')).toBeTruthy()
  })

  it('nodes without filePath are preserved', () => {
    const existing = {
      nodes: [
        { id: 'orphan:1', type: 'unknown', name: 'orphan', filePath: undefined },
        { id: 'file:a.go', type: 'file', name: 'a.go', filePath: 'a.go' },
        { id: 'file:b.go', type: 'file', name: 'b.go', filePath: 'b.go' },
      ],
      edges: [
        { source: 'orphan:1', target: 'file:b.go', type: 'ref' },
      ],
    }
    writeExistingGraph(tmpDir, existing)

    // Only a.go changed — b.go and orphan should survive
    const partial = {
      nodes: [{ id: 'file:a.go', type: 'file', name: 'a.go', filePath: 'a.go' }],
      edges: [],
    }
    mergeIncrementalGraph(tmpDir, partial, [{ path: 'a.go' }])

    // Orphan node preserved (no filePath → never matches changedPaths)
    expect(partial.nodes.find((n: any) => n.id === 'orphan:1')).toBeTruthy()
    // b.go node preserved (not in changed files)
    expect(partial.nodes.find((n: any) => n.id === 'file:b.go')).toBeTruthy()
    // Edge from orphan to b.go preserved (neither endpoint was removed)
    expect(partial.edges.find((e: any) => e.source === 'orphan:1' && e.target === 'file:b.go')).toBeTruthy()
  })
})
