import { describe, it, expect } from 'vitest'
import { classifyNote } from '../read'
import { MANAGED_BEGIN, MANAGED_END, computeHash, renderNote } from '../render'

/**
 * `classifyNote` decides the status the whole ownership model rests on: is the file
 * still ours, did the reader annotate it, or has it become something we must not
 * touch? It is pure, so it is tested directly rather than through the panel.
 */
const meta = {
  kind: 'knowledge' as const,
  project: 'pulsegate',
  projectName: 'PulseGate',
  source: 'kn-1',
  nodeIds: [],
  updated: '2026-09-19T10:00:00.000Z',
  aliases: ['卡片'],
}

const written = renderNote({ meta, body: 'generated body' })

describe('classifyNote', () => {
  it('reports a missing file', () => {
    expect(classifyNote(null, computeHash(written))).toBe('missing')
  })

  it('reports clean when the bytes still match what we wrote', () => {
    expect(classifyNote(written, computeHash(written))).toBe('clean')
  })

  it('reports user-edited when the reader wrote outside the block', () => {
    const annotated = `${written}\n我的批注：这里要重读。\n`
    expect(classifyNote(annotated, computeHash(written))).toBe('user-edited')
  })

  it('reports user-edited even when the reader touched the generated region', () => {
    // The markers define ownership, so an in-block edit is still mergeable — that
    // is what keeps a normal re-sync from turning into a conflict.
    const edited = written.replace('generated body', 'generated body, tweaked by hand')
    expect(edited).toContain(MANAGED_BEGIN)
    expect(classifyNote(edited, computeHash(written))).toBe('user-edited')
  })

  it('reports conflict when the markers are gone', () => {
    const rewitten = '# 我自己的笔记\n\n没有标记了\n'
    expect(classifyNote(rewitten, computeHash(written))).toBe('conflict')
  })

  it('reports conflict when only one of the two markers survives', () => {
    const half = `${written.replace(MANAGED_END, '')}`
    expect(classifyNote(half, computeHash(written))).toBe('conflict')
  })

  it('treats a foreign file at our path as a conflict, not as clean', () => {
    const foreign = '---\ntitle: 别的笔记\n---\n\n别人的内容\n'
    expect(classifyNote(foreign, computeHash(written))).toBe('conflict')
  })
})
