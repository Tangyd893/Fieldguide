/**
 * Learning report export and tech-debt scan.
 *
 * Both are read-only aggregations over data the app already has (SQLite
 * artefacts + the graph + the source tree), assembled in main because the
 * renderer has no filesystem or database access.
 */
import { statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getProject,
  getArchitectureSummary,
  listKnowledgeNodes,
  listQuestions,
  listConceptLinks,
  listChatMessages,
  getPaper,
  type ProjectRow,
} from './db'
import { loadGraph, getGraphStats, type KnowledgeGraph } from './ua/graph-reader'
import { atomicWriteFileSync } from './fs-atomic'

/* ──────────── Learning report ──────────── */

export interface ReportResult {
  markdown: string
  exportPath: string
  exportDir: string
}

function bullet(items: string[], empty = '_（暂无）_'): string {
  return items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : empty
}

function csv(link: { anchor_text: string; note: string }): string {
  return [link.anchor_text, link.note].filter(Boolean).join(' / ')
}

/**
 * Build a Markdown study report for a project.
 *
 * Covers what the workbench actually produced: architecture mapping, knowledge
 * cards, interview drill, paper↔code bridges and graph scale — i.e. the artefact
 * a user can hand in or paste into notes.
 */
export function buildLearningReport(projectId: string, generatedAt = new Date()): { markdown: string; fileName: string } {
  const project = getProject(projectId)
  if (!project) throw new Error(`project ${projectId} not found`)

  const architecture = getArchitectureSummary(projectId)
  const knowledge = listKnowledgeNodes(projectId)
  const questions = listQuestions(projectId)
  const links = listConceptLinks(projectId)
  const chat = listChatMessages(projectId, 200)
  const graph = loadGraph(project.root_path)
  const stats = graph ? getGraphStats(graph) : null

  const lines: string[] = []
  lines.push(`# ${project.name} · 学习报告`, '')
  lines.push(`> 生成时间：${generatedAt.toISOString()} · 工具：Fieldguide`)
  lines.push(`> 项目路径：\`${project.root_path}\``)
  if (project.indexed_at) lines.push(`> 最近索引：${project.indexed_at}`)
  lines.push('')

  lines.push('## 一、规模概览', '')
  lines.push('| 指标 | 数值 |', '|------|------|')
  lines.push(`| 图谱节点 | ${stats?.nodeCount ?? project.node_count} |`)
  lines.push(`| 图谱边 | ${stats?.edgeCount ?? '—'} |`)
  lines.push(`| 架构分层 | ${architecture?.layers.length ?? 0} |`)
  lines.push(`| 知识卡片 | ${knowledge.length} |`)
  lines.push(`| 面试题 | ${questions.length} |`)
  lines.push(`| 论文桥接 | ${links.length} |`)
  lines.push(`| 问答轮次 | ${Math.floor(chat.filter((m) => m.role === 'user').length)} |`)
  lines.push('')

  lines.push('## 二、架构映射', '')
  if (!architecture) {
    lines.push('_尚未生成架构总览——在「总览」面板点「生成总览」。_', '')
  } else {
    lines.push(`来源：${architecture.source === 'llm' ? 'LLM 分析' : '启发式'} · 生成于 ${architecture.generatedAt}`, '')
    if (architecture.stack.length) {
      lines.push('**技术栈**', '', bullet(architecture.stack), '')
    }
    if (architecture.entryPoints?.length) {
      lines.push('**入口**', '', bullet(architecture.entryPoints.map((e) => `\`${e}\``)), '')
    }
    if (architecture.layers.length) {
      lines.push('**分层**', '')
      for (const layer of architecture.layers) {
        lines.push(`- **${layer.name}**${layer.description ? ` — ${layer.description}` : ''}`)
      }
      lines.push('')
    }
    if (architecture.modules.length) {
      lines.push('**模块**', '')
      for (const mod of architecture.modules) {
        lines.push(`- **${mod.name}**${mod.layer ? ` (${mod.layer})` : ''}${mod.description ? ` — ${mod.description}` : ''}`)
      }
      lines.push('')
    }
    if (architecture.keyFlows.length) {
      lines.push('**主数据流**', '')
      for (const flow of architecture.keyFlows) {
        lines.push(`- **${flow.name}**${flow.description ? ` — ${flow.description}` : ''}`)
        for (const step of flow.steps ?? []) lines.push(`  - ${step}`)
      }
      lines.push('')
    }
    if (architecture.techChoices.length) {
      lines.push('**技术选型**', '')
      for (const tech of architecture.techChoices) {
        lines.push(`- **${tech.name}**${tech.reason ? ` — ${tech.reason}` : ''}${tech.alternatives?.length ? `（备选：${tech.alternatives.join('、')}）` : ''}`)
      }
      lines.push('')
    }
  }

  lines.push('## 三、知识卡片', '')
  if (knowledge.length === 0) {
    lines.push('_尚未抽取知识卡片——在「知识」面板点「抽取知识」。_', '')
  } else {
    for (const card of knowledge) {
      lines.push(`### ${card.concept}`, '')
      if (card.principle) lines.push(`**原理**：${card.principle}`, '')
      if (card.tradeoffs) lines.push(`**取舍**：${card.tradeoffs}`, '')
      if (card.examples) lines.push(`**示例**：${card.examples}`, '')
      if (card.relatedNodeIds.length) {
        lines.push(`**相关代码**：${card.relatedNodeIds.map((id) => `\`${id}\``).join('、')}`, '')
      }
    }
  }

  lines.push('## 四、面试演练', '')
  if (questions.length === 0) {
    lines.push('_尚未生成面试题——在「面试」面板点「生成题目」。_', '')
  } else {
    questions.forEach((q, i) => {
      lines.push(`### Q${i + 1}. ${q.problem}`, '')
      if (q.context) lines.push(`**背景**：${q.context}`, '')
      if (q.answer) lines.push(`**参考回答**：${q.answer}`, '')
      if (q.relatedConcepts.length) lines.push(`**涉及概念**：${q.relatedConcepts.join('、')}`, '')
      lines.push('')
    })
  }

  lines.push('## 五、论文 ↔ 实现桥接', '')
  if (links.length === 0) {
    lines.push('_尚未建立桥接——在「桥接」页把论文段落关联到代码节点。_', '')
  } else {
    lines.push('| 论文 | 论文段落 / 备注 | 代码节点 |', '|------|------|------|')
    for (const link of links) {
      const paper = getPaper(link.paper_id)
      const title = paper ? `${paper.title.slice(0, 60)}${paper.title.length > 60 ? '…' : ''} (arXiv:${paper.arxiv_id})` : link.paper_id
      lines.push(`| ${title} | ${csv(link) || '—'} | \`${link.node_id}\` |`)
    }
    lines.push('')
  }

  lines.push('---', '', '_由 Fieldguide 生成。图谱权威源在项目目录 `.understand-anything/knowledge-graph.json`。_', '')
  const markdown = lines.join('\n')
  const safeSlug = project.slug || project.name.replace(/[^\w.-]+/g, '-').toLowerCase()
  const stamp = generatedAt.toISOString().slice(0, 10)
  return { markdown, fileName: `${safeSlug}-learning-report-${stamp}.md` }
}

/** Write the report into `<appData>/Fieldguide/exports/` and return its path. */
export function writeLearningReport(projectId: string, exportDir: string): { exportPath: string; markdown: string } {
  const { markdown, fileName } = buildLearningReport(projectId)
  const exportPath = join(exportDir, fileName)
  atomicWriteFileSync(exportPath, markdown)
  return { exportPath, markdown }
}

/* ──────────── Tech-debt scan ──────────── */

export interface DebtItem {
  kind: 'todo' | 'large-file' | 'high-fan-in' | 'no-summary'
  detail: string
  path?: string
  line?: number
  nodeId?: string
  weight: number
}

export interface DebtScanResult {
  items: DebtItem[]
  counts: Record<DebtItem['kind'], number>
  filesScanned: number
}

const MARKER_PATTERN = /\b(TODO|FIXME|HACK|XXX|BUG)\b[:\s]*(.{0,120})?/i
const LARGE_FILE_LINES = 400
const HIGH_FAN_IN = 8

/**
 * Scan for the things a reader wants flagged on arrival: unfinished work
 * markers, oversized files, and nodes that everything depends on (change risk).
 */
export async function scanProjectDebt(
  projectId: string,
  opts: { maxItems?: number; maxFiles?: number } = {},
): Promise<DebtScanResult> {
  const project = getProject(projectId)
  if (!project) throw new Error(`project ${projectId} not found`)

  const maxItems = opts.maxItems ?? 120
  const maxFiles = opts.maxFiles ?? 600
  const graph = loadGraph(project.root_path)
  const items: DebtItem[] = []
  let filesScanned = 0

  // ── Unfinished-work markers + oversized files ──
  const fileNodes = (graph?.nodes ?? []).filter((n) => n.type === 'file' && n.filePath)
  for (const node of fileNodes.slice(0, maxFiles)) {
    const rel = node.filePath!
    let content: string
    try {
      const full = join(project.root_path, rel)
      if (statSync(full).size > 512_000) continue
      content = readFileSync(full, 'utf-8')
    } catch {
      continue
    }
    if (content.includes('\u0000')) continue
    filesScanned += 1

    const lines = content.split('\n')
    lines.forEach((line, i) => {
      const m = line.match(MARKER_PATTERN)
      if (!m) return
      items.push({
        kind: 'todo',
        detail: `${m[1].toUpperCase()}${m[2] ? `: ${m[2].trim()}` : ''}`,
        path: rel,
        line: i + 1,
        weight: m[1].toUpperCase() === 'FIXME' || m[1].toUpperCase() === 'BUG' ? 3 : 1,
      })
    })

    if (lines.length > LARGE_FILE_LINES) {
      items.push({
        kind: 'large-file',
        detail: `${lines.length} 行（建议拆分或先精读）`,
        path: rel,
        weight: 2,
      })
    }
  }

  // ── Dependency hotspots from the graph ──
  if (graph) {
    const fanIn = new Map<string, number>()
    for (const edge of graph.edges ?? []) {
      if (edge.type === 'contains') continue
      fanIn.set(edge.target, (fanIn.get(edge.target) ?? 0) + 1)
    }
    const byId = new Map(graph.nodes.map((n) => [n.id, n]))
    for (const [id, count] of fanIn) {
      if (count < HIGH_FAN_IN) continue
      const node = byId.get(id)
      items.push({
        kind: 'high-fan-in',
        detail: `被 ${count} 处依赖`,
        path: node?.filePath,
        nodeId: id,
        weight: Math.min(10, count),
      })
    }
  }

  items.sort((a, b) => b.weight - a.weight)
  const limited = items.slice(0, maxItems)

  const counts: Record<DebtItem['kind'], number> = {
    todo: 0, 'large-file': 0, 'high-fan-in': 0, 'no-summary': 0,
  }
  for (const item of items) counts[item.kind] += 1

  return { items: limited, counts, filesScanned }
}

export type { ProjectRow, KnowledgeGraph }
