/**
 * Integration smoke: graph-reader against committed tiny-go fixture.
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
  })

  it('finds entry file node', () => {
    expect(graph).not.toBeNull()
    const main = graph!.nodes.find(n => n.filePath?.includes('cmd/main') || n.id.includes('main'))
    expect(main).toBeDefined()
  })

  it('searchNodes finds handler-related symbols', () => {
    expect(graph).not.toBeNull()
    const hits = searchNodes(graph!, 'handler')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('getGraphStats returns counts', () => {
    expect(graph).not.toBeNull()
    const stats = getGraphStats(graph!)
    expect(stats.nodeCount).toBeGreaterThan(0)
  })

  it('getNode returns node by id', () => {
    expect(graph).not.toBeNull()
    const first = graph!.nodes[0]
    const node = getNode(graph!, first.id)
    expect(node?.id).toBe(first.id)
  })
})
