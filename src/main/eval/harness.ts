/**
 * Evaluation harness for the learning coach (C1 + C2).
 *
 * Design goal: produce *real, reproducible* numbers without an API key. Retrieval
 * and graph navigation are entirely local, so the recall/MRR/path metrics can be
 * measured in CI; only the answer-level citation metrics need an LLM, and those
 * consume the same dataset when one is configured.
 *
 * Ablation (C2) is expressed as retrieval **variants** over the same dataset, so
 * the comparison table comes out of the same code path:
 *
 *   none              — no retrieval at all (baseline: what the model would see
 *                       from the packed context alone)
 *   substring         — deterministic substring matcher (offline fallback)
 *   semantic          — UA SearchEngine when available, else substring
 *   semantic+neighbours — semantic plus 1-hop neighbour expansion, which is what
 *                       the coach context packer actually does
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { toSearchableNodes, searchNodesDetailed } from '../ua/search'
import { loadGraph, getNeighbors, findPath, type KnowledgeGraph } from '../ua/graph-reader'
import {
  scoreRetrieval,
  scoreCitations,
  scorePath,
  aggregate,
  formatResultsTable,
  formatComparisonTable,
  toFiles,
  type ExpectedTargets,
  type ItemResult,
  type NodeFileIndex,
} from './metrics'

export type RetrievalMode = 'none' | 'substring' | 'semantic' | 'semantic+neighbours'

export type QueryField = 'question' | 'questionEn' | 'keywords'

export interface EvalItem {
  id: string
  kind: 'locate' | 'explain' | 'path'
  question: string
  questionEn?: string
  keywords?: string
  expect: ExpectedTargets
  path?: { from: string; to: string; expectedHops?: number }
}

export interface EvalDataset {
  name: string
  projectPath: string
  description?: string
  annotationNotes?: string
  /** Query surfaces the dataset supports (natural language per locale, keywords). */
  queryFields?: Array<{ field: QueryField; label: string }>
  items: EvalItem[]
}

export interface VariantRun {
  mode: RetrievalMode
  queryField: QueryField
  queryLabel: string
  k: number
  results: ItemResult[]
  /** Per-item retrieval detail, for inspecting failures. */
  detail: Array<{ id: string; query: string; retrieved: string[]; expected: ExpectedTargets }>
}

export interface HarnessOptions {
  /** Results considered for recall/precision (default 5). */
  k?: number
  /** Evaluate at several cut-offs (overrides `k`); useful to show neighbour expansion. */
  ks?: number[]
  /** Retrieval variants to run (defaults to all four). */
  modes?: RetrievalMode[]
  /** Query surfaces to run (defaults to the dataset's own list, else natural language). */
  queryFields?: QueryField[]
}

/** The query text for one surface of an item, falling back when a field is absent. */
export function queryFor(item: EvalItem, field: QueryField): string {
  if (field === 'questionEn') return item.questionEn ?? item.question
  if (field === 'keywords') return item.keywords ?? item.question
  return item.question
}

/** Load and validate a dataset file. */
export function loadDataset(path: string): EvalDataset {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as EvalDataset
  if (!raw?.items?.length) throw new Error(`dataset ${path} has no items`)
  for (const item of raw.items) {
    if (!item.id || !item.question || !item.expect) {
      throw new Error(`dataset item is missing id/question/expect: ${JSON.stringify(item).slice(0, 80)}`)
    }
  }
  return raw
}

/** Resolve the dataset's project path relative to the repo root. */
export function resolveProjectPath(dataset: EvalDataset, repoRoot: string): string {
  const candidate = resolve(repoRoot, dataset.projectPath)
  return candidate
}

/** nodeId → filePath, the index all file-level grading uses. */
export function buildNodeFileIndex(graph: KnowledgeGraph): NodeFileIndex {
  const index: NodeFileIndex = new Map()
  for (const node of graph.nodes) {
    if (node.filePath) index.set(node.id, node.filePath)
  }
  return index
}

/**
 * Retrieve candidate node ids for a question under one variant.
 *
 * Returns *ids only* so the same ranking can be graded at node and file level.
 */
export async function retrieve(
  graph: KnowledgeGraph,
  question: string,
  mode: RetrievalMode,
  k: number,
): Promise<string[]> {
  if (mode === 'none') return []

  const searchable = toSearchableNodes(graph.nodes)
  const limit = mode === 'semantic+neighbours' ? Math.max(k, 8) : k

  let hits: string[]
  if (mode === 'substring') {
    // Force the deterministic matcher by using its exported helper directly.
    const { substringSearch } = await import('../ua/search')
    hits = substringSearch(searchable, question, limit).map((h) => h.nodeId)
  } else {
    const detailed = await searchNodesDetailed(searchable, question, limit)
    hits = detailed.hits.map((h) => h.nodeId)
  }

  if (mode !== 'semantic+neighbours') return hits.slice(0, k)

  // Expand with 1-hop neighbours, then re-truncate: this mirrors the context
  // packer, which seeds on search hits and pulls in their neighbourhood.
  const expanded: string[] = []
  const seen = new Set<string>()
  const push = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    expanded.push(id)
  }
  for (const id of hits) {
    push(id)
    for (const neighbour of getNeighbors(graph, id, 1).nodes) push(neighbour.id)
  }
  // Keep the direct hits in front so MRR reflects the ranking, not the expansion.
  const direct = new Set(hits)
  const ordered = [...hits, ...expanded.filter((id) => !direct.has(id))]
  return ordered.slice(0, k)
}

/** Run one variant (retrieval mode × query surface) across the dataset. */
export async function runVariant(
  graph: KnowledgeGraph,
  dataset: EvalDataset,
  mode: RetrievalMode,
  queryField: QueryField,
  options: HarnessOptions = {},
  repoRoot = process.cwd(),
): Promise<VariantRun> {
  const k = options.k ?? 5
  const nodeFileIndex = buildNodeFileIndex(graph)
  const results: ItemResult[] = []
  const detail: VariantRun['detail'] = []
  const queryLabel = labelOfQuery(dataset, queryField)

  for (const item of dataset.items) {
    const query = queryFor(item, queryField)
    try {
      const retrieved = await retrieve(graph, query, mode, k)
      detail.push({ id: item.id, query, retrieved, expected: item.expect })

      const retrieval = scoreRetrieval(retrieved, item.expect, nodeFileIndex, k)
      const result: ItemResult = {
        id: item.id,
        kind: item.kind,
        recallAtK: retrieval.recallAtK,
        precisionAtK: retrieval.precisionAtK,
        reciprocalRank: retrieval.reciprocalRank,
      }

      if (item.kind === 'path' && item.path) {
        const path = findPath(graph, item.path.from, item.path.to, 12)
        const score = scorePath(path.found, path.hops, item.path.expectedHops)
        result.pathFound = score.found
        result.pathHopsMatch = score.hopsMatch
      }

      results.push(result)
    } catch (err) {
      results.push({ id: item.id, kind: item.kind, error: err instanceof Error ? err.message : String(err) })
    }
  }

  void repoRoot
  return { mode, queryField, queryLabel, k, results, detail }
}

export interface EvalReport {
  dataset: string
  graphNodes: number
  graphEdges: number
  k: number
  ks: number[]
  variants: Array<{
    mode: RetrievalMode
    queryField: QueryField
    k: number
    label: string
    rows: ReturnType<typeof aggregate>
    results: ItemResult[]
  }>
  markdown: string
}

/** Run every variant (mode × query surface) and render the thesis-ready report. */
export async function runEvaluation(
  dataset: EvalDataset,
  repoRoot: string,
  options: HarnessOptions = {},
): Promise<EvalReport> {
  const projectRoot = resolveProjectPath(dataset, repoRoot)
  const graph = loadGraph(projectRoot)
  if (!graph) throw new Error(`no knowledge graph at ${join(projectRoot, '.understand-anything')}`)

  const modes = options.modes ?? ['none', 'substring', 'semantic', 'semantic+neighbours']
  const queryFields = options.queryFields
    ?? dataset.queryFields?.map((q) => q.field)
    ?? ['question']
  const ks = options.ks ?? [options.k ?? 5]
  const showK = ks.length > 1

  const variants: EvalReport['variants'] = []
  for (const k of ks) {
    for (const queryField of queryFields) {
      for (const mode of modes) {
        const run = await runVariant(graph, dataset, mode, queryField, { k }, repoRoot)
        variants.push({
          mode,
          queryField,
          k,
          label: `${labelOf(mode)} / ${run.queryLabel}${showK ? ` @${k}` : ''}`,
          rows: aggregate(run.results, k),
          results: run.results,
        })
      }
    }
  }

  const nodeFileIndex = buildNodeFileIndex(graph)

  const lines: string[] = []
  lines.push(`## 数据集：${dataset.name}`, '')
  if (dataset.description) lines.push(`> ${dataset.description}`, '')
  lines.push(`- 题目数：**${dataset.items.length}**（locate ${count(dataset, 'locate')} · explain ${count(dataset, 'explain')} · path ${count(dataset, 'path')}）`)
  lines.push(`- 图谱规模：**${graph.nodes.length} 节点 / ${graph.edges.length} 边**`)
  lines.push(`- 评测口径：Recall@k / Precision@k（k = ${ks.join(', ')}）/ MRR，命中 = 检索结果的节点 id 命中标注节点，或该节点所在文件命中标注文件`)
  lines.push(`- 提问形式：${queryFields.map((f) => labelOfQuery(dataset, f)).join(' / ')}`)
  lines.push(`- 运行方式：**离线**（检索与图导航全本地，不需要 API Key），结果可复现`)
  lines.push('')

  if (nodeFileIndex.size < graph.nodes.length) {
    lines.push(`> 注：${graph.nodes.length - nodeFileIndex.size} 个节点没有 filePath，只参与节点级评分。`, '')
  }

  lines.push('### 变体对比（消融：检索方式 × 提问形式）', '')
  lines.push(formatComparisonTable(variants.map((v) => ({ name: v.label, rows: v.rows }))))
  lines.push('')

  // Group the per-variant tables by query surface so the report reads in order.
  for (const queryField of queryFields) {
    lines.push(`#### 提问形式：${labelOfQuery(dataset, queryField)}`, '')
    for (const variant of variants.filter((v) => v.queryField === queryField)) {
      lines.push(formatResultsTable(labelOf(variant.mode), variant.results))
    }
  }

  return {
    dataset: dataset.name,
    graphNodes: graph.nodes.length,
    graphEdges: graph.edges.length,
    k: ks[0],
    ks,
    variants,
    markdown: lines.join('\n'),
  }
}

function count(dataset: EvalDataset, kind: EvalItem['kind']): number {
  return dataset.items.filter((i) => i.kind === kind).length
}

export function labelOfQuery(dataset: EvalDataset, field: QueryField): string {
  return dataset.queryFields?.find((q) => q.field === field)?.label ?? field
}

export function labelOf(mode: RetrievalMode): string {
  switch (mode) {
    case 'none': return '无检索（基线）'
    case 'substring': return '子串匹配'
    case 'semantic': return '语义检索'
    case 'semantic+neighbours': return '语义 + 邻居扩展'
  }
}

/**
 * Score an agent answer's citations (LLM mode).
 *
 * Exposed separately because it needs a real answer: the harness feeds it the
 * `nodeRefs` the agent returned plus the dataset's expectations.
 */
export function scoreAnswer(
  item: EvalItem,
  citedNodeIds: string[],
  graph: KnowledgeGraph,
): ItemResult {
  const index = buildNodeFileIndex(graph)
  const all = new Set(graph.nodes.map((n) => n.id))
  const metrics = scoreCitations(citedNodeIds, item.expect, all, index)
  return {
    id: item.id,
    kind: item.kind,
    faithful: metrics.faithfulness,
    citationPrecision: metrics.citationPrecision,
    citationRecall: metrics.citationRecall,
  }
}

export { toFiles, dirname }
