/**
 * Evaluation metrics for the learning coach (C1).
 *
 * Pure functions so the numbers in the thesis are reproducible and testable,
 * independent of any LLM or running app. Two families:
 *
 *  - retrieval: did the pipeline surface the right nodes/files? (Recall@k, MRR,
 *    precision@k) — measurable **without** an API key, since retrieval is local.
 *  - answer: once an LLM answered, are its citations real and complete?
 *    (citation precision/recall, faithfulness, hallucination rate)
 *
 * "Gradeable unit" is a node **or** a file path: a question can be answered by
 * pointing at the right node, and file-level recall matters for a reader who is
 * about to open a file. Both are tracked separately.
 */

export interface ExpectedTargets {
  /** Graph node ids that would answer the question. */
  nodes?: string[]
  /** File paths (project-relative) that contain the answer. */
  files?: string[]
}

export interface RetrievalScore {
  /** Fraction of expected items found in the first k results. */
  recallAtK: number
  precisionAtK: number
  /** 1/rank of the first expected item, 0 when none was found. */
  reciprocalRank: number
  hits: number
  expected: number
  /** Whether the first expected item appeared at all within k. */
  hit: boolean
}

/** Node id → file path, used to grade node results at file granularity. */
export type NodeFileIndex = Map<string, string>

export function toFiles(ids: string[], index: NodeFileIndex): string[] {
  const out = new Set<string>()
  for (const id of ids) {
    const file = index.get(id)
    if (file) out.add(file)
  }
  return [...out]
}

/**
 * Score one retrieved ranking against the expectations.
 *
 * `expected` may mix node ids and file paths; an item counts as a hit when the
 * retrieved node either *is* the expected node or *lives in* the expected file.
 */
export function scoreRetrieval(
  retrievedNodeIds: string[],
  expected: ExpectedTargets,
  nodeFileIndex: NodeFileIndex,
  k: number,
): RetrievalScore {
  const expectedNodes = new Set(expected.nodes ?? [])
  const expectedFiles = new Set(expected.files ?? [])
  const expectedCount = expectedNodes.size + expectedFiles.size

  const top = retrievedNodeIds.slice(0, k)

  let hits = 0
  let firstHitRank = 0
  const matchedNodes = new Set<string>()
  const matchedFiles = new Set<string>()

  top.forEach((id, index) => {
    const file = nodeFileIndex.get(id)
    let matched = false
    if (expectedNodes.has(id) && !matchedNodes.has(id)) {
      matchedNodes.add(id)
      matched = true
    }
    if (file && expectedFiles.has(file) && !matchedFiles.has(file)) {
      matchedFiles.add(file)
      matched = true
    }
    if (matched) {
      hits += 1
      if (firstHitRank === 0) firstHitRank = index + 1
    }
  })

  // Distinct expectations satisfied (a hit can satisfy a node and a file at once).
  const satisfied = matchedNodes.size + matchedFiles.size
  const recallAtK = expectedCount > 0 ? satisfied / expectedCount : 1
  const precisionAtK = top.length > 0 ? hits / top.length : 0

  return {
    recallAtK,
    precisionAtK,
    reciprocalRank: firstHitRank > 0 ? 1 / firstHitRank : 0,
    hits: satisfied,
    expected: expectedCount,
    hit: satisfied > 0,
  }
}

export interface CitationMetrics {
  /** Cited node ids that exist in the graph. */
  validRefs: number
  /** Cited ids that do not exist — the hallucination signal. */
  hallucinatedRefs: number
  /** validRefs / totalRefs (1 when nothing was cited). */
  faithfulness: number
  citationPrecision: number
  citationRecall: number
  /** Fraction of cited *real* nodes that were expected. */
  relevantRefs: number
}

/**
 * Score an answer's citations.
 *
 * `allNodeIds` is the ground truth for existence: anything cited that is not in
 * the graph is counted as a hallucinated reference. Precision/recall are computed
 * only against real citations, so one made-up id cannot inflate them.
 */
export function scoreCitations(
  citedNodeIds: string[],
  expected: ExpectedTargets,
  allNodeIds: Set<string>,
  nodeFileIndex: NodeFileIndex,
): CitationMetrics {
  const unique = [...new Set(citedNodeIds)]
  const valid = unique.filter((id) => allNodeIds.has(id))
  const hallucinated = unique.filter((id) => !allNodeIds.has(id))

  const expectedNodes = new Set(expected.nodes ?? [])
  const expectedFiles = new Set(expected.files ?? [])
  const expectedCount = expectedNodes.size + expectedFiles.size

  const relevant = valid.filter((id) => {
    if (expectedNodes.has(id)) return true
    const file = nodeFileIndex.get(id)
    return Boolean(file && expectedFiles.has(file))
  })

  return {
    validRefs: valid.length,
    hallucinatedRefs: hallucinated.length,
    faithfulness: unique.length > 0 ? valid.length / unique.length : 1,
    citationPrecision: valid.length > 0 ? relevant.length / valid.length : 0,
    citationRecall: expectedCount > 0 ? Math.min(1, relevant.length / expectedCount) : 1,
    relevantRefs: relevant.length,
  }
}

export interface PathScore {
  found: boolean
  hopsMatch: boolean
  hops: number
}

/** Score a shortest-path answer against the annotated hop count. */
export function scorePath(found: boolean, hops: number, expectedHops?: number): PathScore {
  return {
    found,
    hops,
    hopsMatch: found && (expectedHops === undefined || hops === expectedHops),
  }
}

/* ──────────── Aggregation ──────────── */

export interface ItemResult {
  id: string
  /** Metric group the item belongs to. */
  kind: 'locate' | 'explain' | 'path'
  recallAtK?: number
  precisionAtK?: number
  reciprocalRank?: number
  faithful?: number
  citationPrecision?: number
  citationRecall?: number
  pathFound?: boolean
  pathHopsMatch?: boolean
  error?: string
}

export interface AggregateRow {
  label: string
  items: number
  value: number
  /** Rendered for reports. */
  formatted: string
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function share(values: boolean[]): number {
  if (values.length === 0) return 0
  return values.filter(Boolean).length / values.length
}

/**
 * Aggregate per-item results into report rows.
 *
 * `k` only affects the labels of the @k metrics (the values are already computed
 * by scoreRetrieval at that k). Each metric is averaged over the items that
 * produced it, so a dataset without path questions does not drag path accuracy
 * to zero.
 */
export function aggregate(results: ItemResult[], k = 5): AggregateRow[] {
  const rows: AggregateRow[] = []
  const push = (label: string, values: number[]) => {
    if (values.length === 0) return
    const value = mean(values)
    rows.push({ label, items: values.length, value, formatted: `${(value * 100).toFixed(1)}%` })
  }

  push(`Recall@${k}`, results.map((r) => r.recallAtK).filter((v): v is number => v !== undefined))
  push(`Precision@${k}`, results.map((r) => r.precisionAtK).filter((v): v is number => v !== undefined))
  push('MRR', results.map((r) => r.reciprocalRank).filter((v): v is number => v !== undefined))
  push('引用忠实度', results.map((r) => r.faithful).filter((v): v is number => v !== undefined))
  push('引用精确率', results.map((r) => r.citationPrecision).filter((v): v is number => v !== undefined))
  push('引用召回率', results.map((r) => r.citationRecall).filter((v): v is number => v !== undefined))

  const pathResults = results.filter((r) => r.pathFound !== undefined)
  if (pathResults.length > 0) {
    rows.push({
      label: '路径可达率',
      items: pathResults.length,
      value: share(pathResults.map((r) => Boolean(r.pathFound))),
      formatted: `${(share(pathResults.map((r) => Boolean(r.pathFound))) * 100).toFixed(1)}%`,
    })
    const hopMatches = pathResults.filter((r) => r.pathHopsMatch !== undefined)
    if (hopMatches.length > 0) {
      const value = share(hopMatches.map((r) => Boolean(r.pathHopsMatch)))
      rows.push({ label: '路径跳数准确率', items: hopMatches.length, value, formatted: `${(value * 100).toFixed(1)}%` })
    }
  }

  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    rows.push({ label: '执行失败项', items: errors.length, value: errors.length, formatted: String(errors.length) })
  }

  return rows
}

/** Markdown table for a run, ready to paste into the thesis. */
export function formatResultsTable(title: string, results: ItemResult[]): string {
  const rows = aggregate(results)
  const lines = [
    `### ${title}`,
    '',
    '| 指标 | 样本数 | 数值 |',
    '|------|--------|------|',
    ...rows.map((r) => `| ${r.label} | ${r.items} | ${r.formatted} |`),
    '',
  ]
  return lines.join('\n')
}

/** Markdown table comparing variants (C2 ablations). */
export function formatComparisonTable(
  variants: Array<{ name: string; rows: AggregateRow[] }>,
): string {
  if (variants.length === 0) return ''
  const labels = [...new Set(variants.flatMap((v) => v.rows.map((r) => r.label)))]

  const divider = `|------|${variants.map(() => '------').join('|')}|`
  const body = labels.map((label) => {
    const cells = variants.map((v) => {
      const row = v.rows.find((r) => r.label === label)
      return row ? row.formatted : '—'
    })
    return `| ${label} | ${cells.join(' | ')} |`
  })

  return [`| 指标 | ${variants.map((v) => v.name).join(' | ')} |`, divider, ...body, ''].join('\n')
}
