/**
 * Agent tools — search_nodes, query_paper, get_node_source, list_concept_links
 */
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { getProject } from '../db'
import { loadGraph, getNode, searchNodes, getNodeSource } from '../ua/graph-reader'
import { queryPaper } from '../vector'
import { buildCrossSourceContext } from '../ua/cross-tour'
import type { AgentContext } from './types'

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_nodes',
      description: 'Search code graph nodes by name or keyword. Returns matching node ids, labels, types, and summaries.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (function name, file name, class, etc.)' },
          limit: { type: 'number', description: 'Max results (default 8)' },
        },
        required: ['query'],
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
      const nodes = searchNodes(graph, query).slice(0, limit)
      return JSON.stringify(nodes.map(n => ({
        id: n.id,
        label: n.label,
        type: n.type,
        filePath: n.filePath,
        summary: n.metadata?.summary?.slice(0, 200),
      })))
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
      return JSON.stringify(items.slice(0, 15).map(c => ({
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
      }
    } else if (data?.nodeId) {
      refs.add(String(data.nodeId))
    }
  } catch { /* not JSON */ }
  return [...refs]
}

export function buildGraphOverview(projectRoot: string): string {
  const graphPath = join(projectRoot, '.understand-anything', 'knowledge-graph.json')
  if (!existsSync(graphPath)) return ''
  try {
    const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
    const nodes = (graph.nodes || []) as Array<{
      id: string; type: string; label: string; filePath?: string
      metadata?: { summary?: string }
    }>
    const fileMap = new Map<string, string[]>()
    for (const node of nodes.slice(0, 150)) {
      const fp = node.filePath || node.id || ''
      const fileName = fp.split('/').slice(-1)[0] || fp
      if (!fileMap.has(fileName)) fileMap.set(fileName, [])
      const line = `${node.type}:${node.label}${node.metadata?.summary ? ` — ${node.metadata.summary.slice(0, 80)}` : ''}`
      fileMap.get(fileName)!.push(line)
    }
    return [...fileMap.entries()].slice(0, 25).map(([f, syms]) =>
      `${f}: ${syms.slice(0, 5).join('; ')}`
    ).join('\n')
  } catch {
    return ''
  }
}
