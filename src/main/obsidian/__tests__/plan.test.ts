import { describe, it, expect } from 'vitest'
import { planVaultSync, type PlanInput } from '../plan'
import { MANAGED_BEGIN, MANAGED_END, computeHash, renderNote } from '../render'
import type { VaultNoteDoc } from '../types'

const updatedAt = '2026-09-19T10:00:00.000Z'
const meta = {
  kind: 'knowledge' as const,
  project: 'pulsegate',
  projectName: 'PulseGate',
  source: 'kn-1',
  nodeIds: [],
  updated: updatedAt,
  aliases: ['卡片'],
}

function doc(overrides: Partial<VaultNoteDoc> = {}): VaultNoteDoc {
  return {
    notePath: 'Fieldguide/pulsegate/cards/卡片.md',
    title: '卡片',
    kind: 'knowledge',
    sourceId: 'kn-1',
    nodeIds: [],
    body: 'body v1',
    ...overrides,
  }
}

function plan(partial: Partial<PlanInput> = {}) {
  return planVaultSync({
    desired: [doc()],
    known: [],
    disk: [],
    updatedAt,
    project: 'pulsegate',
    projectName: 'PulseGate',
    ...partial,
  })
}

/**
 * What a previous sync left behind.
 *
 * `hash` is the hash of the file *we* wrote; `content` is what is on disk now, so
 * passing `extra` models "we wrote X, the reader then appended Y".
 */
function written(body = 'body v1', extra = '') {
  const mine = renderNote({ meta, body })
  return { content: `${mine}${extra}`, hash: computeHash(mine), notePath: doc().notePath }
}

describe('planVaultSync — create', () => {
  it('creates a note that exists nowhere', () => {
    const result = plan()
    expect(result.summary.created).toBe(1)
    expect(result.writes).toHaveLength(1)
    expect(result.writes[0].mode).toBe('full')
    expect(result.actions[0].kind).toBe('create')
  })

  it('recreates a note the reader deleted in Obsidian', () => {
    const result = plan({ known: [{ notePath: doc().notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: 'deadbeef' }] })
    expect(result.summary.created).toBe(1)
    expect(result.actions[0].reason).toContain('removed')
  })

  it('adopts an unbookkept file that carries our markers', () => {
    const existing = renderNote({ meta, body: 'body v0' })
    const result = plan({ disk: [{ notePath: doc().notePath, content: existing }] })
    expect(result.summary.created).toBe(1)
    expect(result.actions[0].kind).toBe('adopt')
    expect(result.writes[0].mode).toBe('block')
  })

  it('refuses to touch a foreign file that happens to sit at our path', () => {
    const result = plan({ disk: [{ notePath: doc().notePath, content: '# 我自己的笔记\n' }] })
    expect(result.writes).toHaveLength(0)
    expect(result.summary.conflicts).toBe(1)
    expect(result.conflicts[0].reason).toBe('unowned-file')
  })
})

describe('planVaultSync — update / skip', () => {
  it('skips when nothing changed', () => {
    const previous = written()
    const result = plan({
      known: [{ notePath: previous.notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: previous.hash }],
      disk: [{ notePath: previous.notePath, content: previous.content }],
    })
    expect(result.summary.unchanged).toBe(1)
    expect(result.writes).toHaveLength(0)
    expect(result.actions[0].kind).toBe('skip')
  })

  it('stays a no-op when only the clock moved', () => {
    // The generator stamps a timestamp into the frontmatter; comparing raw content
    // would rewrite every note on every run and destroy incremental syncing.
    const previous = written()
    const result = plan({
      updatedAt: '2026-10-01T09:30:00.000Z',
      known: [{ notePath: previous.notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: previous.hash }],
      disk: [{ notePath: previous.notePath, content: previous.content }],
    })
    expect(result.summary.unchanged).toBe(1)
    expect(result.writes).toHaveLength(0)
  })

  it('updates when the sources changed and the file is clean', () => {
    const previous = written('body v1')
    const result = plan({
      desired: [doc({ body: 'body v2' })],
      known: [{ notePath: previous.notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: previous.hash }],
      disk: [{ notePath: previous.notePath, content: previous.content }],
    })
    expect(result.summary.updated).toBe(1)
    expect(result.writes[0].content).toContain('body v2')
    expect(result.actions[0].reason).toBeUndefined()
  })

  it('merges around the reader\'s own edits and says so', () => {
    const previous = written('body v1', '\n我的批注\n')
    const result = plan({
      desired: [doc({ body: 'body v2' })],
      known: [{ notePath: previous.notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: previous.hash }],
      disk: [{ notePath: previous.notePath, content: previous.content }],
    })
    expect(result.summary.updated).toBe(1)
    expect(result.writes[0].mode).toBe('block')
    expect(result.writes[0].content).toContain('我的批注')
    expect(result.actions[0].reason).toContain('your own text')
  })

  it('treats a note whose markers were removed as a conflict and leaves it alone', () => {
    const content = '# 被我改写过的卡片\n\n没有标记了\n'
    const result = plan({
      known: [{ notePath: doc().notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: computeHash('something else') }],
      disk: [{ notePath: doc().notePath, content }],
    })
    expect(result.writes).toHaveLength(0)
    expect(result.conflicts[0].reason).toBe('markers-missing')
    expect(result.actions[0].kind).toBe('conflict')
  })
})

describe('planVaultSync — removals', () => {
  it('deletes a generated note whose source disappeared and that is untouched', () => {
    const previous = written()
    const result = plan({
      desired: [],
      known: [{ notePath: previous.notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: previous.hash }],
      disk: [{ notePath: previous.notePath, content: previous.content }],
    })
    expect(result.summary.removed).toBe(1)
    expect(result.deletes).toEqual([previous.notePath])
  })

  it('keeps a note the reader edited and reports it as an orphan', () => {
    const previous = written('body v1', '\n我很喜欢这段\n')
    const result = plan({
      desired: [],
      known: [{ notePath: previous.notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: previous.hash }],
      disk: [{ notePath: previous.notePath, content: previous.content }],
    })
    expect(result.deletes).toEqual([])
    expect(result.orphaned).toEqual([previous.notePath])
    expect(result.actions[0].kind).toBe('orphan-kept')
  })

  it('never deletes a path it is also writing', () => {
    const previous = written('body v1')
    const result = plan({
      desired: [doc({ body: 'body v2' })],
      known: [{ notePath: previous.notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: previous.hash }],
      disk: [{ notePath: previous.notePath, content: previous.content }],
    })
    expect(result.deletes).toEqual([])
    expect(result.summary.updated).toBe(1)
  })
})

describe('planVaultSync — robustness', () => {
  it('never emits a write for a conflicting path', () => {
    const previous = written()
    const result = plan({
      desired: [doc({ body: 'v2' })],
      known: [
        { notePath: previous.notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: previous.hash },
      ],
      disk: [
        { notePath: previous.notePath, content: 'user rewrote it entirely' },
        { notePath: 'Fieldguide/pulsegate/我的笔记.md', content: 'free text' },
      ],
    })
    const conflictPaths = new Set(result.conflicts.map((conflict) => conflict.notePath))
    for (const write of result.writes) {
      // A conflicting path must not also be written in the same run.
      expect(conflictPaths.has(write.notePath)).toBe(false)
    }
  })

  it('keeps the user\'s text out of every write it does make', () => {
    const previous = written('body v1', '\n保留我\n')
    const result = plan({
      desired: [doc({ body: 'body v2' })],
      known: [{ notePath: previous.notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: previous.hash }],
      disk: [{ notePath: previous.notePath, content: previous.content }],
    })
    expect(result.writes[0].content).toContain('保留我')
    expect(result.writes[0].content).toContain(MANAGED_BEGIN)
    expect(result.writes[0].content).toContain(MANAGED_END)
  })

  it('warns and skips duplicate target paths instead of writing twice', () => {
    const result = plan({ desired: [doc(), doc({ body: 'other' })] })
    expect(result.writes).toHaveLength(1)
    expect(result.warnings[0]).toContain('duplicate')
  })

  it('produces a deterministic action list for the same input', () => {
    const previous = written('body v1')
    const input: Partial<PlanInput> = {
      desired: [doc({ body: 'body v2' })],
      known: [{ notePath: previous.notePath, title: '卡片', kind: 'knowledge', sourceId: 'kn-1', contentHash: previous.hash }],
      disk: [{ notePath: previous.notePath, content: previous.content }],
    }
    expect(plan(input)).toEqual(plan(input))
  })
})
