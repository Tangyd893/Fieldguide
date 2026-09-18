/**
 * Shortest-path queries over the knowledge graph (backs the `find_call_path` tool).
 */
import { describe, it, expect } from 'vitest'
import { findPath, type KnowledgeGraph } from '../graph-reader'

function graph(
  nodes: string[],
  edges: Array<[string, string, string?]>,
): KnowledgeGraph {
  return {
    nodes: nodes.map((id) => ({ id, type: 'function', label: id, filePath: `${id}.go` })),
    edges: edges.map(([source, target, type]) => ({ source, target, type: type ?? 'call' })),
  }
}

describe('findPath', () => {
  it('returns a zero-hop path for identical endpoints', () => {
    const g = graph(['a'], [])
    const path = findPath(g, 'a', 'a')
    expect(path).toMatchObject({ found: true, hops: 0, nodeIds: ['a'] })
    expect(path.edges).toEqual([])
  })

  it('finds a direct edge', () => {
    const g = graph(['entry', 'handler'], [['entry', 'handler', 'call']])
    const path = findPath(g, 'entry', 'handler')
    expect(path.found).toBe(true)
    expect(path.nodeIds).toEqual(['entry', 'handler'])
    expect(path.hops).toBe(1)
    expect(path.edges).toHaveLength(1)
    expect(path.edges[0].type).toBe('call')
  })

  it('returns the shortest chain through intermediate nodes', () => {
    // entry → router → service → store, plus a longer detour entry → a → b → c → store
    const g = graph(
      ['entry', 'router', 'service', 'store', 'a', 'b', 'c'],
      [
        ['entry', 'router'],
        ['router', 'service'],
        ['service', 'store'],
        ['entry', 'a'],
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'store'],
      ],
    )
    const path = findPath(g, 'entry', 'store')
    expect(path.found).toBe(true)
    expect(path.nodeIds).toEqual(['entry', 'router', 'service', 'store'])
    expect(path.hops).toBe(3)
    expect(path.edges).toHaveLength(3)
  })

  it('traverses edges in either direction (mixed import/call/contains)', () => {
    // stored direction is callee → caller; the reader still wants the connection
    const g = graph(['handler', 'service'], [['service', 'handler', 'call']])
    const path = findPath(g, 'handler', 'service')
    expect(path.found).toBe(true)
    expect(path.nodeIds).toEqual(['handler', 'service'])
    // the edge keeps its stored direction
    expect(path.edges[0].source).toBe('service')
  })

  it('reports not-found when the nodes are in different components', () => {
    const g = graph(['a', 'b', 'x', 'y'], [['a', 'b'], ['x', 'y']])
    const path = findPath(g, 'a', 'y')
    expect(path.found).toBe(false)
    expect(path.hops).toBe(0)
    expect(path.truncated).toBeFalsy()
  })

  it('reports not-found when an endpoint is absent from the graph', () => {
    const g = graph(['a'], [])
    expect(findPath(g, 'a', 'missing').found).toBe(false)
    expect(findPath(g, 'missing', 'a').found).toBe(false)
  })

  it('marks the result truncated when the depth cap is hit', () => {
    const g = graph(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd']])
    const capped = findPath(g, 'a', 'd', 2)
    expect(capped.found).toBe(false)
    expect(capped.truncated).toBe(true)

    const deepEnough = findPath(g, 'a', 'd', 3)
    expect(deepEnough.found).toBe(true)
    expect(deepEnough.hops).toBe(3)
  })

  it('keeps edges aligned with consecutive node ids', () => {
    const g = graph(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']])
    const path = findPath(g, 'a', 'c')
    expect(path.nodeIds).toHaveLength(path.edges.length + 1)
    for (let i = 0; i < path.edges.length; i++) {
      const edge = path.edges[i]
      const pair = [path.nodeIds[i], path.nodeIds[i + 1]]
      expect(pair).toContain(edge.source)
      expect(pair).toContain(edge.target)
    }
  })

  it('handles a cyclic graph without looping', () => {
    const g = graph(
      ['a', 'b', 'c'],
      [['a', 'b'], ['b', 'c'], ['c', 'a']],
    )
    // c → a closes the cycle, so from a the target c is one back-edge away.
    const path = findPath(g, 'a', 'c')
    expect(path.found).toBe(true)
    expect(path.hops).toBe(1)
    expect(path.nodeIds).toEqual(['a', 'c'])

    // And the longer way round still resolves correctly.
    expect(findPath(g, 'b', 'a').hops).toBe(1)
    expect(findPath(g, 'c', 'b').hops).toBe(1)
  })
})
