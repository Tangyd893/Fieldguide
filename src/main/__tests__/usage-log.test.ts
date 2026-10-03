/**
 * Usage log: the privacy rules are the feature.
 *
 * "We only record counts" is exactly the kind of claim that rots silently, so the
 * rules are asserted against hostile input here rather than promised in a comment:
 * free text and unknown fields are dropped, logging is off until enabled, and the
 * summary reads back only what was written.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let dataDir: string

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: () => process.env.FIELDGUIDE_DATA_DIR || process.cwd(),
  },
}))

// The config module resolves the data directory lazily, so pointing the override at
// a temp folder before importing keeps every write inside the test sandbox.
beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'fg-usage-'))
  process.env.FIELDGUIDE_DATA_DIR = dataDir
  vi.resetModules()
})

afterEach(() => {
  delete process.env.FIELDGUIDE_DATA_DIR
  rmSync(dataDir, { recursive: true, force: true })
})

function writeConfig(enabled: boolean): void {
  writeFileSync(
    join(dataDir, 'config.json'),
    JSON.stringify({ usage: { enabled } }),
    'utf-8',
  )
}

function logFiles(): string[] {
  const dir = join(dataDir, 'usage')
  return readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
}

function logLines(): string[] {
  const dir = join(dataDir, 'usage')
  if (!readdirSync(dataDir).includes('usage')) return []
  return readdirSync(dir)
    .flatMap((f) => readFileSync(join(dir, f), 'utf-8').split('\n'))
    .filter((line) => line.trim())
}

describe('usage log', () => {
  it('sanitizes events: unknown fields and free text never survive', async () => {
    const { sanitizeEvent } = await import('../usage-log')

    // A caller passing far too much must lose all of it.
    const cleaned = sanitizeEvent({
      event: 'coach_asked',
      project: 'p1',
      target: 'function:internal/store/db.go:All',
      value: 3,
      // None of the following may be persisted:
      content: '我在这里问了什么长篇问题……',
      messages: [{ role: 'user', content: 'secret' }],
      answer: 'x'.repeat(5000),
    })

    expect(cleaned).toEqual({
      at: expect.any(String),
      event: 'coach_asked',
      project: 'p1',
      target: 'function:internal/store/db.go:All',
      value: 3,
    })
    expect(JSON.stringify(cleaned)).not.toContain('secret')
    expect(JSON.stringify(cleaned)).not.toContain('长篇问题')
  })

  it('rejects unknown event names and non-objects', async () => {
    const { sanitizeEvent } = await import('../usage-log')
    expect(sanitizeEvent({ event: 'exfiltrate_everything' })).toBeNull()
    expect(sanitizeEvent(null)).toBeNull()
    expect(sanitizeEvent('panel_opened')).toBeNull()
    expect(sanitizeEvent({})).toBeNull()
  })

  it('drops an over-long or sentence-like target instead of persisting it', async () => {
    const { sanitizeEvent } = await import('../usage-log')
    const cleaned = sanitizeEvent({ event: 'node_opened', target: 'a'.repeat(1000) })
    expect(cleaned).not.toBeNull()
    // A truncated node id would be a *wrong* identifier, so the field is dropped.
    expect(cleaned?.target).toBeUndefined()
    const justUnder = sanitizeEvent({ event: 'node_opened', target: 'a'.repeat(200) })
    expect(justUnder?.target?.length).toBe(200)
  })

  it('refuses a sentence in the identifier field', async () => {
    const { sanitizeEvent } = await import('../usage-log')
    // Prose through the field that exists for node ids and paths is the most
    // plausible way a question could leak, so the shape is validated.
    const prose = sanitizeEvent({
      event: 'node_opened',
      target: '请问这个项目的入口在哪里，为什么这样设计',
    })
    expect(prose?.target).toBeUndefined()

    const id = sanitizeEvent({ event: 'node_opened', target: 'function:internal/store/db.go:All' })
    expect(id?.target).toBe('function:internal/store/db.go:All')

    const path = sanitizeEvent({ event: 'file_opened', target: 'internal/service/handler.go' })
    expect(path?.target).toBe('internal/service/handler.go')

    const panel = sanitizeEvent({ event: 'panel_opened', target: 'progress' })
    expect(panel?.target).toBe('progress')
  })

  it('writes nothing at all while logging is disabled', async () => {
    writeConfig(false)
    const { recordUsage, usageLoggingEnabled } = await import('../usage-log')
    expect(usageLoggingEnabled()).toBe(false)
    recordUsage({ event: 'panel_opened', project: 'p1' })
    expect(() => readdirSync(join(dataDir, 'usage'))).toThrow()
  })

  it('writes one JSONL line per event once enabled, and aggregates them', async () => {
    writeConfig(true)
    const { recordUsage, summarizeUsage } = await import('../usage-log')

    recordUsage({ event: 'panel_opened', project: 'p1', target: 'progress' })
    recordUsage({ event: 'note_added', project: 'p1', target: 'internal/store/db.go', value: 3 })
    recordUsage({ event: 'coach_asked', project: 'p1' })
    recordUsage({ event: 'not_an_event', project: 'p1' }) // dropped

    expect(logFiles()).toHaveLength(1)
    expect(logLines()).toHaveLength(3)

    const summary = summarizeUsage(7)
    expect(summary.enabled).toBe(true)
    expect(summary.totalEvents).toBe(3)
    expect(summary.byEvent.panel_opened).toBe(1)
    expect(summary.byEvent.note_added).toBe(1)
    expect(summary.projects).toBe(1)
    // Two distinct identifiers were used (panel name + file path).
    expect(summary.distinctTargets).toBe(2)
    expect(summary.policy).toEqual({ freeText: false, offByDefault: true, localOnly: true })
    // The window always has one bucket per requested day.
    expect(summary.perDay).toHaveLength(7)
    expect(summary.perDay.at(-1)?.count).toBe(3)
  })

  it('reports an empty but well-formed summary when nothing was logged', async () => {
    writeConfig(false)
    const { summarizeUsage } = await import('../usage-log')
    const summary = summarizeUsage(3)
    expect(summary.totalEvents).toBe(0)
    expect(summary.byEvent).toEqual({})
    expect(summary.perDay).toHaveLength(3)
  })

  it('exports readable Markdown and states what it does not contain', async () => {
    writeConfig(true)
    const { recordUsage, exportUsageMarkdown } = await import('../usage-log')
    recordUsage({ event: 'review_graded', project: 'p1', target: 'card-1', value: 4 })

    const { content, events, files } = exportUsageMarkdown()
    expect(files).toBe(1)
    expect(events).toBe(1)
    expect(content).toContain('# Fieldguide 使用日志导出')
    expect(content).toContain('不含笔记正文、不含提问文本、不含源码')
    expect(content).toContain('| review_graded |')
  })

  it('survives a truncated final line (a crash mid-append)', async () => {
    writeConfig(true)
    const { recordUsage, summarizeUsage } = await import('../usage-log')
    recordUsage({ event: 'panel_opened', project: 'p1' })

    const dir = join(dataDir, 'usage')
    const file = join(dir, readdirSync(dir)[0])
    writeFileSync(file, `${readFileSync(file, 'utf-8')}{"event":"panel_op`, 'utf-8')

    const summary = summarizeUsage(7)
    expect(summary.totalEvents).toBe(1)
  })

  it('keeps working when the usage directory does not exist yet', async () => {
    writeConfig(true)
    mkdirSync(join(dataDir, 'usage'), { recursive: true })
    rmSync(join(dataDir, 'usage'), { recursive: true, force: true })
    const { summarizeUsage, usageFiles } = await import('../usage-log')
    expect(usageFiles()).toEqual([])
    expect(summarizeUsage(1).totalEvents).toBe(0)
  })
})
