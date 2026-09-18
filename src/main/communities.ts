/**
 * Community detection over the knowledge graph (Louvain local moving).
 *
 * The audit suggested Louvain via `graphology-communities-louvain`, but that is
 * only present as a transitive dependency of UA core — depending on it directly
 * would break as soon as upstream reshuffles its tree. The first phase of
 * Louvain (modularity-gain local moving) is short enough to own, is deterministic
 * and answers the same question: which files/functions cluster together without
 * being told the directory structure.
 *
 * Label propagation was tried first and rejected: on two dense clusters joined by
 * a single bridge node it collapsed everything into one community, because the
 * bridge adopts whichever neighbour label sorts first. Modularity gain has no
 * such failure mode here (the bridge moves only if Q actually improves).
 *
 * Pure module → unit-testable.
 */

export interface CommunityGraph {
  nodes: Array<{ id: string; filePath?: string; type?: string }>
  edges: Array<{ source: string; target: string; type?: string }>
}

export interface Community {
  id: number
  nodeIds: string[]
  /** Most common directory among the members' files. */
  dominantPath: string
  /** Size relative to the largest community (0–1), for bar widths. */
  weight: number
}

export interface CommunityResult {
  communities: Community[]
  /** Share of edges whose endpoints ended up in the same community (0–1). */
  cohesion: number
  iterations: number
}

export interface CommunityOptions {
  maxIterations?: number
  /** Communities smaller than this are folded into an "other" bucket. */
  minSize?: number
  maxCommunities?: number
}

const DEFAULT_MAX_ITERATIONS = 20
const DEFAULT_MIN_SIZE = 3
const DEFAULT_MAX_COMMUNITIES = 12

/** Ignore structural edges so clusters reflect calls/imports, not containment. */
function usableEdges(edges: CommunityGraph['edges']): Array<{ source: string; target: string }> {
  return edges.filter((e) => e.type !== 'contains' && e.source !== e.target)
}

/**
 * Louvain phase 1: repeatedly move nodes into the neighbouring community that
 * yields the largest positive modularity gain, until nothing improves.
 *
 * Positive gain for moving node i into community C is
 *   `k_i_in(C) − Σtot(C) · k_i / (2m)`
 * which is the standard criterion (self-loops excluded, undirected weights).
 */
export function detectCommunities(graph: CommunityGraph, opts: CommunityOptions = {}): CommunityResult {
  const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS
  const minSize = opts.minSize ?? DEFAULT_MIN_SIZE
  const maxCommunities = opts.maxCommunities ?? DEFAULT_MAX_COMMUNITIES

  const nodeIds = [...new Set(graph.nodes.map((n) => n.id))].sort()
  if (nodeIds.length === 0) return { communities: [], cohesion: 0, iterations: 0 }

  // Weighted undirected adjacency (multi-edges accumulate).
  const adjacency = new Map<string, Map<string, number>>()
  for (const id of nodeIds) adjacency.set(id, new Map())
  let totalWeight = 0
  for (const edge of usableEdges(graph.edges)) {
    const a = adjacency.get(edge.source)
    const b = adjacency.get(edge.target)
    if (!a || !b) continue
    a.set(edge.target, (a.get(edge.target) ?? 0) + 1)
    b.set(edge.source, (b.get(edge.source) ?? 0) + 1)
    totalWeight += 1
  }
  if (totalWeight === 0) {
    // No relationships at all: every node is its own community.
    const communities = buildCommunities(nodeIds.map((id) => [id]), graph, minSize, maxCommunities)
    return { communities, cohesion: 0, iterations: 0 }
  }
  const twoM = 2 * totalWeight

  const degree = (id: string): number => {
    let sum = 0
    for (const w of adjacency.get(id)!.values()) sum += w
    return sum
  }

  const community = new Map<string, string>()
  const tot = new Map<string, number>() // sum of degrees per community
  for (const id of nodeIds) {
    community.set(id, id)
    tot.set(id, degree(id))
  }

  let iterations = 0
  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1
    let moved = false

    for (const id of nodeIds) {
      const current = community.get(id)!
      const k = degree(id)
      const links = adjacency.get(id)!

      // Weights from this node into each neighbouring community (self excluded).
      const weightsTo = new Map<string, number>()
      for (const [neighbour, weight] of links) {
        if (neighbour === id) continue
        const c = community.get(neighbour)!
        weightsTo.set(c, (weightsTo.get(c) ?? 0) + weight)
      }
      if (weightsTo.size === 0) continue

      // Temporarily remove the node from its community.
      tot.set(current, (tot.get(current) ?? 0) - k)

      let bestCommunity = current
      let bestGain = weightsTo.get(current) !== undefined
        ? weightsTo.get(current)! - ((tot.get(current) ?? 0) * k) / twoM
        : -( (tot.get(current) ?? 0) * k) / twoM

      // Deterministic order: iterate candidate communities by id.
      for (const candidate of [...weightsTo.keys()].sort()) {
        if (candidate === current) continue
        const gain = weightsTo.get(candidate)! - ((tot.get(candidate) ?? 0) * k) / twoM
        if (gain > bestGain + 1e-12) {
          bestGain = gain
          bestCommunity = candidate
        }
      }

      tot.set(bestCommunity, (tot.get(bestCommunity) ?? 0) + k)
      if (bestCommunity !== current) {
        community.set(id, bestCommunity)
        moved = true
      }
    }

    if (!moved) break
  }

  // Group by final community label.
  let groups = new Map<string, string[]>()
  for (const id of nodeIds) {
    const c = community.get(id)!
    if (!groups.has(c)) groups.set(c, [])
    groups.get(c)!.push(id)
  }

  // Local moving alone can stall on symmetric structures (a 4-cycle settles into
  // two pairs that never merge, even though merging raises modularity), so finish
  // with a greedy community-merge pass.
  const merged = mergeAdjacentCommunities([...groups.values()], adjacency, twoM)

  const sorted = merged.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))
  const communities = buildCommunities(sorted, graph, minSize, maxCommunities)

  // Cohesion: fraction of edges internal to a community.
  const communityOf = new Map<string, number>()
  for (const c of communities) for (const id of c.nodeIds) communityOf.set(id, c.id)
  const edges = usableEdges(graph.edges)
  const internal = edges.filter((e) => communityOf.get(e.source) === communityOf.get(e.target)).length
  const cohesion = edges.length > 0 ? internal / edges.length : 0

  return { communities, cohesion, iterations }
}

/**
 * Greedily merge communities while modularity improves.
 *
 * ΔQ for merging C and D is `w_CD/m − (tot_C · tot_D)/(2m²)` where `w_CD` is the
 * total weight between them; only positive gains are applied, best-first.
 */
function mergeAdjacentCommunities(
  groups: string[][],
  adjacency: Map<string, Map<string, number>>,
  twoM: number,
): string[][] {
  const m = twoM / 2
  if (m === 0) return groups

  let clusters = groups.map((members) => ({
    members: [...members],
    tot: members.reduce((sum, id) => {
      let d = 0
      for (const w of adjacency.get(id)?.values() ?? []) d += w
      return sum + d
    }, 0),
  }))

  const weightBetween = (a: string[], b: string[]): number => {
    const inB = new Set(b)
    let total = 0
    for (const id of a) {
      for (const [neighbour, w] of adjacency.get(id) ?? []) {
        if (inB.has(neighbour)) total += w
      }
    }
    return total
  }

  // Repeat until no pair improves modularity.
  for (let round = 0; round < groups.length; round++) {
    let bestGain = 0
    let bestPair: [number, number] | null = null

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const w = weightBetween(clusters[i].members, clusters[j].members)
        if (w === 0) continue
        const gain = w / m - (clusters[i].tot * clusters[j].tot) / (twoM * m)
        if (gain > bestGain + 1e-12) {
          bestGain = gain
          bestPair = [i, j]
        }
      }
    }

    if (!bestPair) break
    const [i, j] = bestPair
    clusters[i] = {
      members: [...clusters[i].members, ...clusters[j].members].sort(),
      tot: clusters[i].tot + clusters[j].tot,
    }
    clusters.splice(j, 1)
  }

  return clusters.map((c) => c.members)
}

/** Turn raw groups into sized, labelled communities (with a catch-all bucket). */function buildCommunities(
  groups: string[][],
  graph: CommunityGraph,
  minSize: number,
  maxCommunities: number,
): Community[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const largest = groups[0]?.length ?? 1
  const kept: Community[] = []
  const folded: string[] = []

  groups.forEach((members, index) => {
    if (index >= maxCommunities || members.length < minSize) {
      folded.push(...members)
      return
    }
    kept.push({
      id: kept.length,
      nodeIds: [...members].sort(),
      dominantPath: dominantPathOf(members, byId),
      weight: members.length / largest,
    })
  })

  if (folded.length > 0) {
    kept.push({
      id: kept.length,
      nodeIds: folded.sort(),
      dominantPath: dominantPathOf(folded, byId),
      weight: folded.length / largest,
    })
  }
  return kept
}

/** Most common directory among a group's files (ties broken by name). */
function dominantPathOf(
  members: string[],
  byId: Map<string, { filePath?: string }>,
): string {
  const counts = new Map<string, number>()
  for (const id of members) {
    const fp = byId.get(id)?.filePath
    if (!fp) continue
    const parts = fp.split('/')
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.'
    counts.set(dir, (counts.get(dir) ?? 0) + 1)
  }
  let best = ''
  let bestCount = -1
  for (const [dir, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > bestCount) { best = dir; bestCount = count }
  }
  return best || '(mixed)'
}
