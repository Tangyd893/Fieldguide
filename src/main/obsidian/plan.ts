/**
 * Sync planning — the decision table for "what should happen to each file".
 *
 * Pure and I/O-free, for the same reason `db/migrations.ts` is: this is where the
 * rules live that must never lose a user's writing, so they are unit-testable and
 * identical for a dry-run preview and for the real run.
 *
 * Ownership model
 * ---------------
 * A note Fieldguide generated contains `%% fieldguide:begin %% … %% fieldguide:end %%`.
 * Inside the markers is ours; outside is the reader's.
 *
 *   - markers present  → merge: frontmatter keys we own are refreshed, the managed
 *                        region is replaced, everything the user wrote outside is
 *                        preserved byte-for-byte.
 *   - markers missing  → conflict: we no longer know what is ours, so the file is
 *                        left untouched and reported instead of guessed at.
 *   - file unknown to us and without our markers → conflict (`unowned-file`): a
 *                        human's note happens to sit at our path; writing there
 *                        would be destructive, so we do not.
 *   - source deleted, file untouched → delete.
 *   - source deleted, file edited    → keep (orphan) and say so.
 */
import type { SyncAction, VaultNoteKind, VaultSyncConflict } from './types'
import type { DiskNote, KnownNote, VaultNoteDoc } from './types'
import { computeHash, renderNote, rerenderNote, splitFrontmatter, splitManaged, withoutUpdatedStamp, MANAGED_BEGIN } from './render'

export interface PlanInput {
  desired: VaultNoteDoc[]
  /** Rows from `vault_notes`: what we believe we wrote last time. */
  known: KnownNote[]
  /** Files that currently exist, with their content. */
  disk: DiskNote[]
  /** Timestamp stamped into the notes (frontmatter). */
  updatedAt: string
  /** Project slug + display name, for frontmatter. */
  project: string
  projectName: string
}

export interface PlannedWrite {
  notePath: string
  title: string
  kind: VaultNoteKind
  sourceId: string
  content: string
  /** 'block' = merged around the reader's own text; 'full' = whole file written. */
  mode: 'block' | 'full'
}

export interface PlanResult {
  actions: SyncAction[]
  writes: PlannedWrite[]
  deletes: string[]
  conflicts: VaultSyncConflict[]
  orphaned: string[]
  warnings: string[]
  summary: {
    created: number
    updated: number
    unchanged: number
    removed: number
    conflicts: number
    orphans: number
  }
}

/** True when a foreign-looking file carries our markers or our frontmatter key. */
function looksLikeOurs(content: string): boolean {
  if (content.includes(MANAGED_BEGIN)) return true
  const { body } = splitFrontmatter(content)
  return /^fieldguide-project\s*:/m.test(body)
}

export function planVaultSync(input: PlanInput): PlanResult {
  const disk = new Map(input.disk.map((entry) => [entry.notePath, entry.content]))
  const known = new Map(input.known.map((entry) => [entry.notePath, entry]))
  const actions: SyncAction[] = []
  const writes: PlannedWrite[] = []
  const deletes: string[] = []
  const conflicts: VaultSyncConflict[] = []
  const orphaned: string[] = []
  const warnings: string[] = []

  const seenPaths = new Set<string>()
  const desiredPaths = new Set<string>()

  for (const doc of input.desired) {
    if (seenPaths.has(doc.notePath)) {
      warnings.push(`duplicate target path skipped: ${doc.notePath}`)
      continue
    }
    seenPaths.add(doc.notePath)
    desiredPaths.add(doc.notePath)

    const meta = {
      kind: doc.kind,
      project: input.project,
      projectName: input.projectName,
      source: doc.sourceId,
      nodeIds: doc.nodeIds,
      updated: input.updatedAt,
      aliases: [doc.title],
    }
    const existing = disk.get(doc.notePath)
    const row = known.get(doc.notePath)

    if (!row) {
      if (existing === undefined) {
        writes.push({
          notePath: doc.notePath,
          title: doc.title,
          kind: doc.kind,
          sourceId: doc.sourceId,
          content: renderNote({ meta, body: doc.body }),
          mode: 'full',
        })
        actions.push({ kind: 'create', notePath: doc.notePath, title: doc.title, noteKind: doc.kind })
        continue
      }
      if (looksLikeOurs(existing)) {
        // Written by an earlier Fieldguide version (or a lost database): safe to
        // take over, merging around the reader's text.
        const rendered = rerenderNote({ meta, body: doc.body, existing })
        writes.push({
          notePath: doc.notePath,
          title: doc.title,
          kind: doc.kind,
          sourceId: doc.sourceId,
          content: rendered.content,
          mode: rendered.mode,
        })
        actions.push({
          kind: 'adopt', notePath: doc.notePath, title: doc.title, noteKind: doc.kind,
          reason: 'existing note carries Fieldguide markers but had no bookkeeping row',
        })
        continue
      }
      conflicts.push({
        notePath: doc.notePath,
        title: doc.title,
        reason: 'unowned-file',
      })
      actions.push({
        kind: 'conflict', notePath: doc.notePath, title: doc.title, noteKind: doc.kind,
        reason: 'a file without Fieldguide markers already exists at this path',
      })
      continue
    }

    if (existing === undefined) {
      // The reader deleted the card in Obsidian; a sync means "make it exist".
      writes.push({
        notePath: doc.notePath,
        title: doc.title,
        kind: doc.kind,
        sourceId: doc.sourceId,
        content: renderNote({ meta, body: doc.body }),
        mode: 'full',
      })
      actions.push({
        kind: 'create', notePath: doc.notePath, title: doc.title, noteKind: doc.kind,
        reason: 'recreated after the file was removed',
      })
      continue
    }

    const split = splitManaged(splitFrontmatter(existing).rest)
    if (!split.hasMarkers) {
      conflicts.push({ notePath: doc.notePath, title: doc.title, reason: 'markers-missing' })
      actions.push({
        kind: 'conflict', notePath: doc.notePath, title: doc.title, noteKind: doc.kind,
        reason: 'the generated-block markers are gone, so the file is never rewritten automatically',
      })
      continue
    }

    const rendered = rerenderNote({ meta, body: doc.body, existing })
    const clean = computeHash(existing) === row.contentHash
    // The timestamp is excluded from the comparison, otherwise "nothing changed"
    // would still rewrite (and re-diff) every note on every run.
    if (withoutUpdatedStamp(rendered.content) === withoutUpdatedStamp(existing)) {
      actions.push({ kind: 'skip', notePath: doc.notePath, title: doc.title, noteKind: doc.kind })
      continue
    }

    writes.push({
      notePath: doc.notePath,
      title: doc.title,
      kind: doc.kind,
      sourceId: doc.sourceId,
      content: rendered.content,
      mode: rendered.mode,
    })
    actions.push({
      kind: 'update', notePath: doc.notePath, title: doc.title, noteKind: doc.kind,
      reason: clean ? undefined : 'kept your own text outside the generated block',
    })
  }

  // Notes we wrote before whose source no longer exists.
  for (const [notePath, row] of known) {
    if (desiredPaths.has(notePath)) continue
    const existing = disk.get(notePath)
    if (existing === undefined) {
      // Already gone from disk: drop the row silently.
      deletes.push(notePath)
      actions.push({ kind: 'delete', notePath, title: row.title, noteKind: row.kind, reason: 'file already removed' })
      continue
    }
    if (computeHash(existing) === row.contentHash) {
      deletes.push(notePath)
      actions.push({ kind: 'delete', notePath, title: row.title, noteKind: row.kind, reason: 'source no longer exists' })
      continue
    }
    orphaned.push(notePath)
    actions.push({
      kind: 'orphan-kept', notePath, title: row.title, noteKind: row.kind,
      reason: 'source no longer exists but the note was edited — kept',
    })
  }

  // Deleting a path that is also being written would be a self-inflicted data loss.
  const deletable = deletes.filter((path) => !desiredPaths.has(path))

  const count = (kind: SyncAction['kind']) => actions.filter((action) => action.kind === kind).length

  return {
    actions,
    writes,
    deletes: deletable,
    conflicts,
    orphaned,
    warnings,
    summary: {
      created: count('create') + count('adopt'),
      updated: count('update'),
      unchanged: count('skip'),
      removed: deletable.length,
      conflicts: count('conflict'),
      orphans: count('orphan-kept'),
    },
  }
}
