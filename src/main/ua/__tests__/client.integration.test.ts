/**
 * Integration smoke: graph-reader against committed tiny-go fixture.
 *
 * Verifies the knowledge-graph.json written by indexProject (or the
 * spike script) is well-formed and queryable.
 */
import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import {
  loadGraph,
  getNode,
  searchNodes,
  getGraphStats,
} from '../graph-reader'

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/tiny-go')

describe('ua/client integration (fixture graph)', () => {
  const graph = loadGraph(FIXTURE_ROOT)

  it('loads knowledge-graph.json from tiny-go fixture', () => {
    expect(graph).not.toBeNull()
    expect(graph!.nodes.length).toBeGreaterThan(0)
    expect(graph!.edges.length).toBeGreaterThan(0)
  })

  it('all nodes have an id and at least one of name/label', () => {
    expect(graph).not.toBeNull()
    for (const node of graph!.nodes) {
      expect(node.id).toBeTruthy()
      // Each node must have either label or name for display/search
      expect(node.label || node.name).toBeTruthy()
    }
  })

  it('finds entry file node', () => {
    expect(graph).not.toBeNull()
    const main = graph!.nodes.find(n => n.filePath?.includes('cmd/main') || n.id.includes('main'))
    expect(main).toBeDefined()
  })

  it('searchNodes finds handler-related symbols by name or label', () => {
    expect(graph).not.toBeNull()
    const hits = searchNodes(graph!, 'handler')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('searchNodes finds symbols by name field', () => {
    expect(graph).not.toBeNull()
    // Nodes in the fixture use "name" not "label" — verify fallback works
    const hits = searchNodes(graph!, 'main')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('getGraphStats returns counts', () => {
    expect(graph).not.toBeNull()
    const stats = getGraphStats(graph!)
    expect(stats.nodeCount).toBeGreaterThan(0)
    expect(stats.edgeCount).toBeGreaterThan(0)
  })

  it('getNode returns node by id', () => {
    expect(graph).not.toBeNull()
    const first = graph!.nodes[0]
    const node = getNode(graph!, first.id)
    expect(node?.id).toBe(first.id)
  })
})
