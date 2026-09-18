/**
 * System Usability Scale scoring (C3).
 *
 * The user study needs an instrument that is standard, short and comparable to
 * published work, which is exactly what SUS is. Scoring is pure logic so the
 * thesis numbers can be recomputed and verified from raw responses.
 *
 * Method (Brooke, 1996):
 *   - 10 items, 5-point Likert (1 = strongly disagree … 5 = strongly agree)
 *   - odd items are positively worded, even items negatively worded
 *   - per item: (score − 1) for odd, (5 − score) for even
 *   - sum × 2.5 → 0–100
 *
 * Reported alongside: mean of the two sub-scales (usability 1/2/3/5/6/7/9,
 * learnability 4/10), and an adjective rating for the 0–100 result.
 */

export const SUS_ITEMS = [
  { id: 1, positive: true, zh: '我愿意经常使用这个系统。', en: 'I think that I would like to use this system frequently.' },
  { id: 2, positive: false, zh: '我觉得这个系统没有必要地复杂。', en: 'I found the system unnecessarily complex.' },
  { id: 3, positive: true, zh: '我觉得这个系统很容易使用。', en: 'I thought the system was easy to use.' },
  { id: 4, positive: false, zh: '我需要技术人员帮助才能使用这个系统。', en: 'I think that I would need the support of a technical person to be able to use this system.' },
  { id: 5, positive: true, zh: '我觉得这个系统的各项功能整合得很好。', en: 'I found the various functions in this system were well integrated.' },
  { id: 6, positive: false, zh: '我觉得这个系统里有太多不一致的地方。', en: 'I thought there was too much inconsistency in this system.' },
  { id: 7, positive: true, zh: '我相信大多数人能很快学会使用这个系统。', en: 'I would imagine that most people would learn to use this system very quickly.' },
  { id: 8, positive: false, zh: '我觉得这个系统用起来很麻烦。', en: 'I found the system very cumbersome to use.' },
  { id: 9, positive: true, zh: '我对使用这个系统很有信心。', en: 'I felt very confident using the system.' },
  { id: 10, positive: false, zh: '我需要先学很多东西才能上手这个系统。', en: 'I needed to learn a lot of things before I could get going with this system.' },
] as const

/** Sub-scale membership from Brooke's original analysis. */
export const USABILITY_ITEMS = [1, 2, 3, 5, 6, 7, 9]
export const LEARNABILITY_ITEMS = [4, 10]

export interface SusScore {
  /** 0–100 overall SUS score. */
  score: number
  usability: number
  learnability: number
  /** Adjective rating bucket for the 0–100 score. */
  rating: 'worst' | 'poor' | 'ok' | 'good' | 'excellent' | 'best'
  /** Number of items used; SUS is only valid with all 10. */
  complete: boolean
}

/**
 * Score one participant's responses.
 *
 * `responses` maps item id → 1–5. Missing items make the result `complete: false`
 * and are ignored in the sum (reported so invalid questionnaires can be dropped
 * rather than silently averaged in).
 */
export function scoreSus(responses: Record<number, number>): SusScore {
  let sum = 0
  let used = 0

  for (const item of SUS_ITEMS) {
    const raw = responses[item.id]
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    const clamped = Math.max(1, Math.min(5, Math.round(raw)))
    sum += item.positive ? clamped - 1 : 5 - clamped
    used += 1
  }

  const score = used > 0 ? (sum / used) * 25 : 0
  const usability = subScaleMean(responses, USABILITY_ITEMS)
  const learnability = subScaleMean(responses, LEARNABILITY_ITEMS)

  return { score, usability, learnability, rating: ratingOf(score), complete: used === SUS_ITEMS.length }
}

/**
 * Sub-scale mean on the same 0–100 basis.
 *
 * Per-item contribution is 0–4, so the ×25 turns the mean into 0–100 (with all
 * ten items this is identical to Brooke's `sum × 2.5`).
 */
function subScaleMean(responses: Record<number, number>, ids: readonly number[]): number {
  let sum = 0
  let used = 0
  for (const id of ids) {
    const item = SUS_ITEMS.find((i) => i.id === id)!
    const raw = responses[id]
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    const clamped = Math.max(1, Math.min(5, Math.round(raw)))
    sum += item.positive ? clamped - 1 : 5 - clamped
    used += 1
  }
  return used > 0 ? (sum / used) * 25 : 0
}

/** Adjective buckets from Bangor et al. (2009). */
export function ratingOf(score: number): SusScore['rating'] {
  if (score >= 85) return 'best'
  if (score >= 72) return 'excellent'
  if (score >= 68) return 'good'
  if (score >= 51) return 'ok'
  if (score >= 25) return 'poor'
  return 'worst'
}

export interface StudySummary {
  participants: number
  /** Participants whose questionnaire was incomplete and therefore excluded. */
  excluded: number
  meanScore: number
  medianScore: number
  stdDev: number
  min: number
  max: number
  /** 95% confidence interval half-width (t ≈ 2.26 for n ≈ 10, 1.96 for large n). */
  ci95: number
  usability: number
  learnability: number
}

/**
 * Aggregate a study's questionnaires.
 *
 * Incomplete questionnaires are excluded and counted, so the reported mean is
 * over valid responses only — that has to be stated in the thesis.
 */
export function summarizeStudy(responsesByParticipant: Array<Record<number, number>>): StudySummary {
  const scores: number[] = []
  let excluded = 0
  let usabilitySum = 0
  let learnabilitySum = 0

  for (const responses of responsesByParticipant) {
    const scored = scoreSus(responses)
    if (!scored.complete) {
      excluded += 1
      continue
    }
    scores.push(scored.score)
    usabilitySum += scored.usability
    learnabilitySum += scored.learnability
  }

  if (scores.length === 0) {
    return {
      participants: 0, excluded, meanScore: 0, medianScore: 0, stdDev: 0,
      min: 0, max: 0, ci95: 0, usability: 0, learnability: 0,
    }
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / (scores.length > 1 ? scores.length - 1 : 1)
  const stdDev = Math.sqrt(variance)
  const sorted = [...scores].sort((a, b) => a - b)
  const median = sorted.length % 2 === 1
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2

  // t for 95% CI: 2.262 at n=10, 2.045 at n=30; falls back to the normal quantile.
  const t = scores.length <= 10 ? 2.262 : scores.length <= 30 ? 2.045 : 1.96
  const ci95 = t * (stdDev / Math.sqrt(scores.length))

  return {
    participants: scores.length,
    excluded,
    meanScore: mean,
    medianScore: median,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    ci95,
    usability: usabilitySum / scores.length,
    learnability: learnabilitySum / scores.length,
  }
}

/** Markdown table for the thesis. */
export function formatStudySummary(summary: StudySummary): string {
  return [
    '| 指标 | 数值 |',
    '|------|------|',
    `| 有效参与者 | ${summary.participants}${summary.excluded > 0 ? `（剔除 ${summary.excluded} 份不完整问卷）` : ''} |`,
    `| SUS 均值 | ${summary.meanScore.toFixed(1)} ± ${summary.ci95.toFixed(1)} (95% CI) |`,
    `| 中位数 | ${summary.medianScore.toFixed(1)} |`,
    `| 标准差 | ${summary.stdDev.toFixed(1)} |`,
    `| 区间 | ${summary.min.toFixed(1)} – ${summary.max.toFixed(1)} |`,
    `| 可用性分量表 | ${summary.usability.toFixed(1)} |`,
    `| 易学性分量表 | ${summary.learnability.toFixed(1)} |`,
    '',
  ].join('\n')
}

/**
 * Task metrics for the study protocol (time on task, completion, understanding).
 */
export interface TaskRecord {
  participantId: string
  taskId: string
  /** Seconds spent. */
  seconds: number
  completed: boolean
  /** Whether the stated success criterion was met. */
  correct: boolean
  /** Optional 0–5 self-rated understanding of the area explored. */
  understanding?: number
  notes?: string
}

export interface TaskSummary {
  taskId: string
  attempts: number
  completionRate: number
  accuracyRate: number
  meanSeconds: number
  /** Median is reported alongside the mean: times are usually right-skewed. */
  medianSeconds: number
  meanUnderstanding: number
}

export function summarizeTasks(records: TaskRecord[]): TaskSummary[] {
  const byTask = new Map<string, TaskRecord[]>()
  for (const record of records) {
    if (!byTask.has(record.taskId)) byTask.set(record.taskId, [])
    byTask.get(record.taskId)!.push(record)
  }

  return [...byTask.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([taskId, items]) => {
    const times = items.map((i) => i.seconds).sort((a, b) => a - b)
    const understanding = items.map((i) => i.understanding).filter((v): v is number => typeof v === 'number')
    return {
      taskId,
      attempts: items.length,
      completionRate: items.filter((i) => i.completed).length / items.length,
      accuracyRate: items.filter((i) => i.correct).length / items.length,
      meanSeconds: times.reduce((a, b) => a + b, 0) / times.length,
      medianSeconds: times.length % 2 === 1
        ? times[(times.length - 1) / 2]
        : (times[times.length / 2 - 1] + times[times.length / 2]) / 2,
      meanUnderstanding: understanding.length > 0
        ? understanding.reduce((a, b) => a + b, 0) / understanding.length
        : 0,
    }
  })
}

export function formatTaskTable(summaries: TaskSummary[]): string {
  return [
    '| 任务 | 样本 | 完成率 | 正确率 | 平均耗时(s) | 中位耗时(s) | 自评理解(0–5) |',
    '|------|------|--------|--------|-------------|-------------|----------------|',
    ...summaries.map((s) => `| ${s.taskId} | ${s.attempts} | ${(s.completionRate * 100).toFixed(0)}% | ${(s.accuracyRate * 100).toFixed(0)}% | ${s.meanSeconds.toFixed(0)} | ${s.medianSeconds.toFixed(0)} | ${s.meanUnderstanding.toFixed(1)} |`),
    '',
  ].join('\n')
}
