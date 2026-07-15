/**
 * Cross-source Tour Generator — builds a comparison Tour from concept_links
 * that alternates between paper excerpts and code nodes.
 *
 * roadmap 3.6: "≥3 step comparison Tour"
 * roadmap 3.8: "cross-source Agent context"
 */
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { listConceptLinks, getPaper, getProject } from '../db'
import type { ConceptLinkRow, PaperRow, ProjectRow } from '../db'
import { loadGraph } from './graph-reader'

interface GraphNode {
  id: string
  type: string
  label?: string
  filePath?: string
  metadata?: { summary?: string }
}

/** A step in the cross-source tour — alternates paper ↔ code */
interface CrossTourStep {
  order: number
  title: string
  description: string
  nodeIds: string[]
  paperContext?: { arxivId: string; title: string; excerpt: string }
}

export interface CrossTourResult {
  stepCount: number
  tourSteps: Array<{ order: number; title: string; description: string; nodeIds: string[] }>
  summary: string
}

export function generateCrossTour(projectId: string): CrossTourResult | null {
  const project = getProject(projectId)
  if (!project) return null

  const graphPath = join(project.root_path, '.understand-anything', 'knowledge-graph.json')
  if (!existsSync(graphPath)) return null

  const graph = loadGraph(project.root_path)
  if (!graph) return null

  const links = listConceptLinks(projectId)
  if (links.length === 0) return null

  const nodes = (graph.nodes || []) as GraphNode[]
  const nodeMap = new Map<string, GraphNode>()
  for (const n of nodes) nodeMap.set(n.id, n)

  interface EnrichedLink { link: ConceptLinkRow; paper: PaperRow; node: GraphNode }
  const enriched: EnrichedLink[] = []
  for (const link of links) {
    const paper = getPaper(link.paper_id)
    const node = nodeMap.get(link.node_id)
    if (paper && node) enriched.push({ link, paper, node })
  }
  if (enriched.length === 0) return null

  const tourSteps: CrossTourStep[] = []
  let order = 0

  tourSteps.push({
    order: order++,
    title: `概念桥接导览: ${project.name}`,
    description: `本项目有 ${enriched.length} 个论文↔代码桥接。`,
    nodeIds: [],
  })

  for (const { link, paper, node } of enriched) {
    const nodeName = node.label || node.id
    const nodeType = node.type || 'unknown'

    tourSteps.push({
      order: order++,
      title: `📰 ${paper.title.slice(0, 60)}`,
      description: link.anchor_text
        ? `论文摘录: "${link.anchor_text.slice(0, 300)}"`
        : `论文: ${paper.title}\n\n${paper.summary.slice(0, 300)}`,
      nodeIds: [],
      paperContext: { arxivId: paper.arxiv_id, title: paper.title, excerpt: link.anchor_text || paper.summary.slice(0, 200) },
    })

    const codeDesc = [
      `对应代码: **${nodeName}** (${nodeType})`,
      node.filePath ? `文件: \`${node.filePath}\`` : '',
      node.metadata?.summary ? `摘要: ${node.metadata.summary}` : '',
      link.note ? `笔记: ${link.note}` : '',
    ].filter(Boolean).join('\n\n')

    tourSteps.push({ order: order++, title: `💻 ${nodeName}`, description: codeDesc, nodeIds: [node.id] })
  }

  if (enriched.length > 1) {
    tourSteps.push({
      order: order++,
      title: '桥接总览',
      description: buildSummary(enriched, project),
      nodeIds: enriched.map(e => e.node.id),
    })
  }

  const uaSteps = tourSteps.map(s => ({ order: s.order, title: s.title, description: s.description, nodeIds: s.nodeIds }))

  const graphJson = JSON.parse(readFileSync(graphPath, 'utf-8'))
  graphJson.tour = uaSteps
  writeFileSync(graphPath, JSON.stringify(graphJson, null, 2), 'utf-8')

  const summaryLines = [
    `## 跨源对照 Tour: ${project.name}`,
    '', `基于 **${enriched.length}** 个论文↔代码桥接，生成 **${uaSteps.length}** 步对照导览。`, '',
    ...enriched.map((e, i) => `${i + 1}. 📰 **${e.paper.title.slice(0, 50)}** → 💻 **${e.node.label || e.link.node_id}**`),
    '', '在「代码地图」中点击 Tour 即可跟随导览。', '',
  ]

  return { stepCount: uaSteps.length, tourSteps: uaSteps, summary: summaryLines.join('\n') }
}

function buildSummary(items: Array<{ paper: PaperRow; node: GraphNode; link: ConceptLinkRow }>, project: ProjectRow): string {
  const paperSet = new Set(items.map(i => i.paper.arxiv_id))
  const nodeCount = new Set(items.map(i => i.node.id)).size
  return [
    `本项目 **${project.name}** 通过概念桥接关联了:`,
    `- **${paperSet.size}** 篇论文`, `- **${nodeCount}** 个代码节点`, `- **${items.length}** 个桥接关系`,
    '', '这些桥接帮助你从理论直接跳转到实现。',
  ].join('\n')
}

export interface CrossSourceContext {
  paperTitle: string; arxivId: string; excerpt: string
  nodeId: string; nodeName: string; nodeType: string; nodeFile: string; note: string
}

export function buildCrossSourceContext(projectId: string): CrossSourceContext[] {
  const project = getProject(projectId)
  if (!project) return []

  const links = listConceptLinks(projectId)
  if (links.length === 0) return []

  const graphPath = join(project.root_path, '.understand-anything', 'knowledge-graph.json')
  let graphNodes: GraphNode[] = []
  if (existsSync(graphPath)) {
    try { const g = JSON.parse(readFileSync(graphPath, 'utf-8')); graphNodes = g.nodes || [] } catch { /* ignore */ }
  }
  const nodeMap = new Map<string, GraphNode>()
  for (const n of graphNodes) nodeMap.set(n.id, n)

  const context: CrossSourceContext[] = []
  for (const link of links.slice(0, 20)) {
    const paper = getPaper(link.paper_id)
    const node = nodeMap.get(link.node_id)
    if (!paper || !node) continue
    context.push({
      paperTitle: paper.title, arxivId: paper.arxiv_id,
      excerpt: link.anchor_text || paper.summary.slice(0, 300),
      nodeId: link.node_id,
      nodeName: node.label || node.id, nodeType: node.type || 'unknown',
      nodeFile: node.filePath || '', note: link.note || '',
    })
  }
  return context
}
