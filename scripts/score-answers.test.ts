/**
 * Score recorded agent answers offline (C1, answer level).
 *
 *   pnpm eval:answers
 *
 * Input: `eval/answers/<dataset>.<model>.json`, produced by `pnpm eval:record-answers`
 * (the only step that needs an API key — see scripts/record-answers.mjs).
 * Output: `docs/eval/agent-answers.md`.
 *
 * Splitting recording from scoring is what lets the citation metrics live in CI:
 * the expensive, non-deterministic, key-requiring step happens once and is
 * committed, while re-scoring stays local, free and reproducible.
 *
 * With no recordings present this script does not fail — it reports the gap, so a
 * report is never silently published with zero answer-level evidence.
 */
import { describe, it, expect, vi } from 'vitest'
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: () => process.env.TEMP || process.cwd(),
  },
}))

import {
  loadDataset,
  loadRecording,
  scoreRecordedAnswers,
  type AnswerReport,
} from '../src/main/eval/harness'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const datasetsDir = join(repoRoot, 'eval', 'datasets')
const answersDir = join(repoRoot, 'eval', 'answers')
const outPath = join(repoRoot, 'docs', 'eval', 'agent-answers.md')

/** Recordings for one dataset, newest filename order. */
function recordingsFor(datasetName: string): string[] {
  if (!existsSync(answersDir)) return []
  return readdirSync(answersDir)
    .filter((f) => f.startsWith(`${datasetName}.`) && f.endsWith('.json'))
    .sort()
}

/** Mean of one citation metric over the scored items, formatted like the report. */
function scoreRowOf(report: AnswerReport, label: string): string {
  const pick = (fn: (r: AnswerReport['results'][number]) => number | undefined) =>
    report.results.map(fn).filter((v): v is number => v !== undefined)
  let values: number[] = []
  if (label === '引用忠实度') values = pick((r) => r.faithful)
  else if (label === '引用精确率') values = pick((r) => r.citationPrecision)
  else if (label === '引用召回率') values = pick((r) => r.citationRecall)
  else if (label === '引用幻觉率（越低越好）') values = pick((r) => r.hallucinationRate)
  if (values.length === 0) return '—'
  return `${((values.reduce((a, b) => a + b, 0) / values.length) * 100).toFixed(1)}%`
}

describe('answer-level evaluation (recorded runs)', () => {
  it('scores every recording it finds and writes the answer-level report', () => {
    const datasets = readdirSync(datasetsDir).filter((f) => f.endsWith('.qa.json')).sort()
    const blocks: string[] = []
    const summaryRows: string[] = []
    const skipped: string[] = []

    for (const file of datasets) {
      const dataset = loadDataset(join(datasetsDir, file))
      const recordings = recordingsFor(dataset.name)
      if (recordings.length === 0) {
        skipped.push(`- **${dataset.name}**：没有录制文件（预期 \`eval/answers/${dataset.name}.<model>.json\`）`)
        continue
      }

      for (const recordingFile of recordings) {
        const recording = loadRecording(join(answersDir, recordingFile))
        const report = scoreRecordedAnswers(dataset, recording, repoRoot)

        // A recording that references questions the dataset no longer has is
        // stale: its numbers describe a benchmark that no longer exists.
        expect(
          report.unknown,
          `${recordingFile} 引用了数据集里不存在的题目，需重新录制：${report.unknown.join('、')}`,
        ).toEqual([])
        expect(report.scored).toBeGreaterThan(0)

        summaryRows.push(
          `| ${report.dataset} | ${report.model} | ${report.scored}/${dataset.items.length} | ` +
            `${scoreRowOf(report, '引用忠实度')} | ${scoreRowOf(report, '引用精确率')} | ${scoreRowOf(report, '引用召回率')} | ` +
            `${scoreRowOf(report, '引用幻觉率（越低越好）')} | ${report.tokens.total} |`,
        )
        blocks.push(report.markdown)
      }
    }

    const header = [
      '# 答案级评测：引用可信性（C1 的答案侧）',
      '',
      '> 由 `pnpm eval:answers` 生成。**评分离线**：录制文件一旦存在，重跑评分不需要 API Key，结果可复现。',
      '> 录制由 `pnpm eval:record-answers` 完成（需要 Key，是唯一会产生费用的步骤）。',
      '> 指标定义见 `src/main/eval/metrics.ts`；引用口径逐条记在录制文件里，避免把「检索到的节点」当成「答案引用的节点」。',
      '',
      '## 汇总（跨数据集 / 跨模型）',
      '',
      '| 数据集 | 模型 | 覆盖 | 引用忠实度 | 引用精确率 | 引用召回率 | 引用幻觉率 | tokens |',
      '|--------|------|------|------------|------------|------------|------------|--------|',
      ...(summaryRows.length > 0 ? summaryRows : ['| — | — | — | — | — | — | — | — |']),
      '',
    ]

    if (skipped.length > 0) {
      header.push(
        '## 尚未录制',
        '',
        ...skipped,
        '',
        '> 这些数据集目前只有检索级指标。答案级指标需要一次带 Key 的录制；缺失会被如实列出，不会用 0 填充。',
        '',
      )
    }

    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, `${header.join('\n')}\n${blocks.join('\n---\n\n')}\n`, 'utf-8')

    console.log(`\n[eval] answer report → ${outPath}`)
    console.log(`[eval] recordings scored: ${summaryRows.length}, datasets without recordings: ${skipped.length}`)
    for (const line of summaryRows) console.log(`  ${line}`)
  }, 120_000)
})
