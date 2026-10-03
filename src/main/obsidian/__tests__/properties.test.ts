/**
 * Ownership-model properties (randomised).
 *
 * The sync engine makes one promise that matters more than any feature: **it never
 * destroys what the reader wrote**. `plan.test.ts` checks that promise on hand-picked
 * cases; these tests check it on generated ones, because the interesting failures live
 * in combinations an example-based test does not think of (a lost DB row *and* a user
 * edit *and* a deleted source, in one file).
 *
 * Four properties, each asserted over every generated case:
 *
 *   P1 幂等       — applying a plan and re-planning (with the clock moved) writes nothing
 *   P2 最小改写   — text outside the managed block and the user's own frontmatter keys
 *                   survive byte-for-byte
 *   P3 不删用户内容 — a file is only deleted while its content still matches our
 *                   recorded hash; edited files are kept and reported as orphans
 *   P4 路径封闭   — every plan path stays inside the project subdirectory and is a
 *                   clean relative posix path (no `..`, no separators from titles)
 *
 * Deterministic: a seeded PRNG drives every case, so a failure reproduces from its seed.
 */
import { describe, it, expect } from 'vitest'
import { planVaultSync, type PlanResult } from '../plan'
import {
  MANAGED_BEGIN,
  MANAGED_END,
  computeHash,
  renderNote,
  sanitizeNoteName,
  splitFrontmatter,
  subfolderForKind,
  userAnnotationText,
} from '../render'
import type { DiskNote, KnownNote, VaultNoteDoc } from '../types'
import type { VaultNoteKind } from '../../../shared/obsidian'

const FOLDER = 'proj'
const KINDS: VaultNoteKind[] = [
  'index', 'architecture', 'layer', 'module', 'tour', 'knowledge', 'interview', 'bridge', 'path', 'note', 'report',
]

/** mulberry32 — small, fast, deterministic. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(next: () => number, items: T[]): T {
  return items[Math.floor(next() * items.length)]
}

interface Case {
  desired: VaultNoteDoc[]
  disk: Map<string, string>
  known: Map<string, KnownNote>
}

function metaFor(doc: VaultNoteDoc, updated: string) {
  return {
    kind: doc.kind,
    project: FOLDER,
    projectName: 'Project',
    source: doc.sourceId,
    nodeIds: doc.nodeIds,
    updated,
    aliases: [doc.title],
  }
}

/** Insert a key the user owns into an existing note's frontmatter. */
function addUserFrontmatterKey(content: string, key: string, value: string): string {
  const { body, rest } = splitFrontmatter(content)
  if (!body) return `---\n${key}: ${value}\n---\n${rest}`
  return `---\n${body}\n${key}: ${value}\n---\n${rest}`
}

function makeCase(next: () => number, updated: string): Case {
  const count = 1 + Math.floor(next() * 4)
  const desired: VaultNoteDoc[] = []
  const disk = new Map<string, string>()
  const known = new Map<string, KnownNote>()

  for (let i = 0; i < count; i += 1) {
    const kind = pick(next, KINDS)
    const title = `Card ${i}`
    const subfolder = subfolderForKind(kind)
    const path = subfolder ? `${FOLDER}/${subfolder}/${title}.md` : `${FOLDER}/${title}.md`
    const oldBody = `## 旧正文 ${i}\n`
    // Sometimes the desired body is unchanged, which is what makes the "nothing to
    // do" (skip) branch reachable; otherwise the card content has moved on.
    const sameBody = next() < 0.35
    const doc: VaultNoteDoc = {
      notePath: path,
      title,
      kind,
      sourceId: `src-${i}`,
      nodeIds: [`file:${i}.go`],
      body: sameBody ? oldBody : `## 正文 ${i}\n\n- 要点 A\n- 要点 B\n`,
    }
    desired.push(doc)

    // A familiar-looking note, as a previous sync would have written it.
    const previous = renderNote({ meta: metaFor({ ...doc, body: oldBody }, '2026-09-01T00:00:00.000Z'), body: oldBody })
    const variant = Math.floor(next() * 6)
    let content: string | null = null
    let rowHash = computeHash(previous)

    if (variant === 0) {
      content = null // never written
    } else if (variant === 1) {
      content = previous // untouched since our write
    } else if (variant === 2) {
      // our write + the reader's own prose outside the block
      content = `${previous}\n我自己的笔记：这里为什么要用队列？\n`
      rowHash = computeHash(previous) // row still records OUR content
    } else if (variant === 3) {
      // the reader deleted the markers → we must never rewrite automatically
      content = previous.replace(MANAGED_BEGIN, '').replace(MANAGED_END, '')
    } else if (variant === 4) {
      // a human note happens to live at our path
      content = `# 我手写的笔记\n\n和 Fieldguide 无关。\n`
    } else {
      // user text *and* an extra frontmatter key they own
      content = addUserFrontmatterKey(
        `${previous}\n我的批注：注意背压。\n`,
        'my-own-key',
        'keep-me',
      )
      rowHash = computeHash(previous)
    }

    if (content !== null) disk.set(path, content)
    const hasRow = variant === 1 ? true : next() < 0.7
    if (hasRow && content !== null) {
      known.set(path, {
        notePath: path,
        title,
        kind,
        sourceId: doc.sourceId,
        contentHash: next() < 0.5 ? rowHash : 'stale-hash-from-an-older-run',
      })
    }
  }

  return { desired, disk, known }
}

/** Apply a plan to the in-memory disk/bookkeeping, as the real sync does. */
function applyPlan(plan: PlanResult, disk: Map<string, string>, known: Map<string, KnownNote>): void {
  for (const write of plan.writes) {
    disk.set(write.notePath, write.content)
    known.set(write.notePath, {
      notePath: write.notePath,
      title: write.title,
      kind: write.kind,
      sourceId: write.sourceId,
      contentHash: computeHash(write.content),
    })
  }
  for (const path of plan.deletes) {
    disk.delete(path)
    known.delete(path)
  }
}

function toDisk(disk: Map<string, string>): DiskNote[] {
  return [...disk.entries()].map(([notePath, content]) => ({ notePath, content }))
}

describe('ownership properties (randomised)', () => {
  it('never loses user content and is idempotent across 80 generated worlds', () => {
    // Coverage guard: if a refactor makes the generator stop producing a decision
    // branch, the properties below would quietly stop testing it.
    const seenActions = new Set<string>()

    for (let seed = 1; seed <= 80; seed += 1) {
      const next = rng(seed)
      const updatedAt = '2026-10-02T10:00:00.000Z'
      const world = makeCase(next, updatedAt)
      const label = (msg: string) => `seed ${seed}: ${msg}`

      const plan = planVaultSync({
        desired: world.desired,
        known: [...world.known.values()],
        disk: toDisk(world.disk),
        updatedAt,
        project: FOLDER,
        projectName: 'Project',
      })

      // ── P2: minimal rewrite ────────────────────────────────────────────────
      for (const write of plan.writes) {
        const before = world.disk.get(write.notePath)
        if (before === undefined) continue // created from nothing
        const annotation = userAnnotationText(before)
        if (annotation) {
          expect(write.content, label(`user text dropped in ${write.notePath}`)).toContain(annotation)
        }
        const userKeys = splitFrontmatter(before).body
          .split('\n')
          .filter((line) => /^my-own-key\s*:/.test(line))
        for (const key of userKeys) {
          expect(write.content, label(`user frontmatter key dropped in ${write.notePath}`)).toContain(key)
        }
      }

      // ── P3: a file is deleted only while it still matches our hash ──────────
      for (const path of plan.deletes) {
        const content = world.disk.get(path)
        const row = world.known.get(path)
        expect(content, label(`deleted a path that was not on disk: ${path}`)).toBeDefined()
        expect(row, label(`deleted a path with no bookkeeping row: ${path}`)).toBeDefined()
        expect(
          computeHash(content as string),
          label(`deleted a user-edited file: ${path}`),
        ).toBe(row?.contentHash)
      }

      // ── P4: path closure ───────────────────────────────────────────────────
      for (const write of [...plan.writes.map((w) => w.notePath), ...plan.deletes]) {
        expect(write.startsWith(`${FOLDER}/`) || /^[^/]+\.md$/.test(write), label(`path escaped the project folder: ${write}`)).toBe(true)
        expect(write.includes('..'), label(`path traversal in ${write}`)).toBe(false)
        expect(write.includes('\\'), label(`non-posix path ${write}`)).toBe(false)
        expect(write.startsWith('/'), label(`absolute-looking path ${write}`)).toBe(false)
      }

      // ── P1: idempotence ────────────────────────────────────────────────────
      applyPlan(plan, world.disk, world.known)
      const second = planVaultSync({
        desired: world.desired,
        known: [...world.known.values()],
        disk: toDisk(world.disk),
        updatedAt: '2026-10-02T11:00:00.000Z', // the clock moved: must still be a no-op
        project: FOLDER,
        projectName: 'Project',
      })
      expect(second.writes, label('second run rewrote files')).toEqual([])
      expect(second.deletes, label('second run deleted files')).toEqual([])

      // ── phase B: some sources disappear (deletion + orphan paths) ───────────
      const keep = world.desired.filter(() => next() < 0.5)
      const phaseB = planVaultSync({
        desired: keep,
        known: [...world.known.values()],
        disk: toDisk(world.disk),
        updatedAt: '2026-10-02T12:00:00.000Z',
        project: FOLDER,
        projectName: 'Project',
      })
      for (const path of phaseB.deletes) {
        const content = world.disk.get(path)
        const row = world.known.get(path)
        expect(computeHash(content as string), label(`phase B deleted an edited file: ${path}`)).toBe(row?.contentHash)
      }
      applyPlan(phaseB, world.disk, world.known)
      const phaseB2 = planVaultSync({
        desired: keep,
        known: [...world.known.values()],
        disk: toDisk(world.disk),
        updatedAt: '2026-10-02T13:00:00.000Z',
        project: FOLDER,
        projectName: 'Project',
      })
      expect(phaseB2.writes, label('phase B second run rewrote files')).toEqual([])
      expect(phaseB2.deletes, label('phase B second run deleted files')).toEqual([])

      for (const action of [...plan.actions, ...phaseB.actions]) seenActions.add(action.kind)
    }

    // Every branch of the decision table must have been exercised by the sweep,
    // otherwise "80 worlds passed" would be an overstatement of the coverage.
    for (const kind of ['create', 'update', 'skip', 'adopt', 'conflict', 'orphan-kept', 'delete']) {
      expect(seenActions.has(kind), `generator never produced a ${kind} action`).toBe(true)
    }
  })

  it('keeps a note whose source disappeared but the reader edited it', () => {
    const updatedAt = '2026-10-02T10:00:00.000Z'
    const doc: VaultNoteDoc = {
      notePath: `${FOLDER}/cards/Kept.md`,
      title: 'Kept',
      kind: 'knowledge',
      sourceId: 's1',
      nodeIds: [],
      body: '正文\n',
    }
    const written = renderNote({ meta: { ...metaFor(doc, updatedAt) }, body: doc.body })
    const edited = `${written}\n我的补充：这段和论文 3.2 节对应。\n`

    const plan = planVaultSync({
      desired: [], // the source is gone
      known: [{ notePath: doc.notePath, title: doc.title, kind: doc.kind, sourceId: doc.sourceId, contentHash: computeHash(written) }],
      disk: [{ notePath: doc.notePath, content: edited }],
      updatedAt,
      project: FOLDER,
      projectName: 'Project',
    })

    expect(plan.deletes).toEqual([])
    expect(plan.orphaned).toEqual([doc.notePath])
    expect(plan.actions.find((a) => a.notePath === doc.notePath)?.kind).toBe('orphan-kept')
  })

  it('sanitizes titles so a card can never escape its folder', () => {
    const hostile = [
      '../../etc/passwd',
      'a/b\\c:d*e?f"g<h>i|j',
      '..',
      '   ',
      'CON',
      '标题 #^[]{} 带特殊字符',
      'x'.repeat(200),
    ]
    for (const title of hostile) {
      const name = sanitizeNoteName(title, new Set())
      expect(name.includes('/'), `separator survived: ${title}`).toBe(false)
      expect(name.includes('\\'), `backslash survived: ${title}`).toBe(false)
      expect(name.includes('..'), `dot-dot survived: ${title}`).toBe(false)
      expect(name.length).toBeGreaterThan(0)
      expect(name.length).toBeLessThanOrEqual(80)
    }

    // Duplicate titles must not collide on disk.
    const taken = new Set<string>()
    const first = sanitizeNoteName('Card', taken)
    taken.add(first)
    const second = sanitizeNoteName('Card', taken)
    expect(second).not.toBe(first)
  })
})
