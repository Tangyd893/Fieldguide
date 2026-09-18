/**
 * Community detection (label propagation) over a synthetic module graph.
 */
import { describe, it, expect } from 'vitest'
import { detectCommunities, type CommunityGraph } from '../communities'

function node(id: string, filePath: string, type = 'function') {
  return { id, filePath, type }
}

/** Two tightly-connected triangles joined by a single edge. */
function twoClusters(): CommunityGraph {
  return {
    nodes: [
      node('a1', 'pkg/a/x.go'), node('a2', 'pkg/a/y.go'), node('a3', 'pkg/a/z.go'),
      node('b1', 'pkg/b/x.go'), node('b2', 'pkg/b/y.go'), node('b3', 'pkg/b/z.go'),
    ],
    edges: [
      // cluster A: fully connected
      { source: 'a1', target: 'a2', type: 'call' },
      { source: 'a2', target: 'a3', type: 'call' },
      { source: 'a1', target: 'a3', type: 'call' },
      // cluster B: fully connected
      { source: 'b1', target: 'b2', type: 'call' },
      { source: 'b2', target: 'b3', type: 'call' },
      { source: 'b1', target: 'b3', type: 'call' },
      // the only bridge
      { source: 'a3', target: 'b1', type: 'import' },
    ],
  }
}

describe('detectCommunities', () => {
  it('splits two dense clusters joined by one edge', () => {
    const result = detectCommunities(twoClusters())
    expect(result.communities.length).toBe(2)

    const [first, second] = result.communities
    const setOf = (ids: string[]) => new Set(ids)
    const a = setOf(first.nodeIds)
    const b = setOf(second.nodeIds)
    // Each cluster keeps its three members together.
    expect(a.size).toBe(3)
    expect(b.size).toBe(3)
    expect([...a].every((id) => id.startsWith('a')) || [...a].every((id) => id.startsWith('b'))).toBe(true)
  })

  it('reports the dominant directory of each community', () => {
    const result = detectCommunities(twoClusters())
    const dirs = result.communities.map((c) => c.dominantPath).sort()
    expect(dirs).toEqual(['pkg/a', 'pkg/b'])
  })

  it('computes cohesion as the share of internal edges', () => {
    const result = detectCommunities(twoClusters())
    // 6 of 7 edges are inside a cluster
    expect(result.cohesion).toBeCloseTo(6 / 7, 3)
  })

  it('ignores structural "contains" edges when clustering', () => {
    const graph: CommunityGraph = {
      nodes: [node('f1', 'a.go', 'file'), node('n1', 'a.go'), node('f2', 'b.go', 'file'), node('n2', 'b.go')],
      edges: [
        { source: 'f1', target: 'n1', type: 'contains' },
        { source: 'f2', target: 'n2', type: 'contains' },
        { source: 'n1', target: 'n2', type: 'call' },
      ],
    }
    const result = detectCommunities(graph)
    // The call edge pulls both into one community; contains edges are ignored.
    expect(result.communities.length).toBe(1)
    expect(result.communities[0].nodeIds).toEqual(['f1', 'f2', 'n1', 'n2'])
  })

  it('is deterministic for the same input', () => {
    const a = detectCommunities(twoClusters())
    const b = detectCommunities(twoClusters())
    expect(a.communities.map((c) => c.nodeIds)).toEqual(b.communities.map((c) => c.nodeIds))
  })

  it('folds communities below the minimum size into a catch-all', () => {
    const graph: CommunityGraph = {
      nodes: [
        node('m1', 'big/a.go'), node('m2', 'big/b.go'), node('m3', 'big/c.go'), node('m4', 'big/d.go'),
        node('s1', 'small/a.go'), node('s2', 'small/b.go'),
      ],
      edges: [
        { source: 'm1', target: 'm2', type: 'call' },
        { source: 'm2', target: 'm3', type: 'call' },
        { source: 'm3', target: 'm4', type: 'call' },
        { source: 'm1', target: 'm4', type: 'call' },
        { source: 's1', target: 's2', type: 'call' },
      ],
    }
    const result = detectCommunities(graph, { minSize: 3 })
    const sizes = result.communities.map((c) => c.nodeIds.length).sort()
    // big cluster kept, small pair folded into one bucket
    expect(sizes).toEqual([2, 4])
  })

  it('handles an empty graph and an edgeless graph', () => {
    expect(detectCommunities({ nodes: [], edges: [] })).toMatchObject({ communities: [], cohesion: 0 })
    const isolated = detectCommunities({
      nodes: [node('x', 'a.go'), node('y', 'b.go')],
      edges: [],
    })
    expect(isolated.communities.flatMap((c) => c.nodeIds).sort()).toEqual(['x', 'y'])
    expect(isolated.cohesion).toBe(0)
  })

  it('returns weight relative to the largest community', () => {
    const result = detectCommunities(twoClusters())
    for (const community of result.communities) {
      expect(community.weight).toBeGreaterThan(0)
      expect(community.weight).toBeLessThanOrEqual(1)
    }
  })
})
