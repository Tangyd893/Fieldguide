/**
 * Card builders — the project's "拆解产物" turned into Obsidian notes.
 *
 * Split in two on purpose:
 *
 *   - `buildProjectNotes(sources)` is pure: it takes plain data and returns the
 *     notes to write, so the mapping (including the empty-data fallbacks) is
 *     unit-testable without SQLite or a graph on disk.
 *   - `collectCardSources(projectId)` is the thin reader that assembles those
 *     sources from the database and the knowledge graph.
 *
 * Only derived artefacts become notes — architecture, layers, the tour, knowledge
 * cards, interview drills, paper bridges, learning paths and the reader's own code
 * notes. A note per graph node would produce thousands of files for a real repo,
 * and the node-level detail is what Fieldguide itself is for.
 */
import { getProject, getArchitectureSummary, listKnowledgeNodes, listQuestions, listCodeNotes, listConceptLinks, listLearningPaths, listLearnProgress, getPaper, listProjects, type CodeNoteRow, type LearnProgressRow, type ProjectRow } from '../db'
import { loadGraph, type KnowledgeGraph } from '../ua/graph-reader'
import { buildLearningReport } from '../insights'
import { loadConfig } from '../config'
import { projectFolderName, projectFolderRelative } from './binding'
import { notePath, sanitizeNoteName, subfolderForKind, wikilink } from './render'
import type { VaultNoteDoc, VaultNoteKind } from './types'
import type { ArchitectureSummary, InterviewQuestion, KnowledgeNode } from '../../shared/understand'

/* ──────────── inputs ──────────── */

export interface CardProject {
  id: string
  name: string
  slug: string
  rootPath: string
  nodeCount: number
  indexedAt: string | null
}

export interface GraphLayerView {
  id: string
  name: string
  description: string
  nodeIds: string[]
}

export interface GraphNodeView {
  id: string
  label: string
  type: string
  filePath: string
  summary: string
}

export interface TourStepView {
  order: number
  title: string
  description: string
  nodeIds: string[]
}

export interface BridgeView {
  paperTitle: string
  arxivId: string
  anchorText: string
  note: string
  nodeId: string
}

export interface FanInView {
  nodeId: string
  label: string
  filePath: string
  count: number
}

export interface CardSources {
  project: CardProject
  /** Vault-relative folder this project owns, e.g. `Fieldguide/pulsegate`. */
  folderRel: string
  mirrorNotes: boolean
  updatedAt: string
  architecture: ArchitectureSummary | null
  layers: GraphLayerView[]
  tour: TourStepView[]
  nodes: GraphNodeView[]
  fanIn: FanInView[]
  knowledge: KnowledgeNode[]
  questions: InterviewQuestion[]
  notes: CodeNoteRow[]
  bridges: BridgeView[]
  paths: Array<{ goal: string; steps: Array<{ order: number; title: string; why?: string; nodeIds?: string[]; files?: string[] }>; source: string; createdAt: string }>
  progress: LearnProgressRow[]
  graphStats: { nodeCount: number; edgeCount: number } | null
  /** From `insights.buildLearningReport` — reused rather than re-aggregated. */
  reportMarkdown: string
}

/* ──────────── helpers ──────────── */

/** Status marker for a node the reader has already worked through. */
const PROGRESS_MARK: Record<string, string> = {
  mastered: '✅ 已掌握',
  reading: '📖 在读',
  unseen: '⬜ 未读',
}

function progressSuffix(nodeIds: string[], progress: Map<string, string>): string {
  const states = nodeIds.map((id) => progress.get(id)).filter(Boolean) as string[]
  if (states.length === 0) return ''
  const best = states.includes('mastered') ? 'mastered' : states.includes('reading') ? 'reading' : 'unseen'
  return ` · ${PROGRESS_MARK[best]}`
}

/** `` `path` `` reference plus the node id, so the panel can deep-link. */
function codeRef(node: GraphNodeView | undefined, fallbackId: string): string {
  if (!node) return `\`${fallbackId}\``
  return `\`${node.filePath || fallbackId}\` · \`${node.id}\``
}

function bullet(items: string[], empty = '_(暂无)_'): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : empty
}

/* ──────────── builders ──────────── */

export function buildProjectNotes(sources: CardSources): VaultNoteDoc[] {
  const docs: VaultNoteDoc[] = []
  const taken = new Set<string>()
  const nodeById = new Map(sources.nodes.map((node) => [node.id, node]))
  const progress = new Map(sources.progress.map((row) => [row.node_id, row.status]))

  const sub = (kind: VaultNoteKind, title: string): string =>
    notePath(sources.folderRel, subfolderForKind(kind), sanitizeNoteName(title, taken))

  const indexTitle = `${sources.project.name} · 项目索引`
  const indexRef = (): string => wikilink(indexTitle, '项目索引')
  const indexNotePath = notePath(sources.folderRel, '', sanitizeNoteName(indexTitle, taken))

  /* ── cards: architecture ── */
  if (sources.architecture) {
    const arch = sources.architecture
    const body = [
      `> 由 Fieldguide 从 \`${sources.project.rootPath}\` 的图谱与 LLM 分析生成。返回 ${indexRef()}。`,
      '',
      arch.source === 'llm' ? '_来源：LLM 分析_' : '_来源：启发式分析（未配置 LLM Key）_',
      '',
      '## 技术栈',
      bullet(arch.stack.map((item) => `\`${item}\``)),
      '',
      '## 入口',
      bullet((arch.entryPoints ?? []).map((entry) => `\`${entry}\``)),
      '',
      '## 分层',
      bullet(arch.layers.map((layer) => `**${layer.name}**${layer.description ? ` — ${layer.description}` : ''}`)),
      '',
      '## 模块',
      bullet(arch.modules.map((mod) => `**${mod.name}**${mod.layer ? ` (${mod.layer})` : ''}${mod.description ? ` — ${mod.description}` : ''}`)),
      '',
      '## 主数据流',
      arch.keyFlows.length > 0
        ? arch.keyFlows.map((flow) => [
          `### ${flow.name}`,
          flow.description ?? '',
          ...(flow.steps ?? []).map((step, i) => `${i + 1}. ${step}`),
        ].filter(Boolean).join('\n')).join('\n\n')
        : '_(暂无)_',
      '',
      '## 技术选型',
      bullet(arch.techChoices.map((tech) => `**${tech.name}**${tech.reason ? ` — ${tech.reason}` : ''}${tech.alternatives?.length ? `（备选：${tech.alternatives.join('、')}）` : ''}`)),
    ].join('\n')
    docs.push({ notePath: sub('architecture', '架构总览'), title: '架构总览', kind: 'architecture', sourceId: arch.projectId, nodeIds: [], body })
  }

  /* ── cards: layers (graph layers carry the node ids; the summary does not) ── */
  const layerNames = new Set(sources.layers.map((layer) => layer.name))
  for (const layer of sources.layers.slice(0, 20)) {
    const members = layer.nodeIds
      .map((id) => nodeById.get(id))
      .filter((node): node is GraphNodeView => Boolean(node))
      .slice(0, 12)
    const body = [
      `> 架构分层 **${layer.name}**${progressSuffix(layer.nodeIds, progress)}。返回 ${indexRef()}。`,
      '',
      layer.description || '_(该层没有描述)_',
      '',
      `共 ${layer.nodeIds.length} 个节点，下列为前 ${members.length} 个：`,
      '',
      bullet(members.map((node) => `${codeRef(node, node.id)}${node.summary ? ` — ${node.summary}` : ''}`)),
    ].join('\n')
    docs.push({
      notePath: sub('layer', `分层-${layer.name}`),
      title: `分层 · ${layer.name}`,
      kind: 'layer',
      sourceId: layer.id,
      nodeIds: layer.nodeIds.slice(0, 40),
      body: `${body}\n`,
    })
  }

  /* ── cards: modules that are not already a layer ── */
  for (const mod of sources.architecture?.modules ?? []) {
    if (layerNames.has(mod.name)) continue
    const body = [
      `> 模块 **${mod.name}**。返回 ${indexRef()}。`,
      '',
      mod.description || '_(该模块没有描述)_',
      '',
      bullet((mod.nodeIds ?? []).map((id) => codeRef(nodeById.get(id), id))),
    ].join('\n')
    docs.push({
      notePath: sub('module', `模块-${mod.name}`),
      title: `模块 · ${mod.name}`,
      kind: 'module',
      sourceId: mod.name,
      nodeIds: mod.nodeIds ?? [],
      body: `${body}\n`,
    })
  }

  /* ── cards: guided tour ── */
  for (const step of sources.tour.slice(0, 12)) {
    const body = [
      `> 引导 Tour 第 ${step.order} 步${progressSuffix(step.nodeIds, progress)}。返回 ${indexRef()}。`,
      '',
      step.description || '_(没有说明)_',
      '',
      '## 相关代码',
      bullet(step.nodeIds.map((id) => codeRef(nodeById.get(id), id))),
    ].join('\n')
    docs.push({
      notePath: sub('tour', `Tour-${String(step.order).padStart(2, '0')}-${step.title}`),
      title: `Tour ${step.order} · ${step.title}`,
      kind: 'tour',
      sourceId: `tour-${step.order}`,
      nodeIds: step.nodeIds,
      body: `${body}\n`,
    })
  }

  /* ── cards: knowledge ── */
  for (const card of sources.knowledge) {
    const body = [
      `> 知识卡片${progressSuffix(card.relatedNodeIds, progress)}。返回 ${indexRef()}。`,
      '',
      '## 原理',
      card.principle || '_(暂无)_',
      '',
      '## 取舍',
      card.tradeoffs || '_(暂无)_',
      '',
      '## 示例',
      card.examples || '_(暂无)_',
      '',
      '## 相关代码',
      bullet(card.relatedNodeIds.map((id) => codeRef(nodeById.get(id), id))),
    ].join('\n')
    docs.push({
      notePath: sub('knowledge', `知识-${card.concept}`),
      title: card.concept,
      kind: 'knowledge',
      sourceId: card.id,
      nodeIds: card.relatedNodeIds,
      body: `${body}\n`,
    })
  }

  /* ── cards: interview drill ── */
  sources.questions.slice(0, 15).forEach((question, index) => {
    const body = [
      `> 面试演练第 ${index + 1} 题。返回 ${indexRef()}。`,
      '',
      '## 背景',
      question.context || '_(暂无)_',
      '',
      '## 参考回答',
      question.answer || '_(暂无)_',
      '',
      '## 涉及概念',
      bullet(question.relatedConcepts),
      '',
      '## 相关代码',
      bullet(question.relatedNodeIds.map((id) => codeRef(nodeById.get(id), id))),
    ].join('\n')
    docs.push({
      notePath: sub('interview', `面试-${String(index + 1).padStart(2, '0')}-${question.problem}`),
      title: `面试 ${index + 1} · ${question.problem}`,
      kind: 'interview',
      sourceId: question.id,
      nodeIds: question.relatedNodeIds,
      body: `${body}\n`,
    })
  })

  /* ── cards: paper ↔ code bridges ── */
  for (const bridge of sources.bridges.slice(0, 20)) {
    const node = nodeById.get(bridge.nodeId)
    const body = [
      `> 论文 ↔ 实现桥接。返回 ${indexRef()}。`,
      '',
      `**论文**：${bridge.paperTitle}（arXiv:${bridge.arxivId}）`,
      '',
      `**论文段落**：${bridge.anchorText || '_(未标注)_'}`,
      '',
      `**对应实现**：${codeRef(node, bridge.nodeId)}`,
      bridge.note ? `\n**备注**：${bridge.note}` : '',
    ].filter(Boolean).join('\n')
    docs.push({
      notePath: sub('bridge', `桥接-${bridge.paperTitle}-${node?.label ?? bridge.nodeId}`),
      title: `桥接 · ${node?.label ?? bridge.nodeId}`,
      kind: 'bridge',
      sourceId: bridge.nodeId,
      nodeIds: [bridge.nodeId],
      body: `${body}\n`,
    })
  }

  /* ── cards: learning paths ── */
  for (const path of sources.paths.slice(0, 5)) {
    const body = [
      `> 学习路径（目标：${path.goal}）。返回 ${indexRef()}。`,
      '',
      ...path.steps.map((step) => [
        `## ${step.order}. ${step.title}`,
        step.why ? `_为什么_：${step.why}` : '',
        (step.files ?? []).length > 0 ? `文件：${(step.files ?? []).map((f) => `\`${f}\``).join('、')}` : '',
        (step.nodeIds ?? []).length > 0 ? `节点：${(step.nodeIds ?? []).map((id) => codeRef(nodeById.get(id), id)).join('、')}` : '',
      ].filter(Boolean).join('\n')),
    ].join('\n')
    docs.push({
      notePath: sub('path', `学习路径-${path.goal}`),
      title: `学习路径 · ${path.goal}`,
      kind: 'path',
      sourceId: path.goal,
      nodeIds: path.steps.flatMap((step) => step.nodeIds ?? []),
      body: `${body}\n`,
    })
  }

  /* ── cards: the reader's own code notes (mirrored, still theirs) ── */
  if (sources.mirrorNotes) {
    for (const note of sources.notes.slice(0, 50)) {
      const location = `${note.file_path}${note.line_start ? `:${note.line_start}` : ''}`
      const body = [
        '%% 下面这段是你在 Fieldguide 里写的批注（同步自应用内笔记）。 %%',
        '',
        note.body.trim(),
        '',
        '## 位置',
        `\`${location}\``,
        note.node_id ? `节点：\`${note.node_id}\`` : '',
        note.tags ? `标签：${note.tags.split(',').map((tag) => `#${tag.trim()}`).join(' ')}` : '',
        '',
        `返回 ${indexRef()}。`,
      ].filter(Boolean).join('\n')
      docs.push({
        notePath: sub('note', `笔记-${note.file_path.replace(/[/\\]/g, '-')}${note.line_start ? `-L${note.line_start}` : ''}`),
        title: `笔记 · ${location}`,
        kind: 'note',
        sourceId: note.id,
        nodeIds: note.node_id ? [note.node_id] : [],
        body: `${body}\n`,
      })
    }
  }

  /* ── the aggregate learning report (reuses insights.ts, not a second aggregator) ──
     Pushed before the index is rendered so the index can link to it. */
  if (sources.reportMarkdown.trim()) {
    docs.push({
      notePath: notePath(sources.folderRel, '', sanitizeNoteName(`${sources.project.slug}-学习报告`, taken)),
      title: `${sources.project.name} · 学习报告`,
      kind: 'report',
      sourceId: sources.project.id,
      nodeIds: [],
      body: `${sources.reportMarkdown.trim()}\n`,
    })
  }

  /* ── the index (MOC), rendered last so it can reference every card ── */
  const indexBody = buildIndexBody(sources, docs)
  docs.push({
    notePath: indexNotePath,
    title: indexTitle,
    kind: 'index',
    sourceId: sources.project.id,
    nodeIds: sources.fanIn.slice(0, 10).map((entry) => entry.nodeId),
    body: indexBody,
  })

  return docs
}

/** Group card docs by kind for the index, in reading order. */
const READING_ORDER: Array<{ kind: VaultNoteKind; heading: string; hint: string }> = [
  { kind: 'architecture', heading: '1. 架构总览', hint: '先看项目在讲什么故事' },
  { kind: 'layer', heading: '2. 架构分层', hint: '每层负责什么' },
  { kind: 'module', heading: '3. 模块', hint: '分层之外的关键模块' },
  { kind: 'tour', heading: '4. 引导 Tour', hint: '按顺序走一遍主链路' },
  { kind: 'knowledge', heading: '5. 知识卡片', hint: '原理 / 取舍 / 示例' },
  { kind: 'interview', heading: '6. 面试演练', hint: '自测是否真的理解' },
  { kind: 'bridge', heading: '7. 论文 ↔ 实现桥接', hint: '理论落到代码' },
  { kind: 'path', heading: '8. 学习路径', hint: '围绕目标读' },
  { kind: 'note', heading: '9. 我的代码笔记', hint: '自己写下的批注' },
]

function buildIndexBody(sources: CardSources, docs: VaultNoteDoc[]): string {
  const byKind = (kind: VaultNoteKind) => docs.filter((doc) => doc.kind === kind)
  const progressCount = (status: string) => sources.progress.filter((row) => row.status === status).length

  const lines: string[] = [
    `# ${sources.project.name} · 代码拆解索引`,
    '',
    `> 由 Fieldguide 生成于 ${sources.updatedAt.slice(0, 19).replace('T', ' ')}；源项目 \`${sources.project.rootPath}\`。`,
    // Deliberately does not spell out the marker itself: a note whose body contains
    // the literal marker text makes "where does the generated block start?" ambiguous.
    '> 「fieldguide 起止注释之间」的内容会在下次同步时更新；**你自己的笔记写在标记之外**，不会被覆盖。',
    '',
    '## 规模概览',
    '',
    '| 指标 | 数值 |',
    '|------|------|',
    `| 图谱节点 | ${sources.graphStats?.nodeCount ?? sources.project.nodeCount} |`,
    `| 图谱边 | ${sources.graphStats?.edgeCount ?? '—'} |`,
    `| 架构分层 | ${sources.layers.length} |`,
    `| 知识卡片 | ${sources.knowledge.length} |`,
    `| 面试题 | ${sources.questions.length} |`,
    `| 论文桥接 | ${sources.bridges.length} |`,
    `| 代码笔记 | ${sources.notes.length} |`,
    `| 最近索引 | ${sources.project.indexedAt ?? '—'} |`,
    '',
    '## 建议阅读顺序',
    '',
    ...READING_ORDER
      .filter((entry) => byKind(entry.kind).length > 0)
      .map((entry) => `- **${entry.heading}** — ${entry.hint}`),
    '',
  ]

  for (const entry of READING_ORDER) {
    const cards = byKind(entry.kind)
    if (cards.length === 0) continue
    lines.push(`## ${entry.heading}`, '')
    lines.push(...cards.map((card) => `- ${wikilink(card.title)}`))
    lines.push('')
  }

  const mastered = progressCount('mastered')
  const reading = progressCount('reading')
  if (mastered + reading > 0) {
    lines.push('## 我的学习进度', '')
    lines.push(`掌握 ${mastered} · 在读 ${reading} · 未读 ${progressCount('unseen')}`)
    lines.push('')
  }

  if (sources.fanIn.length > 0) {
    lines.push('## 值得先读的节点（被依赖最多）', '')
    lines.push(...sources.fanIn.slice(0, 10).map((entry) => {
      const node = sources.nodes.find((n) => n.id === entry.nodeId)
      return `- ${codeRef(node, entry.nodeId)} — 被 ${entry.count} 处依赖`
    }))
    lines.push('')
  }

  const reportDoc = byKind('report')[0]
  if (reportDoc) {
    lines.push('## 完整学习报告', '')
    lines.push(`- ${wikilink(reportDoc.title)}`)
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

/* ──────────── source reader ──────────── */

function toProject(project: ProjectRow): CardProject {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    rootPath: project.root_path,
    nodeCount: project.node_count,
    indexedAt: project.indexed_at,
  }
}

export interface CollectOptions {
  /** Overrides `config.obsidian.mirrorNotes` (used by tests and the panel). */
  mirrorNotes?: boolean
  updatedAt?: string
  /** Skip the (single-file, cached) learning report when it is not wanted. */
  includeReport?: boolean
}

/**
 * Read everything a project's cards are built from.
 *
 * Throws when the project is unknown; everything else degrades gracefully (a
 * project without a graph or without generated knowledge still yields an index).
 */
export function collectCardSources(projectId: string, opts: CollectOptions = {}): CardSources {
  const project = getProject(projectId)
  if (!project) throw new Error(`project ${projectId} not found`)

  const config = loadConfig()
  const allProjects = listProjects().map((row) => row.slug)
  const projectFolder = projectFolderName(project.slug, project.id, allProjects)
  const folderRel = projectFolderRelative(config.obsidian.folder, projectFolder)

  const graph = loadGraph(project.root_path)
  const nodes: GraphNodeView[] = (graph?.nodes ?? []).map((node) => ({
    id: node.id,
    label: node.label || node.name || node.id,
    type: node.type,
    filePath: node.filePath ?? '',
    summary: String(node.metadata?.summary || node.summary || '').slice(0, 200),
  }))
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  const layers: GraphLayerView[] = (graph?.layers ?? []).map((layer) => ({
    id: layer.id,
    name: layer.name,
    description: layer.description ?? '',
    nodeIds: (layer.nodeIds ?? []).filter((id) => nodeById.has(id)),
  }))

  const tour: TourStepView[] = flattenTour(graph).map((step, index) => ({
    order: step.order ?? index + 1,
    title: step.title || `Step ${index + 1}`,
    description: step.description ?? '',
    nodeIds: step.nodeIds ?? [],
  }))

  const fanIn = buildFanIn(graph, nodeById)

  const bridges: BridgeView[] = listConceptLinks(projectId).map((link) => {
    const paper = getPaper(link.paper_id)
    return {
      paperTitle: paper?.title ?? link.paper_id,
      arxivId: paper?.arxiv_id ?? '',
      anchorText: link.anchor_text,
      note: link.note,
      nodeId: link.node_id,
    }
  })

  let reportMarkdown = ''
  if (opts.includeReport !== false) {
    try {
      reportMarkdown = buildLearningReport(projectId).markdown
    } catch (err) {
      console.warn(`[obsidian/cards] learning report failed: ${String(err)}`)
    }
  }

  return {
    project: toProject(project),
    folderRel,
    mirrorNotes: opts.mirrorNotes ?? config.obsidian.mirrorNotes,
    updatedAt: opts.updatedAt ?? new Date().toISOString(),
    architecture: getArchitectureSummary(projectId),
    layers,
    tour,
    nodes,
    fanIn,
    knowledge: listKnowledgeNodes(projectId),
    questions: listQuestions(projectId),
    notes: listCodeNotes(projectId),
    bridges,
    paths: listLearningPaths(projectId).map((row) => ({
      goal: row.goal,
      steps: row.steps,
      source: row.source,
      createdAt: row.created_at,
    })),
    progress: listLearnProgress(projectId),
    graphStats: graph ? { nodeCount: graph.nodes.length, edgeCount: graph.edges.length } : null,
    reportMarkdown,
  }
}

function flattenTour(graph: KnowledgeGraph | null): Array<{ order?: number; title?: string; description?: string; nodeIds?: string[] }> {
  const tour = graph?.tour
  if (!Array.isArray(tour) || tour.length === 0) return []
  const first = tour[0] as { steps?: unknown }
  if (first && typeof first === 'object' && Array.isArray(first.steps)) {
    return (tour as Array<{ steps: Array<{ order?: number; title?: string; description?: string; nodeIds?: string[] }> }>)
      .flatMap((entry) => entry.steps ?? [])
  }
  return tour as Array<{ order?: number; title?: string; description?: string; nodeIds?: string[] }>
}

/** Nodes everything depends on — the "read this first" list. */
function buildFanIn(graph: KnowledgeGraph | null, nodeById: Map<string, GraphNodeView>): FanInView[] {
  if (!graph) return []
  const counts = new Map<string, number>()
  for (const edge of graph.edges ?? []) {
    if (edge.type === 'contains') continue
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([id, count]) => count >= 3 && nodeById.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, count]) => {
      const node = nodeById.get(id)!
      return { nodeId: id, label: node.label, filePath: node.filePath, count }
    })
}
