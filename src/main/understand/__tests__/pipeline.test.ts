/**
 * Understand pipeline stage isolation.
 *
 * product-spec.md §六 requires "失败保留部分结果": a failing later stage must not
 * discard the stages that already succeeded, and the result must say which stage
 * failed rather than throwing everything away.
 *
 * The DB module is mocked: better-sqlite3 is a native addon built for Electron's
 * ABI, so this runs without touching SQLite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('../../db', () => ({
  getArchitectureSummary: vi.fn(() => null),
  replaceArchitectureSummary: vi.fn(),
  listKnowledgeNodes: vi.fn(() => []),
  replaceKnowledgeNodes: vi.fn(),
  replaceQuestions: vi.fn(),
}))

vi.mock('../knowledge', () => ({ generateKnowledgeNodes: vi.fn() }))
vi.mock('../interview', () => ({ generateInterviewQuestions: vi.fn() }))

import { runUnderstandPipeline } from '../pipeline'
import { generateKnowledgeNodes } from '../knowledge'
import { generateInterviewQuestions } from '../interview'
import { replaceArchitectureSummary, replaceKnowledgeNodes, replaceQuestions } from '../../db'

const mockKnowledge = vi.mocked(generateKnowledgeNodes)
const mockInterview = vi.mocked(generateInterviewQuestions)
const mockSaveArchitecture = vi.mocked(replaceArchitectureSummary)
const mockSaveKnowledge = vi.mocked(replaceKnowledgeNodes)
const mockSaveQuestions = vi.mocked(replaceQuestions)

let root: string

beforeEach(() => {
  root = join(tmpdir(), `fg-pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  mkdirSync(join(root, '.understand-anything'), { recursive: true })
  writeFileSync(
    join(root, '.understand-anything', 'knowledge-graph.json'),
    JSON.stringify({
      project: { projectName: 'pipeline-fixture', analyzedAt: '2026-01-01T00:00:00.000Z' },
      nodes: [
        { id: 'f:main.go', type: 'file', label: 'main.go', filePath: 'main.go', metadata: { summary: 'entry' } },
        { id: 'fn:main', type: 'function', label: 'main', filePath: 'main.go', lineRange: [3, 9] },
      ],
      edges: [{ source: 'f:main.go', target: 'fn:main', type: 'contains' }],
    }),
  )

  mockKnowledge.mockReset()
  mockInterview.mockReset()
  mockSaveArchitecture.mockClear()
  mockSaveKnowledge.mockClear()
  mockSaveQuestions.mockClear()
})

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

describe('runUnderstandPipeline', () => {
  it('runs every requested stage in order and persists each result', async () => {
    mockKnowledge.mockResolvedValue([
      { projectId: 'p1', concept: 'Layering', principle: 'p', tradeoffs: 't', examples: 'e', relatedNodeIds: [] },
    ])
    mockInterview.mockResolvedValue([
      {
        projectId: 'p1', problem: 'Why layered?', context: '', answer: 'a',
        relatedConcepts: [], knowledgeIds: [], relatedNodeIds: [],
      },
    ])

    const stagesSeen: string[] = []
    const result = await runUnderstandPipeline({
      projectId: 'p1',
      rootPath: root,
      onStage: (s) => stagesSeen.push(s),
    })

    expect(result.stages.map((s) => s.stage)).toEqual(['architecture', 'knowledge', 'interview'])
    expect(result.stages.every((s) => s.status === 'completed')).toBe(true)
    expect(stagesSeen).toEqual(['architecture', 'knowledge', 'interview'])
    expect(result.architecture).toBe(true)
    expect(result.knowledgeCount).toBe(1)
    expect(result.questionCount).toBe(1)
    expect(mockSaveArchitecture).toHaveBeenCalledWith('p1', expect.objectContaining({ projectId: 'p1' }))
    expect(mockSaveKnowledge).toHaveBeenCalledTimes(1)
    expect(mockSaveQuestions).toHaveBeenCalledTimes(1)
  })

  it('keeps architecture and still runs interview when the knowledge stage fails', async () => {
    mockKnowledge.mockRejectedValue(new Error('knowledge exploded'))
    mockInterview.mockResolvedValue([])

    const result = await runUnderstandPipeline({ projectId: 'p1', rootPath: root })

    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]))
    expect(byStage.architecture.status).toBe('completed')
    expect(byStage.knowledge.status).toBe('failed')
    expect(byStage.knowledge.error).toContain('knowledge exploded')
    expect(byStage.interview.status).toBe('completed')

    // The successful architecture result is persisted despite the later failure.
    expect(result.architecture).toBe(true)
    expect(mockSaveArchitecture).toHaveBeenCalledTimes(1)
    // The failed stage writes nothing.
    expect(mockSaveKnowledge).not.toHaveBeenCalled()
  })

  it('reports an interview failure without losing the knowledge stage', async () => {
    mockKnowledge.mockResolvedValue([
      { projectId: 'p1', concept: 'C', principle: 'p', tradeoffs: 't', examples: 'e', relatedNodeIds: [] },
    ])
    mockInterview.mockRejectedValue(new Error('interview exploded'))

    const result = await runUnderstandPipeline({ projectId: 'p1', rootPath: root })
    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]))

    expect(byStage.knowledge.status).toBe('completed')
    expect(byStage.knowledge.count).toBe(1)
    expect(byStage.interview.status).toBe('failed')
    expect(result.knowledgeCount).toBe(1)
    expect(result.questionCount).toBe(0)
    expect(mockSaveQuestions).not.toHaveBeenCalled()
  })

  it('only reports the stages the caller requested', async () => {
    mockKnowledge.mockResolvedValue([])

    const result = await runUnderstandPipeline({
      projectId: 'p1',
      rootPath: root,
      stages: ['knowledge'],
    })
    // architecture ran as an implicit dependency but is not reported as a user stage
    expect(result.stages.map((s) => s.stage)).toEqual(['knowledge'])
    expect(result.architecture).toBe(true)
  })

  it('throws when the project has no graph yet', async () => {
    const empty = join(tmpdir(), `fg-pipeline-empty-${Date.now()}`)
    mkdirSync(empty, { recursive: true })
    try {
      await expect(runUnderstandPipeline({ projectId: 'p1', rootPath: empty }))
        .rejects.toThrow(/index the project first/i)
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })

  it('skips dependent stages when the architecture stage fails and none is stored', async () => {
    // Architecture generation is mocked to fail for this case only.
    vi.resetModules()
    vi.doMock('../../db', () => ({
      getArchitectureSummary: vi.fn(() => null),
      replaceArchitectureSummary: vi.fn(),
      listKnowledgeNodes: vi.fn(() => []),
      replaceKnowledgeNodes: vi.fn(),
      replaceQuestions: vi.fn(),
    }))
    vi.doMock('../architecture', () => ({
      generateArchitectureSummary: vi.fn(async () => {
        throw new Error('architecture exploded')
      }),
    }))
    vi.doMock('../knowledge', () => ({ generateKnowledgeNodes: vi.fn() }))
    vi.doMock('../interview', () => ({ generateInterviewQuestions: vi.fn() }))

    const { runUnderstandPipeline: run } = await import('../pipeline')
    const result = await run({ projectId: 'p1', rootPath: root })

    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]))
    expect(byStage.architecture.status).toBe('failed')
    expect(byStage.architecture.error).toContain('architecture exploded')
    expect(byStage.knowledge.status).toBe('skipped')
    expect(byStage.interview.status).toBe('skipped')
    expect(result.architecture).toBe(false)
  })
})
