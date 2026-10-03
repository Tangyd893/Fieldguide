/**
 * Evaluation metrics (C1).
 *
 * These numbers go in the thesis, so the definitions are pinned here: a hit at
 * file granularity counts, precision/recall for citations ignore hallucinated ids,
 * and each metric averages only over the items that produced it.
 */
import { describe, it, expect } from 'vitest'
import {
  scoreRetrieval,
  scoreCitations,
  scorePath,
  aggregate,
  formatResultsTable,
  formatComparisonTable,
  toFiles,
  type NodeFileIndex,
  type ItemResult,
} from '../metrics'

const INDEX: NodeFileIndex = new Map([
  ['function:a.go:Handle', 'a.go'],
  ['function:a.go:Other', 'a.go'],
  ['function:b.go:Serve', 'b.go'],
  ['file:c.go', 'c.go'],
])

describe('scoreRetrieval', () => {
  it('counts a node hit and a file hit for the same expectation set', () => {
    const score = scoreRetrieval(
      ['function:a.go:Handle'],
      { nodes: ['function:a.go:Handle'], files: ['a.go'] },
      INDEX,
      5,
    )
    // one node expectation + one file expectation, both satisfied by one result
    expect(score.recallAtK).toBe(1)
    expect(score.hits).toBe(2)
    expect(score.expected).toBe(2)
    expect(score.reciprocalRank).toBe(1)
  })

  it('rewards a file-level hit even when the exact node was not retrieved', () => {
    const score = scoreRetrieval(
      ['function:a.go:Other'],
      { nodes: ['function:a.go:Handle'], files: ['a.go'] },
      INDEX,
      5,
    )
    // node expectation missed, file expectation met
    expect(score.recallAtK).toBe(0.5)
    expect(score.hit).toBe(true)
  })

  it('computes MRR from the rank of the first hit', () => {
    const score = scoreRetrieval(
      ['file:c.go', 'function:b.go:Serve', 'function:a.go:Handle'],
      { nodes: ['function:a.go:Handle'] },
      INDEX,
      5,
    )
    expect(score.reciprocalRank).toBeCloseTo(1 / 3, 5)
  })

  it('stops counting hits beyond k', () => {
    const ranked = ['file:c.go', 'file:c.go', 'file:c.go', 'function:a.go:Handle']
    const score = scoreRetrieval(ranked, { nodes: ['function:a.go:Handle'] }, INDEX, 3)
    expect(score.hit).toBe(false)
    expect(score.recallAtK).toBe(0)
    expect(score.precisionAtK).toBe(0)
  })

  it('counts a repeated id once and penalises it in precision', () => {
    const score = scoreRetrieval(
      ['function:a.go:Handle', 'function:a.go:Handle'],
      { nodes: ['function:a.go:Handle'] },
      INDEX,
      5,
    )
    // The expectation is satisfied once; the duplicate only costs precision.
    expect(score.hits).toBe(1)
    expect(score.recallAtK).toBe(1)
    expect(score.precisionAtK).toBe(0.5)
  })

  it('treats an item with no expectations as fully recalled', () => {
    const score = scoreRetrieval(['anything'], {}, INDEX, 5)
    expect(score.recallAtK).toBe(1)
    expect(score.expected).toBe(0)
  })

  it('handles an empty result list', () => {
    const score = scoreRetrieval([], { nodes: ['function:a.go:Handle'] }, INDEX, 5)
    expect(score).toMatchObject({ recallAtK: 0, precisionAtK: 0, reciprocalRank: 0, hit: false })
  })
})

describe('scoreCitations', () => {
  const ALL = new Set(['function:a.go:Handle', 'function:a.go:Other', 'function:b.go:Serve', 'file:c.go'])

  it('flags ids that do not exist in the graph as hallucinations', () => {
    const metrics = scoreCitations(
      ['function:a.go:Handle', 'function:ghost.go:Nope'],
      { nodes: ['function:a.go:Handle'] },
      ALL,
      INDEX,
    )
    expect(metrics.validRefs).toBe(1)
    expect(metrics.hallucinatedRefs).toBe(1)
    expect(metrics.faithfulness).toBeCloseTo(0.5)
    expect(metrics.citationPrecision).toBe(1)
  })

  it('counts satisfied expectations, so a node citation also satisfies its file', () => {
    const metrics = scoreCitations(
      ['function:a.go:Handle', 'function:b.go:Serve', 'file:c.go'],
      { nodes: ['function:a.go:Handle', 'function:b.go:Serve'], files: ['a.go'] },
      ALL,
      INDEX,
    )
    // 3 expectations (2 nodes + 1 file); Handle satisfies both its node and its
    // file, Serve satisfies its node, and c.go satisfies nothing → 3/3.
    // Recall deliberately uses the same satisfied-expectation rule as
    // scoreRetrieval, so retrieval and answer numbers stay comparable.
    expect(metrics.citationRecall).toBeCloseTo(1, 5)
    // Precision, by contrast, is per citation: c.go is real but irrelevant.
    expect(metrics.citationPrecision).toBeCloseTo(2 / 3, 5)
  })

  it('reports partial recall when only some expectations are cited', () => {
    const metrics = scoreCitations(
      ['function:a.go:Handle'],
      { nodes: ['function:a.go:Handle', 'function:b.go:Serve'], files: ['a.go'] },
      ALL,
      INDEX,
    )
    expect(metrics.citationRecall).toBeCloseTo(2 / 3, 5)
  })

  it('caps recall at 1 when several citations satisfy the same expectation', () => {
    const metrics = scoreCitations(
      ['function:a.go:Handle', 'function:a.go:Other'],
      { files: ['a.go'] },
      ALL,
      INDEX,
    )
    // one expectation, two relevant citations → still 1.0
    expect(metrics.citationRecall).toBe(1)
    expect(metrics.relevantRefs).toBe(2)
  })

  it('reports zero precision when every real citation is irrelevant', () => {
    const metrics = scoreCitations(
      ['file:c.go'],
      { nodes: ['function:a.go:Handle'] },
      ALL,
      INDEX,
    )
    expect(metrics.citationPrecision).toBe(0)
    expect(metrics.citationRecall).toBe(0)
    expect(metrics.faithfulness).toBe(1) // it is a real node, just not the answer
  })

  it('treats an answer with no citations as faithful but unhelpful', () => {
    const metrics = scoreCitations([], { nodes: ['function:a.go:Handle'] }, ALL, INDEX)
    expect(metrics.faithfulness).toBe(1)
    expect(metrics.citationRecall).toBe(0)
  })
})

describe('scorePath', () => {
  it('matches the annotated hop count', () => {
    expect(scorePath(true, 3, 3).hopsMatch).toBe(true)
    expect(scorePath(true, 4, 3).hopsMatch).toBe(false)
  })

  it('accepts any hop count when none was annotated', () => {
    expect(scorePath(true, 7).hopsMatch).toBe(true)
  })

  it('never matches when the path was not found', () => {
    expect(scorePath(false, 0, 0).hopsMatch).toBe(false)
  })
})

describe('toFiles', () => {
  it('maps node ids to unique file paths, skipping unknown ids', () => {
    expect(toFiles(['function:a.go:Handle', 'file:c.go', 'ghost'], INDEX).sort()).toEqual(['a.go', 'c.go'])
  })
})

describe('aggregate', () => {
  const results: ItemResult[] = [
    { id: 'q1', kind: 'locate', recallAtK: 1, reciprocalRank: 1 },
    { id: 'q2', kind: 'locate', recallAtK: 0.5, reciprocalRank: 0.5 },
    { id: 'q3', kind: 'path', pathFound: true, pathHopsMatch: true },
    { id: 'q4', kind: 'path', pathFound: false, pathHopsMatch: false },
    { id: 'q5', kind: 'locate', error: 'boom' },
  ]

  it('averages each metric over the items that produced it', () => {
    const rows = aggregate(results)
    const recall = rows.find((r) => r.label === 'Recall@5')!
    expect(recall.value).toBeCloseTo(0.75) // (1 + 0.5) / 2 — the error item has no recall
    expect(recall.items).toBe(2)
  })

  it('reports path rates only when path items exist', () => {
    const rows = aggregate(results)
    expect(rows.find((r) => r.label === '路径可达率')!.value).toBe(0.5)
    expect(rows.find((r) => r.label === '路径跳数准确率')!.value).toBe(0.5)
  })

  it('counts execution failures separately', () => {
    const rows = aggregate(results)
    expect(rows.find((r) => r.label === '执行失败项')!.formatted).toBe('1')
  })

  it('omits metrics with no data at all', () => {
    const rows = aggregate([{ id: 'only', kind: 'path', pathFound: true }])
    expect(rows.find((r) => r.label === 'Recall@5')).toBeUndefined()
    expect(rows.find((r) => r.label === '路径可达率')).toBeDefined()
  })
})

describe('report formatting', () => {
  it('renders a results table', () => {
    const md = formatResultsTable('变体 A', [{ id: 'q1', kind: 'locate', recallAtK: 1, reciprocalRank: 1 }])
    expect(md).toContain('### 变体 A')
    expect(md).toContain('| 指标 | 样本数 | 数值 |')
    expect(md).toContain('| Recall@5 | 1 | 100.0% |')
  })

  it('renders a comparison table across variants', () => {
    const md = formatComparisonTable([
      { name: '语义', rows: aggregate([{ id: 'q1', kind: 'locate', recallAtK: 1, reciprocalRank: 1 }]) },
      { name: '子串', rows: aggregate([{ id: 'q1', kind: 'locate', recallAtK: 0.5, reciprocalRank: 0.5 }]) },
    ])
    expect(md).toContain('| 指标 | 语义 | 子串 |')
    expect(md).toContain('| Recall@5 | 100.0% | 50.0% |')
  })

  it('returns an empty string when there is nothing to compare', () => {
    expect(formatComparisonTable([])).toBe('')
  })

  // Regression: the report for a k=10 run used to label its @k rows "Recall@5"
  // because formatResultsTable called aggregate() with the default k. A mislabeled
  // table is worse than a wrong number — it survives review.
  it('labels @k rows with the cut-off the run was scored at', () => {
    const md = formatResultsTable('变体 B', [{ id: 'q1', kind: 'locate', recallAtK: 0.5, reciprocalRank: 1 }], 10)
    expect(md).toContain('| Recall@10 | 1 | 50.0% |')
    expect(md).not.toContain('Recall@5')
  })

  it('reports the citation hallucination rate when answers cited unknown ids', () => {
    const rows = aggregate([
      { id: 'q1', kind: 'locate', faithful: 0.5, hallucinationRate: 0.5 },
      { id: 'q2', kind: 'locate', faithful: 1, hallucinationRate: 0 },
    ])
    expect(rows.find((r) => r.label === '引用幻觉率（越低越好）')!.formatted).toBe('25.0%')
  })
})
