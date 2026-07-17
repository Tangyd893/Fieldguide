/**
 * Context Packer — OpenClaw-style first-turn injection for Fieldguide Coach Agent.
 * Builds project identity, architecture snapshot, query-aware graph slice, and optional paper RAG.
 */
import { listPapers } from '../db'
import {
  loadGraph,
  getNode,
  type KnowledgeGraph,
  type GraphNode,
  type TourStep,
  type Tour,
  type Layer,
} from '../ua/graph-reader'
import { buildCrossSourceContext } from '../ua/cross-tour'
import { queryPaper } from '../vector'
import { searchNodesFuzzy, type SearchableNode } from './ua-search'
import type { AgentContext } from './types'

export type CoachIntent = 'overview' | 'paper' | 'code' | 'general'

const MAX_PACK_CHARS = 10_000
const MAX_SLICE_NODES = 12
const MAX_SUMMARY = 160

export function detectCoachIntent(query: string): CoachIntent {
  const q = query.toLowerCase()
  if (
    /介绍|入口|overview|architecture|架构|分层|是什么项目|这个项目|what is this project|entry\s*point|introduce|guide me|导览/.test(q)
  ) {
    return 'overview'
  }
  if (/论文|paper|arxiv|rag|chunk|这篇|对照|概念桥/.test(q)) {
    return 'paper'
  }
  if (/怎么实现|如何|where|how does|函数|模块|调用|认证|auth|billing/.test(q)) {
    return 'code'
  }
  return 'general'
}

/** Normalize FG graph nodes for fuzzy search (name/summary/tags at top level). */
export function toSearchableNodes(nodes: GraphNode[]): SearchableNode[] {
  return nodes.map((n): SearchableNode => {
    const summary = String(
      n.metadata?.summary
      || (typeof n.summary === 'string' ? n.summary : '')
      || '',
    )
    const tags = (n.metadata?.tags as string[] | undefined)
      || (Array.isArray(n.tags) ? (n.tags as string[]) : [])
      || []
    const complexity = (n.metadata?.complexity as SearchableNode['complexity'] | undefined)
      || (n.complexity as SearchableNode['complexity'] | undefined)
      || 'moderate'
    return {
      id: n.id,
      type: n.type || 'file',
      name: String(n.name || n.label || n.id),
      filePath: n.filePath,
      lineRange: n.lineRange,
      summary,
      tags,
      complexity,
      languageNotes: typeof n.metadata?.languageNotes === 'string'
        ? n.metadata.languageNotes
        : undefined,
    }
  })
}

export function flattenTourSteps(graph: KnowledgeGraph): TourStep[] {
  const tour = graph.tour
  if (!Array.isArray(tour) || tour.length === 0) return []
  const first = tour[0] as Tour | TourStep
  if (first && typeof first === 'object' && 'steps' in first && Array.isArray((first as Tour).steps)) {
    return (tour as Tour[]).flatMap((t) => t.steps || [])
  }
  return tour as TourStep[]
}

function nodeSummary(n: GraphNode): string {
  const s = String(n.metadata?.summary || n.summary || '')
  return s.slice(0, MAX_SUMMARY)
}

function nodeLabel(n: GraphNode): string {
  return String(n.name || n.label || n.id)
}

function synthesizeDescription(graph: KnowledgeGraph): string {
  const layers = graph.layers || []
  const layerNames = layers.slice(0, 8).map((l) => l.name).filter(Boolean)
  const langs = readProjectField(graph, 'languages') as string[] | undefined
  const frameworks = readProjectField(graph, 'frameworks') as string[] | undefined

  const entryHints: string[] = []
  for (const n of graph.nodes) {
    const name = nodeLabel(n).toLowerCase()
    const path = (n.filePath || '').toLowerCase()
    const tags = ((n.metadata?.tags as string[]) || []).map((t) => t.toLowerCase())
    if (
      name === 'main'
      || path.endsWith('main.go')
      || path.includes('/cmd/')
      || path.includes('\\cmd\\')
      || tags.includes('entrypoint')
      || tags.includes('main')
      || name === 'readme.md'
      || path.endsWith('readme.md')
    ) {
      const sum = nodeSummary(n)
      entryHints.push(
        `${nodeLabel(n)}${n.filePath ? ` (${n.filePath})` : ''}${sum ? `: ${sum}` : ''}`,
      )
      if (entryHints.length >= 4) break
    }
  }

  const parts: string[] = []
  if (langs?.length) parts.push(`Languages: ${langs.join(', ')}`)
  if (frameworks?.length) parts.push(`Frameworks: ${frameworks.join(', ')}`)
  if (layerNames.length) parts.push(`Architecture layers: ${layerNames.join(', ')}`)
  if (entryHints.length) parts.push(`Likely entry points:\n- ${entryHints.join('\n- ')}`)
  if (parts.length === 0) {
    return `Indexed graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges. No project description yet.`
  }
  return parts.join('\n')
}

function readProjectField(graph: KnowledgeGraph, key: string): unknown {
  const p = graph.project as Record<string, unknown> | undefined
  const m = graph.meta as Record<string, unknown> | undefined
  return p?.[key] ?? m?.[key]
}

function formatLayers(layers: Layer[]): string {
  if (!layers.length) return '(no layers)'
  return layers.slice(0, 12).map((l) => {
    const count = l.nodeIds?.length ?? 0
    const desc = (l.description || '').slice(0, 120)
    return `- ${l.name} (${count} nodes)${desc ? `: ${desc}` : ''}`
  }).join('\n')
}

function formatTour(steps: TourStep[], currentIndex?: number | null): string {
  if (!steps.length) return '(no tour)'
  const lines = steps.slice(0, 5).map((s, i) => {
    const order = s.order ?? i + 1
    const mark = currentIndex != null && currentIndex === i ? ' ← current' : ''
    return `${order}. ${s.title || 'Step'}${mark}${(s.description || '').slice(0, 100) ? ` — ${(s.description || '').slice(0, 100)}` : ''}`
  })
  if (steps.length > 5) lines.push(`… +${steps.length - 5} more steps`)
  return lines.join('\n')
}

async function formatQuerySlice(
  graph: KnowledgeGraph,
  query: string,
  intent: CoachIntent,
): Promise<{ text: string; nodeIds: string[] }> {
  if (!query.trim() || intent === 'overview') {
    // For overview, prefer entry-like nodes + first layer samples
    const picks: GraphNode[] = []
    const seen = new Set<string>()
    for (const n of graph.nodes) {
      const name = nodeLabel(n).toLowerCase()
      const path = (n.filePath || '').toLowerCase()
      const tags = ((n.metadata?.tags as string[]) || []).map((t) => t.toLowerCase())
      if (
        name === 'main'
        || path.includes('/cmd/')
        || tags.includes('entrypoint')
        || name === 'readme.md'
        || path.endsWith('readme.md')
      ) {
        if (!seen.has(n.id)) {
          seen.add(n.id)
          picks.push(n)
        }
      }
      if (picks.length >= 8) break
    }
    // Add a few nodes from first layers
    for (const layer of (graph.layers || []).slice(0, 3)) {
      for (const id of (layer.nodeIds || []).slice(0, 2)) {
        const n = getNode(graph, id)
        if (n && !seen.has(n.id)) {
          seen.add(n.id)
          picks.push(n)
        }
      }
    }
    return {
      text: formatNodesBlock(picks, graph),
      nodeIds: picks.map((n) => n.id),
    }
  }

  const searchable = toSearchableNodes(graph.nodes)
  const results = await searchNodesFuzzy(searchable, query, MAX_SLICE_NODES)
  const matchedIds = new Set(results.map((r) => r.nodeId))

  // 1-hop expansion
  const expanded = new Set(matchedIds)
  for (const edge of graph.edges) {
    if (matchedIds.has(edge.source)) expanded.add(edge.target)
    if (matchedIds.has(edge.target)) expanded.add(edge.source)
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const relevant: GraphNode[] = []
  for (const id of expanded) {
    const n = nodeMap.get(id)
    if (n) relevant.push(n)
    if (relevant.length >= MAX_SLICE_NODES + 8) break
  }

  // Prefer matched first
  relevant.sort((a, b) => {
    const am = matchedIds.has(a.id) ? 0 : 1
    const bm = matchedIds.has(b.id) ? 0 : 1
    return am - bm
  })

  const trimmed = relevant.slice(0, MAX_SLICE_NODES)
  const relevantLayers = (graph.layers || []).filter((layer) =>
    (layer.nodeIds || []).some((id) => expanded.has(id)),
  )

  const parts: string[] = []
  if (relevantLayers.length) {
    parts.push('### Relevant layers')
    parts.push(formatLayers(relevantLayers.slice(0, 6)))
  }
  parts.push('### Relevant nodes')
  parts.push(formatNodesBlock(trimmed, graph))

  // Compact relationships
  const edgeLines: string[] = []
  for (const e of graph.edges) {
    if (!expanded.has(e.source) || !expanded.has(e.target)) continue
    const sn = nodeMap.get(e.source)
    const tn = nodeMap.get(e.target)
    if (!sn || !tn) continue
    edgeLines.push(`- ${nodeLabel(sn)} --[${e.type || 'related'}]--> ${nodeLabel(tn)}`)
    if (edgeLines.length >= 15) break
  }
  if (edgeLines.length) {
    parts.push('### Relationships')
    parts.push(edgeLines.join('\n'))
  }

  return { text: parts.join('\n'), nodeIds: trimmed.map((n) => n.id) }
}

function formatNodesBlock(nodes: GraphNode[], _graph: KnowledgeGraph): string {
  if (!nodes.length) return '(no matching nodes)'
  return nodes.map((n) => {
    const sum = nodeSummary(n)
    return `- [${n.id}] ${nodeLabel(n)} (${n.type})${n.filePath ? ` @ ${n.filePath}` : ''}${sum ? `\n  ${sum}` : ''}`
  }).join('\n')
}

export interface PackedContext {
  intent: CoachIntent
  markdown: string
  seedNodeIds: string[]
}

/**
 * Build the injected context block for one user turn.
 */
export async function packCoachContext(
  ctx: AgentContext,
  userQuery: string,
): Promise<PackedContext> {
  const intent = detectCoachIntent(userQuery)
  const graph = loadGraph(ctx.projectRoot)
  const sections: string[] = []
  const seedNodeIds: string[] = []

  if (!graph) {
    return {
      intent,
      markdown: `## Project\nName: ${ctx.projectName}\n(Graph not indexed yet — ask the user to index the project.)`,
      seedNodeIds: [],
    }
  }

  const rawDesc = String(readProjectField(graph, 'description') || '').trim()
  const description = rawDesc || synthesizeDescription(graph)
  const languages = (readProjectField(graph, 'languages') as string[] | undefined) || []
  const frameworks = (readProjectField(graph, 'frameworks') as string[] | undefined) || []

  sections.push('## Project identity')
  sections.push(`Name: ${ctx.projectName}`)
  sections.push(description)
  if (languages.length) sections.push(`Languages: ${languages.join(', ')}`)
  if (frameworks.length) sections.push(`Frameworks: ${frameworks.join(', ')}`)
  sections.push(`Graph size: ${graph.nodes.length} nodes, ${graph.edges.length} edges`)

  sections.push('\n## Architecture layers')
  sections.push(formatLayers(graph.layers || []))

  const tourSteps = flattenTourSteps(graph)
  sections.push('\n## Guided tour (first steps)')
  sections.push(formatTour(tourSteps, ctx.tourStepIndex))

  if (ctx.focusedNodeId) {
    const focused = getNode(graph, ctx.focusedNodeId)
    sections.push('\n## Currently focused node')
    if (focused) {
      sections.push(
        `- [${focused.id}] ${nodeLabel(focused)} (${focused.type})${focused.filePath ? ` @ ${focused.filePath}` : ''}`,
      )
      const sum = nodeSummary(focused)
      if (sum) sections.push(`  ${sum}`)
      seedNodeIds.push(focused.id)
    } else {
      sections.push(`- id: ${ctx.focusedNodeId} (not found in graph)`)
    }
  }

  const slice = await formatQuerySlice(graph, userQuery, intent)
  sections.push('\n## Query-relevant graph slice')
  sections.push(slice.text)
  seedNodeIds.push(...slice.nodeIds)

  const papers = listPapers().slice(0, 8)
  if (papers.length) {
    sections.push('\n## Saved papers')
    sections.push(papers.map((p) => `- ${p.title} (arxiv:${p.arxiv_id})`).join('\n'))
  }

  const bridges = buildCrossSourceContext(ctx.projectId).slice(0, 8)
  if (bridges.length) {
    sections.push('\n## Concept bridges (paper ↔ code)')
    sections.push(
      bridges.map((c) =>
        `- ${c.paperTitle} ↔ [${c.nodeId}] ${c.nodeName}${c.nodeFile ? ` @ ${c.nodeFile}` : ''}`,
      ).join('\n'),
    )
  }

  if (intent === 'paper' || /论文|paper|概念|chunk|rag/i.test(userQuery)) {
    try {
      const hits = await queryPaper(userQuery, undefined, 3)
      if (hits.length) {
        sections.push('\n## Paper RAG (auto top-3)')
        sections.push(
          hits.map((h, i) =>
            `${i + 1}. (score ${h.score.toFixed(3)}) ${h.chunk.text.slice(0, 400)}`,
          ).join('\n\n'),
        )
      }
    } catch {
      /* embeddings may be unconfigured */
    }
  }

  let markdown = sections.join('\n')
  if (markdown.length > MAX_PACK_CHARS) {
    markdown = `${markdown.slice(0, MAX_PACK_CHARS)}\n\n…(context truncated)`
  }

  return {
    intent,
    markdown,
    seedNodeIds: [...new Set(seedNodeIds)],
  }
}

export function coachPolicyHints(intent: CoachIntent): string {
  const common = [
    'You are Fieldguide Coach — a learning coach for this local codebase (not a generic coding agent).',
    'Answer from the injected context first. Use tools only to fill missing details.',
    'When referencing code nodes, include their id like [node:function:path:name].',
    'Do not repeatedly read the same file/node. Prefer synthesizing a clear answer.',
  ]
  if (intent === 'overview') {
    return [
      ...common,
      'This is an overview / entry-point question: answer directly with project intro, entry points, and layers.',
      'Avoid unnecessary tool loops; one tool call is enough only if a critical detail is missing.',
    ].join('\n')
  }
  if (intent === 'paper') {
    return [
      ...common,
      'Connect paper excerpts to code nodes and concept bridges when possible.',
    ].join('\n')
  }
  return common.join('\n')
}
