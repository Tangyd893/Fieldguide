/**
 * SUS + task-metric scoring for the user study (C3).
 *
 * The thesis numbers must be recomputable from raw responses, so the instrument
 * maths is pinned here: alternating item polarity, the ×2.5 scaling, exclusion of
 * incomplete questionnaires, and right-skewed time reporting (mean + median).
 */
import { describe, it, expect } from 'vitest'
import {
  SUS_ITEMS,
  USABILITY_ITEMS,
  LEARNABILITY_ITEMS,
  scoreSus,
  ratingOf,
  summarizeStudy,
  formatStudySummary,
  summarizeTasks,
  formatTaskTable,
  type TaskRecord,
} from '../usability'

/** All-positive or all-negative responses, for boundary checks. */
function allResponses(value: number): Record<number, number> {
  const out: Record<number, number> = {}
  for (const item of SUS_ITEMS) out[item.id] = value
  return out
}

describe('SUS instrument', () => {
  it('has the standard 10 items with alternating polarity', () => {
    expect(SUS_ITEMS).toHaveLength(10)
    expect(SUS_ITEMS.filter((i) => i.positive)).toHaveLength(5)
    expect(SUS_ITEMS.filter((i) => !i.positive)).toHaveLength(5)
    // odd items positive, even items negative
    for (const item of SUS_ITEMS) {
      expect(item.positive).toBe(item.id % 2 === 1)
    }
  })

  it('splits items across the two sub-scales (item 8 is in neither, per Brooke)', () => {
    const covered = [...USABILITY_ITEMS, ...LEARNABILITY_ITEMS].sort((a, b) => a - b)
    expect(covered).toEqual([1, 2, 3, 4, 5, 6, 7, 9, 10])
    expect(covered).not.toContain(8)
  })
})

describe('scoreSus', () => {
  it('scores all-agree-on-positive as 100', () => {
    // 1,3,5,7,9 = 5 → 4 each; 2,4,6,8,10 = 1 → 4 each
    const responses: Record<number, number> = {}
    for (const item of SUS_ITEMS) responses[item.id] = item.positive ? 5 : 1
    const scored = scoreSus(responses)
    expect(scored.score).toBe(100)
    expect(scored.rating).toBe('best')
    expect(scored.complete).toBe(true)
  })

  it('scores the worst case as 0', () => {
    const responses: Record<number, number> = {}
    for (const item of SUS_ITEMS) responses[item.id] = item.positive ? 1 : 5
    expect(scoreSus(responses).score).toBe(0)
  })

  it('scores all-neutral responses as 50', () => {
    expect(scoreSus(allResponses(3)).score).toBe(50)
  })

  it('applies the ×2.5 scaling to a mixed questionnaire', () => {
    // Contrived but hand-checkable: agree with everything positive, disagree with
    // the negatives → maximum. A single middling negative drops it.
    const responses: Record<number, number> = {}
    for (const item of SUS_ITEMS) responses[item.id] = item.positive ? 5 : 1
    responses[2] = 3 // negative item scored neutral → contributes 2 instead of 4
    // sum = 9 items × 4 + 2 = 38 → 38 × 2.5 = 95
    expect(scoreSus(responses).score).toBe(95)
  })

  it('clamps out-of-range and rounds fractional responses', () => {
    const responses: Record<number, number> = {}
    for (const item of SUS_ITEMS) responses[item.id] = 3
    responses[1] = 9 // out of range → clamped to 5
    responses[2] = 0.4 // → rounded to 1 (a negative item at 1 scores 4)
    const scored = scoreSus(responses)
    expect(scored.score).toBeGreaterThan(50)
    expect(scored.score).toBeLessThanOrEqual(100)
  })

  it('reports incomplete questionnaires instead of silently averaging them', () => {
    const scored = scoreSus({ 1: 5, 2: 1, 3: 5 })
    expect(scored.complete).toBe(false)
    // only the three present items are used
    expect(scored.score).toBe(100)
  })

  it('computes the usability and learnability sub-scales separately', () => {
    const responses: Record<number, number> = {}
    for (const item of SUS_ITEMS) responses[item.id] = item.positive ? 5 : 1
    const scored = scoreSus(responses)
    expect(scored.usability).toBe(100)
    expect(scored.learnability).toBe(100)
  })
})

describe('ratingOf', () => {
  it('maps scores to Bangor adjective buckets', () => {
    expect(ratingOf(90)).toBe('best')
    expect(ratingOf(80)).toBe('excellent')
    expect(ratingOf(70)).toBe('good')
    expect(ratingOf(60)).toBe('ok')
    expect(ratingOf(30)).toBe('poor')
    expect(ratingOf(10)).toBe('worst')
  })
})

describe('summarizeStudy', () => {
  const perfect = (): Record<number, number> => {
    const out: Record<number, number> = {}
    for (const item of SUS_ITEMS) out[item.id] = item.positive ? 5 : 1
    return out
  }

  it('averages valid questionnaires and excludes incomplete ones', () => {
    const summary = summarizeStudy([perfect(), allResponses(3), { 1: 5 }])
    expect(summary.participants).toBe(2)
    expect(summary.excluded).toBe(1)
    expect(summary.meanScore).toBe(75) // (100 + 50) / 2
  })

  it('reports spread and a confidence interval', () => {
    // 100 (perfect), 50 (all-neutral), 75 (agree with positives, neutral on negatives)
    const seventyFive: Record<number, number> = {}
    for (const item of SUS_ITEMS) seventyFive[item.id] = item.positive ? 5 : 3

    const summary = summarizeStudy([perfect(), allResponses(3), seventyFive])
    expect(scoreSus(seventyFive).score).toBe(75)
    expect(summary.participants).toBe(3)
    expect(summary.medianScore).toBe(75)
    expect(summary.stdDev).toBeGreaterThan(0)
    expect(summary.ci95).toBeGreaterThan(0)
    expect(summary.max).toBeGreaterThan(summary.min)
  })

  it('scores uniform responses at 50 regardless of the value', () => {
    // The instrument is built so that agreeing with everything nets out neutral.
    for (const value of [1, 2, 3, 4, 5]) {
      expect(scoreSus(allResponses(value)).score, `all ${value}s`).toBe(50)
    }
  })

  it('handles a study with no valid responses', () => {
    const summary = summarizeStudy([{}, { 1: 3 }])
    expect(summary).toMatchObject({ participants: 0, excluded: 2, meanScore: 0, ci95: 0 })
  })

  it('renders a markdown summary', () => {
    const md = formatStudySummary(summarizeStudy([perfect(), allSteps()]))
    expect(md).toContain('| SUS 均值 |')
    expect(md).toContain('| 有效参与者 | 2 |')
  })

  function allSteps(): Record<number, number> {
    const out: Record<number, number> = {}
    for (const item of SUS_ITEMS) out[item.id] = 3
    return out
  }
})

describe('summarizeTasks', () => {
  const records: TaskRecord[] = [
    { participantId: 'p1', taskId: 't1', seconds: 120, completed: true, correct: true, understanding: 4 },
    { participantId: 'p2', taskId: 't1', seconds: 200, completed: true, correct: false, understanding: 3 },
    { participantId: 'p2', taskId: 't1', seconds: 400, completed: false, correct: false, understanding: 2 },
    { participantId: 'p1', taskId: 't2', seconds: 90, completed: true, correct: true, understanding: 5 },
  ]

  it('summarises completion, accuracy, time and self-rated understanding per task', () => {
    const summaries = summarizeTasks(records)
    expect(summaries.map((s) => s.taskId)).toEqual(['t1', 't2'])

    const t1 = summaries[0]
    expect(t1.attempts).toBe(3)
    expect(t1.completionRate).toBeCloseTo(2 / 3)
    expect(t1.accuracyRate).toBeCloseTo(1 / 3)
    expect(t1.meanSeconds).toBeCloseTo(240)
    expect(t1.medianSeconds).toBe(200) // mean 240 vs median 200: the mean hides the outlier
    expect(t1.meanUnderstanding).toBeCloseTo(3)
  })

  it('reports the median for an even number of samples', () => {
    const summaries = summarizeTasks([
      { participantId: 'p1', taskId: 't', seconds: 10, completed: true, correct: true },
      { participantId: 'p2', taskId: 't', seconds: 30, completed: true, correct: true },
    ])
    expect(summaries[0].medianSeconds).toBe(20)
  })

  it('returns nothing for an empty record set', () => {
    expect(summarizeTasks([])).toEqual([])
  })

  it('renders a markdown task table', () => {
    const md = formatTaskTable(summarizeTasks(records))
    expect(md).toContain('| 任务 | 样本 | 完成率 | 正确率 |')
    expect(md).toContain('| t1 | 3 | 67% | 33% |')
  })
})
