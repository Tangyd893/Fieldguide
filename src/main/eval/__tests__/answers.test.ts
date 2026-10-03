/**
 * Answer-level scoring tests.
 *
 * These run purely on in-memory recordings: the offline scorer is what CI uses,
 * so it must be proven without an API key, without the real fixture graph being
 * touched, and without any committed "example results" that could be mistaken
 * for measurements.
 */
import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { scoreRecordedAnswers, type AnswerRecording, type EvalDataset } from '../harness'

const repoRoot = process.cwd()
const TINY_GO = join(repoRoot, 'tests', 'fixtures', 'tiny-go')

/** A two-item dataset over the tiny-go fixture (13 nodes / 12 edges). */
const dataset: EvalDataset = {
  name: 'unit-tiny',
  projectPath: 'tests/fixtures/tiny-go',
  items: [
    {
      id: 'u1',
      kind: 'locate',
      question: '入口在哪？',
      expect: { nodes: ['file:cmd/main.go'], files: ['cmd/main.go'] },
    },
    {
      id: 'u2',
      kind: 'locate',
      question: '存储在哪？',
      expect: { nodes: ['file:internal/store/db.go'], files: ['internal/store/db.go'] },
    },
  ],
}

function recording(answers: AnswerRecording['answers'], model = 'unit-model'): AnswerRecording {
  return { dataset: 'unit-tiny', model, recordedAt: '2026-01-01T00:00:00.000Z', answers }
}

describe('scoreRecordedAnswers', () => {
  it('scores a faithful answer as full recall and zero hallucination', () => {
    const report = scoreRecordedAnswers(
      dataset,
      recording([{ id: 'u1', citedNodeIds: ['file:cmd/main.go'] }]),
      repoRoot,
    )
    expect(report.scored).toBe(1)
    expect(report.results[0].faithful).toBe(1)
    expect(report.results[0].citationPrecision).toBe(1)
    expect(report.results[0].citationRecall).toBe(1)
    expect(report.results[0].hallucinationRate).toBe(0)
    expect(report.hallucinatedRefs).toBe(0)
    expect(report.citedRefs).toBe(1)
  })

  it('separates "cited the wrong real node" from "cited a node that does not exist"', () => {
    const report = scoreRecordedAnswers(
      dataset,
      recording([
        // real but wrong: hurts precision/recall, not faithfulness
        { id: 'u1', citedNodeIds: ['file:internal/store/db.go'] },
        // made up: hurts faithfulness and the hallucination rate
        { id: 'u2', citedNodeIds: ['function:internal/store/db.go:DoesNotExist'] },
      ]),
      repoRoot,
    )
    const [wrongReal, hallucinated] = report.results
    expect(wrongReal.faithful).toBe(1)
    expect(wrongReal.citationPrecision).toBe(0)
    expect(wrongReal.citationRecall).toBe(0)
    expect(wrongReal.hallucinationRate).toBe(0)

    expect(hallucinated.faithful).toBe(0)
    expect(hallucinated.hallucinationRate).toBe(1)
    // Precision/recall are computed on real citations only, so a fabricated id
    // cannot inflate them — that is the whole point of tracking them apart.
    expect(hallucinated.citationPrecision).toBe(0)
    expect(report.hallucinatedRefs).toBe(1)
    expect(report.citedRefs).toBe(2)
  })

  it('counts a file-level hit, not just an exact node id', () => {
    const report = scoreRecordedAnswers(
      dataset,
      recording([{ id: 'u2', citedNodeIds: ['class:internal/store/db.go:DB'] }]),
      repoRoot,
    )
    expect(report.results[0].citationRecall).toBeGreaterThan(0)
    expect(report.results[0].citationPrecision).toBe(1)
  })

  it('reports missing items instead of scoring them as zero, and flags stale ids', () => {
    const report = scoreRecordedAnswers(
      dataset,
      recording([
        { id: 'u1', citedNodeIds: ['file:cmd/main.go'] },
        { id: 'u-old', citedNodeIds: ['file:cmd/main.go'] },
      ]),
      repoRoot,
    )
    expect(report.scored).toBe(1)
    expect(report.missing).toEqual(['u2'])
    expect(report.unknown).toEqual(['u-old'])
    expect(report.markdown).toContain('缺 1 题')
    expect(report.markdown).toContain('录制已过期')
  })

  it('sums token usage so cost can be reported next to quality', () => {
    const report = scoreRecordedAnswers(
      dataset,
      recording([
        { id: 'u1', citedNodeIds: ['file:cmd/main.go'], usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 } },
        { id: 'u2', citedNodeIds: [], usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 } },
      ]),
      repoRoot,
    )
    expect(report.tokens).toEqual({ prompt: 150, completion: 30, total: 180 })
    // Nothing cited is not the same as citing badly: faithfulness stays 1.
    expect(report.results[1].faithful).toBe(1)
    expect(report.results[1].hallucinationRate).toBe(0)
  })

  it('refuses a recording that belongs to another dataset', () => {
    expect(() =>
      scoreRecordedAnswers(dataset, { ...recording([]), dataset: 'someone-else' }, repoRoot),
    ).toThrow(/not "unit-tiny"/)
  })
})
