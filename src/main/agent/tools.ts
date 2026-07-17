/**
 * Fieldguide Coach Agent tools — graph navigation + paper RAG + concept bridges.
 */
import { getProject } from '../db'
import {
  loadGraph,
  getNode,
  getNeighbors,
  getNodeSource,
  type KnowledgeGraph,
  type TourStep,
} from '../ua/graph-reader'
import { queryPaper } from '../vector'
import { buildCrossSourceContext } from '../ua/cross-tour'
import { flattenTourSteps, toSearchableNodes } from './context-packer'
import { searchNodesFuzzy } from './ua-search'
import type { AgentContext } from './types'

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_nodes',
      description: 'Fuzzy-search code graph nodes by name, tags, or summary. Returns matching node ids, labels, types, and summaries.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (function name, file name, class, concept, etc.)' },
          limit: { type: 'number', description: 'Max results (default 8)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_neighbors',
      description: 'List neighboring graph nodes connected within N hops (default 1).',
      parameters: {
        type: 'object',
        properties: {
          node_id: { type: 'string', description: 'Graph node id' },
          depth: { type: 'number', description: 'Hop depth (default 1, max 2)' },
        },
        required: ['node_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_layers',
      description: 'List architecture layers with descriptions and sample node ids.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_tour_step',
      description: 'Get a guided-tour step by 0-based index (or current step if omitted).',
      parameters: {
        type: 'object',
        properties: {
          step_index: { type: 'number', description: '0-based tour step index' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_paper',
      description: 'Search saved paper PDF chunks via RAG for relevant excerpts.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Question or keywords to search in papers' },
          top_k: { type: 'number', description: 'Number of chunks (default 3)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_node_source',
      description: 'Read source code snippet for a graph node id.',
      parameters: {
        type: 'object',
        properties: {
          node_id: { type: 'string', description: 'Graph node id' },
        },
        required: ['node_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_concept_links',
      description: 'List paper paragraph ↔ code node bridges for the current project.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
]

async function searchGraphNodes(graph: KnowledgeGraph, query: string, limit: number) {
  const searchable = toSearchableNodes(graph.nodes)
  const results = await searchNodesFuzzy(searchable, query, limit)
  if (results.length > 0) {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]))
    return results.map((r) => byId.get(r.nodeId)).filter(Boolean)
  }
  // Fallback already inside searchNodesFuzzy; keep empty → substring as last resort
  const q = query.toLowerCase()
  return graph.nodes
    .filter((n) => {
      const label = (n.label || n.name || n.id).toLowerCase()
      const summary = String(n.metadata?.summary || n.summary || '').toLowerCase()
      return label.includes(q) || summary.includes(q)
    })
    .slice(0, limit)
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
): Promise<string> {
  const project = getProject(ctx.projectId)
  if (!project) return JSON.stringify({ error: 'Project not found' })

  switch (name) {
    case 'search_nodes': {
      const query = String(args.query ?? '')
      const limit = Math.min(Number(args.limit) || 8, 15)
      const graph = loadGraph(project.root_path)
      if (!graph) return JSON.stringify({ error: 'Graph not indexed yet' })
      const nodes = await searchGraphNodes(graph, query, limit)
      return JSON.stringify(nodes.map((n) => ({
        id: n!.id,
        label: n!.label || n!.name,
        type: n!.type,
        filePath: n!.filePath,
        summary: String(n!.metadata?.summary || n!.summary || '').slice(0, 200),
      })))
    }

    case 'get_neighbors': {
      const nodeId = String(args.node_id ?? '')
      const depth = Math.min(Math.max(Number(args.depth) || 1, 1), 2)
      const graph = loadGraph(project.root_path)
      if (!graph) return JSON.stringify({ error: 'Graph not indexed yet' })
      const { nodes, edges } = getNeighbors(graph, nodeId, depth)
      return JSON.stringify({
        nodeId,
        depth,
        nodes: nodes.slice(0, 30).map((n) => ({
          id: n.id,
          label: n.label || n.name,
          type: n.type,
          filePath: n.filePath,
          summary: String(n.metadata?.summary || '').slice(0, 120),
        })),
        edges: edges.slice(0, 40).map((e) => ({
          source: e.source,
          target: e.target,
          type: e.type,
        })),
      })
    }

    case 'list_layers': {
      const graph = loadGraph(project.root_path)
      if (!graph) return JSON.stringify({ error: 'Graph not indexed yet' })
      const layers = graph.layers || []
      return JSON.stringify(layers.map((l) => ({
        id: l.id,
        name: l.name,
        description: (l.description || '').slice(0, 200),
        nodeCount: l.nodeIds?.length ?? 0,
        sampleNodeIds: (l.nodeIds || []).slice(0, 5),
      })))
    }

    case 'get_tour_step': {
      const graph = loadGraph(project.root_path)
      if (!graph) return JSON.stringify({ error: 'Graph not indexed yet' })
      const steps = flattenTourSteps(graph)
      if (!steps.length) return JSON.stringify({ error: 'No tour available' })
      const idx = args.step_index !== undefined && args.step_index !== null
        ? Number(args.step_index)
        : (ctx.tourStepIndex ?? 0)
      const safe = Math.max(0, Math.min(steps.length - 1, Number.isFinite(idx) ? idx : 0))
      const step = steps[safe]
      return JSON.stringify({
        stepIndex: safe,
        totalSteps: steps.length,
        order: step.order ?? safe + 1,
        title: step.title,
        description: step.description,
        nodeIds: step.nodeIds || [],
        languageLesson: (step as TourStep & { languageLesson?: string }).languageLesson,
      })
    }

    case 'query_paper': {
      const query = String(args.query ?? '')
      const topK = Math.min(Number(args.top_k) || 3, 5)
      try {
        const results = await queryPaper(query, undefined, topK)
        return JSON.stringify(results.map((r, i) => ({
          rank: i + 1,
          score: r.score,
          text: r.chunk.text.slice(0, 600),
          paperId: r.chunk.paper_id,
        })))
      } catch (err) {
        return JSON.stringify({ error: String(err) })
      }
    }

    case 'get_node_source': {
      const nodeId = String(args.node_id ?? '')
      const graph = loadGraph(project.root_path)
      if (!graph) return JSON.stringify({ error: 'Graph not indexed yet' })
      const node = getNode(graph, nodeId)
      if (!node) return JSON.stringify({ error: `Node ${nodeId} not found` })
      const source = getNodeSource(project.root_path, node)
      if (!source) return JSON.stringify({ error: 'Source unavailable' })
      return JSON.stringify({
        nodeId,
        path: node.filePath,
        lineStart: source.lineStart,
        lineEnd: source.lineEnd,
        content: source.content.slice(0, 3000),
      })
    }

    case 'list_concept_links': {
      const items = buildCrossSourceContext(ctx.projectId)
      return JSON.stringify(items.slice(0, 15).map((c) => ({
        paperTitle: c.paperTitle,
        arxivId: c.arxivId,
        excerpt: c.excerpt.slice(0, 200),
        nodeId: c.nodeId,
        nodeName: c.nodeName,
        nodeFile: c.nodeFile,
      })))
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

export function extractNodeRefsFromObservation(observation: string): string[] {
  const refs = new Set<string>()
  try {
    const data = JSON.parse(observation)
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item?.id) refs.add(String(item.id))
        if (item?.nodeId) refs.add(String(item.nodeId))
        if (Array.isArray(item?.nodeIds)) {
          for (const id of item.nodeIds) refs.add(String(id))
        }
        if (Array.isArray(item?.sampleNodeIds)) {
          for (const id of item.sampleNodeIds) refs.add(String(id))
        }
      }
    } else if (data && typeof data === 'object') {
      if (data.nodeId) refs.add(String(data.nodeId))
      if (Array.isArray(data.nodeIds)) {
        for (const id of data.nodeIds) refs.add(String(id))
      }
      if (Array.isArray(data.nodes)) {
        for (const n of data.nodes) {
          if (n?.id) refs.add(String(n.id))
        }
      }
    }
  } catch { /* not JSON */ }
  return [...refs]
}

/** @deprecated Prefer packCoachContext — kept for any residual callers. */
export function buildGraphOverview(projectRoot: string): string {
  const graph = loadGraph(projectRoot)
  if (!graph) return ''
  try {
    const fileMap = new Map<string, string[]>()
    for (const node of graph.nodes.slice(0, 150)) {
      const fp = node.filePath || node.id || ''
      const fileName = fp.split(/[/\\]/).slice(-1)[0] || fp
      if (!fileMap.has(fileName)) fileMap.set(fileName, [])
      const sum = String(node.metadata?.summary || '').slice(0, 80)
      const line = `${node.type}:${node.label || node.name}${sum ? ` — ${sum}` : ''}`
      fileMap.get(fileName)!.push(line)
    }
    return [...fileMap.entries()].slice(0, 25).map(([f, syms]) =>
      `${f}: ${syms.slice(0, 5).join('; ')}`,
    ).join('\n')
  } catch {
    return ''
  }
}

export function toolCallKey(name: string, args: Record<string, unknown>): string {
  return `${name}:${JSON.stringify(args, Object.keys(args).sort())}`
}
