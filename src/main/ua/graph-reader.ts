/**
 * Graph Reader — reads and queries UA knowledge-graph.json.
 *
 * Architecture: architecture.md §7.2
 * All graph IPC handlers delegate to this module.
 */
import { join } from 'node:path'
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs'
import { ensureGraphLayersSync } from './ensure-layers'

// ─── Types ───

export interface GraphMeta {
  projectName?: string
  analyzedAt?: string
  language?: string
  fileCount?: number
  nodeCount?: number
  edgeCount?: number
}

export interface GraphNode {
  id: string
  type: string
  label: string
  name?: string
  filePath?: string
  lineRange?: [number, number]
  metadata?: {
    summary?: string
    tags?: string[]
    complexity?: 'simple' | 'moderate' | 'complex'
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface GraphEdge {
  id?: string
  source: string
  target: string
  type?: string
  label?: string
  [key: string]: unknown
}

export interface TourStep {
  order?: number
  id?: string
  title?: string
  description?: string
  nodeIds?: string[]
}

export interface Tour {
  id?: string
  name?: string
  description?: string
  steps?: TourStep[]
}

export interface Layer {
  id: string
  name: string
  description?: string
  nodeIds?: string[]
}

export interface KnowledgeGraph {
  project?: GraphMeta
  meta?: GraphMeta
  nodes: GraphNode[]
  edges: GraphEdge[]
  tour?: Tour[]
  layers?: Layer[]
  [key: string]: unknown
}

// ─── Core ───

function graphPath(projectRoot: string): string {
  return join(projectRoot, '.understand-anything', 'knowledge-graph.json')
}

/**
 * Parse cache keyed by graph file identity (mtime + size).
 *
 * Every graph IPC channel, the coach agent and search all call loadGraph();
 * without this, each call re-read and re-parsed the whole JSON — noticeable on
 * large graphs (HIS-Go is 3656 nodes) and painful now that node search hits the
 * main process on every keystroke. Writes bump mtime, so a stale entry can never
 * be served after a re-index.
 */
const GRAPH_CACHE_MAX = 4
const graphCache = new Map<string, { stamp: string; graph: KnowledgeGraph }>()

function graphStamp(path: string): string | null {
  try {
    const st = statSync(path)
    return `${st.mtimeMs}:${st.size}`
  } catch {
    return null
  }
}

/** Drop a cached graph — call after writing the graph file in-process. */
export function invalidateGraphCache(projectRoot?: string): void {
  if (!projectRoot) {
    graphCache.clear()
    return
  }
  graphCache.delete(graphPath(projectRoot))
}

/** Load the full knowledge graph for a project. */
export function loadGraph(projectRoot: string): KnowledgeGraph | null {
  const p = graphPath(projectRoot)
  if (!existsSync(p)) return null

  const stamp = graphStamp(p)
  if (stamp) {
    const cached = graphCache.get(p)
    if (cached && cached.stamp === stamp) return cached.graph
  }

  try {
    const graph = JSON.parse(readFileSync(p, 'utf-8')) as KnowledgeGraph
    // Structure-only indexes may lack layers — UA Dashboard needs them
    ensureGraphLayersSync(graph)
    if (stamp) {
      // Refresh the stamp: ensureGraphLayersSync may have rewritten the file.
      const after = graphStamp(p) ?? stamp
      if (graphCache.size >= GRAPH_CACHE_MAX) {
        const oldest = graphCache.keys().next().value
        if (oldest !== undefined) graphCache.delete(oldest)
      }
      graphCache.set(p, { stamp: after, graph })
    }
    return graph
  } catch {
    return null
  }
}

// ─── Queries ───

/** Get a single node by id. */
export function getNode(graph: KnowledgeGraph, nodeId: string): GraphNode | undefined {
  return graph.nodes.find(n => n.id === nodeId)
}

/** Get all neighbors of a node within `depth` hops. */
export function getNeighbors(
  graph: KnowledgeGraph,
  nodeId: string,
  depth = 1,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const visited = new Set<string>([nodeId])
  let frontier = new Set<string>([nodeId])
  const resultEdges: GraphEdge[] = []

  for (let d = 0; d < depth; d++) {
    const nextFrontier = new Set<string>()
    for (const edge of graph.edges) {
      if (frontier.has(edge.source) && !visited.has(edge.target)) {
        nextFrontier.add(edge.target)
        visited.add(edge.target)
        resultEdges.push(edge)
      }
      if (frontier.has(edge.target) && !visited.has(edge.source)) {
        nextFrontier.add(edge.source)
        visited.add(edge.source)
        resultEdges.push(edge)
      }
    }
    frontier = nextFrontier
  }

  const resultNodes = graph.nodes.filter(n => visited.has(n.id))
  return { nodes: resultNodes, edges: resultEdges }
}

/** Result of a shortest-path query between two graph nodes. */
export interface GraphPath {
  found: boolean
  /** Node ids in order from `fromId` to `toId`, inclusive. */
  nodeIds: string[]
  /** Edges traversed, aligned with nodeIds[i] → nodeIds[i + 1]. */
  edges: GraphEdge[]
  hops: number
  /** Populated when the search hit its depth cap without reaching the target. */
  truncated?: boolean
}

/**
 * Find the shortest undirected path between two nodes (BFS).
 *
 * Answers "how does A reach B?", the question a reader asks right after finding
 * an entry point. Edges are treated as undirected because the graph mixes
 * `import`, `call` and `contains` and a reader wants the connection, not the
 * direction; `edges[i].source` still shows the stored direction.
 *
 * `maxDepth` bounds the work on large graphs (HIS-Go has 3656 nodes).
 */
export function findPath(
  graph: KnowledgeGraph,
  fromId: string,
  toId: string,
  maxDepth = 8,
): GraphPath {
  if (fromId === toId) {
    return { found: true, nodeIds: [fromId], edges: [], hops: 0 }
  }

  // Adjacency index built once per query: scanning every edge per hop is O(E·depth).
  const adjacency = new Map<string, Array<{ next: string; edge: GraphEdge }>>()
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, [])
    adjacency.get(edge.source)!.push({ next: edge.target, edge })
    adjacency.get(edge.target)!.push({ next: edge.source, edge })
  }

  if (!adjacency.has(fromId) || !adjacency.has(toId)) {
    return { found: false, nodeIds: [], edges: [], hops: 0 }
  }

  const cameFrom = new Map<string, { prev: string; edge: GraphEdge }>()
  const visited = new Set<string>([fromId])
  let frontier: string[] = [fromId]
  let depth = 0
  let truncated = false

  while (frontier.length > 0) {
    if (depth >= maxDepth) {
      truncated = true
      break
    }
    const next: string[] = []
    for (const current of frontier) {
      for (const { next: neighbour, edge } of adjacency.get(current) ?? []) {
        if (visited.has(neighbour)) continue
        visited.add(neighbour)
        cameFrom.set(neighbour, { prev: current, edge })
        if (neighbour === toId) {
          // Walk back to the start.
          const nodeIds = [toId]
          const edges: GraphEdge[] = []
          let cursor = toId
          while (cursor !== fromId) {
            const step = cameFrom.get(cursor)!
            edges.unshift(step.edge)
            nodeIds.unshift(step.prev)
            cursor = step.prev
          }
          return { found: true, nodeIds, edges, hops: nodeIds.length - 1 }
        }
        next.push(neighbour)
      }
    }
    frontier = next
    depth++
  }

  return { found: false, nodeIds: [], edges: [], hops: 0, truncated }
}

/** Text search across node labels, names, and metadata. */
export function searchNodes(  graph: KnowledgeGraph,
  query: string,
  maxResults = 20,
): GraphNode[] {
  const q = query.toLowerCase()
  return graph.nodes
    .filter(n => {
      const label = (n.label || n.name || n.id).toLowerCase()
      const summary = n.metadata?.summary?.toLowerCase() || ''
      return label.includes(q) || summary.includes(q)
    })
    .slice(0, maxResults)
}

/** Get source code for a file node. */
export function getNodeSource(
  projectRoot: string,
  node: GraphNode,
  maxLines = 200,
): { content: string; lineStart: number; lineEnd: number } | null {
  const fp = node.filePath
  if (!fp) return null
  const fullPath = join(projectRoot, fp)
  if (!existsSync(fullPath)) return null

  try {
    let content = readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')

    // If the node has a line range, extract that portion
    if (node.lineRange) {
      const [start, end] = node.lineRange
      const startIdx = Math.max(0, start - 1)
      const endIdx = Math.min(lines.length, end)
      content = lines.slice(startIdx, endIdx).join('\n')
      return { content, lineStart: start, lineEnd: end }
    }

    // Otherwise, return up to maxLines from the beginning
    const clipped = lines.slice(0, maxLines).join('\n')
    return { content: clipped, lineStart: 1, lineEnd: Math.min(lines.length, maxLines) }
  } catch {
    return null
  }
}

// ─── Staleness ───

/** Check if a project's graph is stale (source files modified after index). */
export function isGraphStale(projectRoot: string): boolean {
  const p = graphPath(projectRoot)
  if (!existsSync(p)) return false

  try {
    const graph = JSON.parse(readFileSync(p, 'utf-8'))
    const indexedAt = graph?.project?.analyzedAt || graph?.meta?.analyzedAt
    if (!indexedAt) return false

    const latestMtime = getLatestSourceMtime(projectRoot)
    return latestMtime !== null && new Date(latestMtime) > new Date(indexedAt)
  } catch {
    return false
  }
}

/** Get the latest modification time of any non-ignored source file. */
function getLatestSourceMtime(rootPath: string): string | null {
  const IGNORE = new Set([
    '.git', 'node_modules', '.understand-anything', 'vendor',
    '__pycache__', '.venv', 'dist', 'build', 'out', '.next',
    'target', '.turbo', '.cache', '.idea', '.vscode',
  ])

  let latest = 0
  function walk(dir: string) {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const entry of entries) {
      if (entry.startsWith('.') || IGNORE.has(entry)) continue
      const full = join(dir, entry)
      let st: ReturnType<typeof statSync>
      try { st = statSync(full) } catch { continue }
      if (st.isDirectory()) {
        walk(full)
      } else if (st.isFile() && st.mtimeMs > latest) {
        latest = st.mtimeMs
      }
    }
  }
  walk(rootPath)
  return latest > 0 ? new Date(latest).toISOString() : null
}

/** Get graph statistics for display. */
export function getGraphStats(graph: KnowledgeGraph) {
  const nodeTypes = new Map<string, number>()
  for (const node of graph.nodes) {
    const t = node.type || 'unknown'
    nodeTypes.set(t, (nodeTypes.get(t) || 0) + 1)
  }

  const edgeTypes = new Map<string, number>()
  for (const edge of graph.edges) {
    const t = edge.type || 'unknown'
    edgeTypes.set(t, (edgeTypes.get(t) || 0) + 1)
  }

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    tourCount: graph.tour?.length || 0,
    layerCount: graph.layers?.length || 0,
    nodeTypes: Object.fromEntries(nodeTypes),
    edgeTypes: Object.fromEntries(edgeTypes),
  }
}
