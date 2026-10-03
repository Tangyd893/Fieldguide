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
 *   lexical           — BM25 over CJK-bigram/identifier tokens (src/main/ua/lexical.ts)
 *   lexical+terms     — lexical plus curated zh→en term expansion
 *   hybrid            — semantic ⊕ lexical+terms fused by reciprocal rank fusion
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { toSearchableNodes, semanticSearchOnly, hybridSearch } from '../ua/search'
import { buildLexicalIndex, lexicalSearch, type LexicalIndex } from '../ua/lexical'
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

export type RetrievalMode =
  | 'none'
  | 'substring'
  | 'semantic'
  | 'semantic+neighbours'
  | 'lexical'
  | 'lexical+terms'
  | 'hybrid'

export type QueryField = 'question' | 'questionEn' | 'keywords'

export interface EvalItem {
  id: string
  kind: 'locate' | 'explain' | 'path'
  question: string
  questionEn?: string
  keywords?: string
  expect: ExpectedTargets
  path?: { from: string; to: string; expectedHops?: number }
  /** Repo this item is graded against; defaults to the dataset's first repo. */
  repo?: string
}

/** One repository a dataset is scored against. */
export interface EvalRepo {
  name: string
  /** Repo-relative path resolved against the repo root. */
  projectPath: string
}

export interface EvalDataset {
  name: string
  /** Single-repo form (legacy); prefer `repos` for multi-repo datasets. */
  projectPath?: string
  /** Repos covered by this dataset; every `item.repo` must name one of them. */
  repos?: EvalRepo[]
  description?: string
  annotationNotes?: string
  /** Query surfaces the dataset supports (natural language per locale, keywords). */
  queryFields?: Array<{ field: QueryField; label: string }>
  items: EvalItem[]
}

/** The repos a dataset scores against, tolerating the legacy single-repo form. */
export function reposOf(dataset: EvalDataset): EvalRepo[] {
  if (dataset.repos?.length) return dataset.repos
  if (dataset.projectPath) return [{ name: dataset.name, projectPath: dataset.projectPath }]
  throw new Error(`dataset ${dataset.name} has neither repos nor projectPath`)
}

/** The repo an item is graded against (validated, so a typo fails loudly). */
export function repoForItem(dataset: EvalDataset, item: EvalItem): EvalRepo {
  const repos = reposOf(dataset)
  if (!item.repo) return repos[0]
  const found = repos.find((r) => r.name === item.repo)
  if (!found) throw new Error(`item ${item.id} references unknown repo "${item.repo}"`)
  return found
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
  const candidate = resolve(repoRoot, dataset.projectPath ?? reposOf(dataset)[0].projectPath)
  return candidate
}

/** Repos whose knowledge graph is missing on this machine (dataset is skipped). */
export function missingRepos(dataset: EvalDataset, repoRoot: string): string[] {
  return reposOf(dataset)
    .filter((repo) => !existsSync(join(resolve(repoRoot, repo.projectPath), '.understand-anything', 'knowledge-graph.json')))
    .map((repo) => repo.name)
}

/**
 * Load every repo a dataset needs, once each.
 *
 * Multi-repo datasets exist so one benchmark can compare a small hand-built
 * fixture (fast, deterministic) with a real repository (large graph, real
 * import structure) using the same code path.
 */
export function loadDatasetGraphs(dataset: EvalDataset, repoRoot: string): Map<string, KnowledgeGraph> {
  const graphs = new Map<string, KnowledgeGraph>()
  for (const repo of reposOf(dataset)) {
    const graph = loadGraph(resolve(repoRoot, repo.projectPath))
    if (graph) graphs.set(repo.name, graph)
  }
  return graphs
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
 *
 * `lexical` is the prebuilt BM25 index for this repo; building it per query would
 * dominate the runtime of a 3 × 7 × 2 grid.
 */
export async function retrieve(
  graph: KnowledgeGraph,
  question: string,
  mode: RetrievalMode,
  k: number,
  lexical?: LexicalIndex,
): Promise<string[]> {
  if (mode === 'none') return []

  const searchable = toSearchableNodes(graph.nodes)
  const limit = mode === 'semantic+neighbours' ? Math.max(k, 8) : k

  // ── lexical family: BM25 with CJK bigrams, optionally bilingual-expanded ──
  if (mode === 'lexical' || mode === 'lexical+terms') {
    const index = lexical ?? buildLexicalIndex(searchable)
    const hits = lexicalSearch(index, question, limit, { expand: mode === 'lexical+terms' })
    return hits.map((h) => h.nodeId).slice(0, k)
  }

  // ── hybrid: fuse two rankings that are not on a comparable score scale ──
  // Uses the same entry point as the product (`hybridSearch`), so this row is the
  // shipped behaviour; `semantic` uses the engine alone for a clean ablation.
  if (mode === 'hybrid') {
    const fused = await hybridSearch(searchable, question, limit)
    return fused.hits.map((h) => h.nodeId).slice(0, k)
  }

  let hits: string[]
  if (mode === 'substring') {
    // Force the deterministic matcher by using its exported helper directly.
    const { substringSearch } = await import('../ua/search')
    hits = substringSearch(searchable, question, limit).map((h) => h.nodeId)
  } else {
    // 'semantic' and 'semantic+neighbours' measure the engine on its own.
    const detailed = await semanticSearchOnly(searchable, question, limit)
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
  graphs: Map<string, KnowledgeGraph>,
  dataset: EvalDataset,
  mode: RetrievalMode,
  queryField: QueryField,
  options: HarnessOptions = {},
  repoRoot = process.cwd(),
): Promise<VariantRun> {
  const k = options.k ?? 5
  const results: ItemResult[] = []
  const detail: VariantRun['detail'] = []
  const queryLabel = labelOfQuery(dataset, queryField)
  const indexes = new Map<string, NodeFileIndex>()
  const lexicals = new Map<string, LexicalIndex>()

  for (const item of dataset.items) {
    const repo = repoForItem(dataset, item)
    const graph = graphs.get(repo.name)
    const query = queryFor(item, queryField)
    if (!graph) {
      results.push({ id: item.id, kind: item.kind, error: `repo "${repo.name}" has no knowledge graph` })
      continue
    }
    let index = indexes.get(repo.name)
    if (!index) {
      index = buildNodeFileIndex(graph)
      indexes.set(repo.name, index)
    }
    // The lexical index is per repository and reused across every item/variant.
    let lexical = lexicals.get(repo.name)
    if (!lexical) {
      lexical = buildLexicalIndex(toSearchableNodes(graph.nodes))
      lexicals.set(repo.name, lexical)
    }

    try {
      const retrieved = await retrieve(graph, query, mode, k, lexical)
      detail.push({ id: item.id, query, retrieved, expected: item.expect })

      const retrieval = scoreRetrieval(retrieved, item.expect, index, k)
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
  /** Per-repo coverage, so a multi-repo benchmark is auditable at a glance. */
  repos: Array<{ name: string; projectPath: string; nodes: number; edges: number; items: number }>
  k: number
  ks: number[]
  variants: Array<{
    mode: RetrievalMode
    queryField: QueryField
    /** Localized label of the query surface (report + assertions use it). */
    queryLabel: string
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
  const graphs = loadDatasetGraphs(dataset, repoRoot)
  const missing = reposOf(dataset).filter((repo) => !graphs.has(repo.name)).map((repo) => repo.name)
  if (missing.length > 0) {
    throw new Error(`no knowledge graph for repo(s): ${missing.join(', ')}`)
  }

  const modes = options.modes
    ?? (['none', 'substring', 'semantic', 'semantic+neighbours', 'lexical', 'lexical+terms', 'hybrid'] as RetrievalMode[])
  const queryFields = options.queryFields
    ?? dataset.queryFields?.map((q) => q.field)
    ?? ['question']
  const ks = options.ks ?? [options.k ?? 5]
  const showK = ks.length > 1

  const variants: EvalReport['variants'] = []
  for (const k of ks) {
    for (const queryField of queryFields) {
      for (const mode of modes) {
        const run = await runVariant(graphs, dataset, mode, queryField, { k }, repoRoot)
        variants.push({
          mode,
          queryField,
          queryLabel: run.queryLabel,
          k,
          label: `${labelOf(mode)} / ${run.queryLabel}${showK ? ` @${k}` : ''}`,
          rows: aggregate(run.results, k),
          results: run.results,
        })
      }
    }
  }

  const repoRows = reposOf(dataset).map((repo) => {
    const graph = graphs.get(repo.name)!
    return {
      name: repo.name,
      projectPath: repo.projectPath,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      items: dataset.items.filter((item) => repoForItem(dataset, item).name === repo.name).length,
    }
  })
  const graphNodes = repoRows.reduce((sum, row) => sum + row.nodes, 0)
  const graphEdges = repoRows.reduce((sum, row) => sum + row.edges, 0)

  const nodesWithoutPath = repoRows.reduce((sum, row) => {
    const graph = graphs.get(row.name)!
    return sum + (graph.nodes.length - buildNodeFileIndex(graph).size)
  }, 0)

  const lines: string[] = []
  lines.push(`## 数据集：${dataset.name}`, '')
  if (dataset.description) lines.push(`> ${dataset.description}`, '')
  lines.push(`- 题目数：**${dataset.items.length}**（locate ${count(dataset, 'locate')} · explain ${count(dataset, 'explain')} · path ${count(dataset, 'path')}）`)
  lines.push(`- 覆盖仓库：**${repoRows.length}** 个 —— ${repoRows.map((r) => `${r.name}（${r.nodes} 节点 / ${r.edges} 边 / ${r.items} 题）`).join('、')}`)
  lines.push(`- 图谱规模合计：**${graphNodes} 节点 / ${graphEdges} 边**`)
  lines.push(`- 评测口径：Recall@k / Precision@k（k = ${ks.join(', ')}）/ MRR，命中 = 检索结果的节点 id 命中标注节点，或该节点所在文件命中标注文件`)
  lines.push(`- 提问形式：${queryFields.map((f) => labelOfQuery(dataset, f)).join(' / ')}`)
  lines.push(`- 运行方式：**离线**（检索与图导航全本地，不需要 API Key），结果可复现`)

  if (dataset.annotationNotes) lines.push(`- 标注口径：${dataset.annotationNotes}`)
  lines.push('')

  if (nodesWithoutPath > 0) {
    lines.push(`> 注：${nodesWithoutPath} 个节点没有 filePath，只参与节点级评分。`, '')
  }

  lines.push('### 变体对比（消融：检索方式 × 提问形式）', '')
  lines.push(formatComparisonTable(variants.map((v) => ({ name: v.label, rows: v.rows }))))
  lines.push('')

  // Group the per-variant tables by query surface so the report reads in order.
  for (const queryField of queryFields) {
    lines.push(`#### 提问形式：${labelOfQuery(dataset, queryField)}`, '')
    for (const variant of variants.filter((v) => v.queryField === queryField)) {
      lines.push(formatResultsTable(labelOf(variant.mode), variant.results, variant.k))
    }
  }

  return {
    dataset: dataset.name,
    graphNodes,
    graphEdges,
    repos: repoRows,
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
    case 'lexical': return '词法 BM25（CJK 分词）'
    case 'lexical+terms': return '词法 BM25 + 术语映射'
    case 'hybrid': return '混合（语义 ⊕ 词法 RRF）'
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
  const cited = metrics.validRefs + metrics.hallucinatedRefs
  return {
    id: item.id,
    kind: item.kind,
    faithful: metrics.faithfulness,
    citationPrecision: metrics.citationPrecision,
    citationRecall: metrics.citationRecall,
    hallucinationRate: cited > 0 ? metrics.hallucinatedRefs / cited : 0,
  }
}

/* ──────────── Answer-level evaluation (recorded runs) ──────────── */

/**
 * One recorded answer.
 *
 * The recorded artifact exists so answer-level metrics stay **reproducible
 * without an API key**: `pnpm eval:record-answers` runs the real coach once and
 * stores what it cited, then `pnpm eval:answers` re-scores that file offline in
 * CI. Nothing in the recording depends on the machine that produced it.
 */
export interface AnswerRecord {
  id: string
  /** Node ids the agent returned as citations (runtime `nodeRefs`). */
  citedNodeIds: string[]
  /** First 200 chars of the answer, for human spot checks only — never scored. */
  answerExcerpt?: string
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
}

export interface AnswerRecording {
  dataset: string
  model: string
  recordedAt: string
  /**
   * What `citedNodeIds` actually means for this run. The runtime `nodeRefs` are
   * the nodes the agent *retrieved or observed*, not necessarily those it named
   * in prose; recording that distinction is the difference between a defensible
   * number and an overstated one.
   */
  citationSemantics?: string
  answers: AnswerRecord[]
}

export function loadRecording(path: string): AnswerRecording {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as AnswerRecording
  if (!raw?.answers?.length) throw new Error(`recording ${path} has no answers`)
  if (!raw.dataset || !raw.model) throw new Error(`recording ${path} is missing dataset/model`)
  return raw
}

export interface AnswerReport {
  dataset: string
  model: string
  /** Items that had a recording and were scored. */
  scored: number
  /** Items in the dataset with no recorded answer. */
  missing: string[]
  /** Recorded ids that are not in the dataset (stale recording). */
  unknown: string[]
  hallucinatedRefs: number
  citedRefs: number
  tokens: { prompt: number; completion: number; total: number }
  results: ItemResult[]
  markdown: string
}

/**
 * Score a recording against the dataset, offline.
 *
 * Items without a recording are reported as `missing` rather than scored as
 * zero: a partial recording is a coverage problem, not a quality result.
 */
export function scoreRecordedAnswers(
  dataset: EvalDataset,
  recording: AnswerRecording,
  repoRoot: string,
): AnswerReport {
  if (recording.dataset !== dataset.name) {
    throw new Error(`recording is for dataset "${recording.dataset}", not "${dataset.name}"`)
  }
  const graphs = loadDatasetGraphs(dataset, repoRoot)
  const byId = new Map(dataset.items.map((item) => [item.id, item]))
  const results: ItemResult[] = []
  const missing: string[] = []
  const unknown: string[] = []
  let hallucinatedRefs = 0
  let citedRefs = 0
  const tokens = { prompt: 0, completion: 0, total: 0 }

  for (const record of recording.answers) {
    const item = byId.get(record.id)
    if (!item) {
      unknown.push(record.id)
      continue
    }
    const graph = graphs.get(repoForItem(dataset, item).name)
    if (!graph) {
      results.push({ id: item.id, kind: item.kind, error: 'repo has no knowledge graph' })
      continue
    }
    const all = new Set(graph.nodes.map((n) => n.id))
    const unique = [...new Set(record.citedNodeIds)]
    hallucinatedRefs += unique.filter((id) => !all.has(id)).length
    citedRefs += unique.length
    tokens.prompt += record.usage?.promptTokens ?? 0
    tokens.completion += record.usage?.completionTokens ?? 0
    tokens.total += record.usage?.totalTokens ?? 0
    results.push(scoreAnswer(item, record.citedNodeIds, graph))
  }

  for (const item of dataset.items) {
    if (!recording.answers.some((a) => a.id === item.id)) missing.push(item.id)
  }

  const lines: string[] = [
    `## 答案级指标（引用可信性）· 数据集 ${dataset.name}`,
    '',
    `> 来源：录制的真实模型回答 \`eval/answers/${dataset.name}.${recording.model}.json\`（录于 ${recording.recordedAt}）。`,
    '> 评分离线进行，因此 CI 不需要 API Key；录制文件是唯一需要 Key 的产物。',
    '',
    `- 模型：**${recording.model}**`,
    `- 覆盖：**${results.length} / ${dataset.items.length}** 题${missing.length ? `（缺 ${missing.length} 题：${missing.slice(0, 8).join('、')}${missing.length > 8 ? '…' : ''}）` : ''}`,
    `- 引用总数：**${citedRefs}**，其中不存在于图谱的（幻觉）**${hallucinatedRefs}**`,
    `- token 计量：prompt ${tokens.prompt} / completion ${tokens.completion} / total ${tokens.total}`,
  ]
  if (recording.citationSemantics) lines.push(`- 引用口径：${recording.citationSemantics}`)
  if (unknown.length > 0) lines.push(`- 录制中存在数据集里没有的 id（录制已过期）：${unknown.join('、')}`)
  lines.push('', formatResultsTable('引用指标汇总', results), '')

  return {
    dataset: dataset.name,
    model: recording.model,
    scored: results.length,
    missing,
    unknown,
    hallucinatedRefs,
    citedRefs,
    tokens,
    results,
    markdown: lines.join('\n'),
  }
}

export { toFiles, dirname }
