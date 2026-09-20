/**
 * Note rendering — everything about the *text* of a vault note, and nothing about
 * the filesystem.
 *
 * Two decisions shape this module:
 *
 *  1. **The user owns the file.** Card bodies live inside `%% fieldguide:begin %%`
 *     … `%% fieldguide:end %%` comment markers. Text outside them is the reader's
 *     own notes and is never rewritten; frontmatter keys that are not ours are
 *     preserved line-for-line, and `tags` is merged rather than replaced.
 *  2. **Everything is pure.** Frontmatter quoting, name sanitising and block
 *     merging are where data loss would happen, so they are testable in isolation
 *     (see `__tests__/render.test.ts`) and are never intertwined with I/O.
 */
import { createHash } from 'node:crypto'
import type { VaultNoteKind } from './types'

export const MANAGED_BEGIN = '%% fieldguide:begin %%'
export const MANAGED_END = '%% fieldguide:end %%'

/** Frontmatter keys Fieldguide owns; anything else in the file is left alone. */
const OWNED_KEYS = new Set([
  'type',
  'fieldguide-project',
  'fieldguide-project-name',
  'fieldguide-kind',
  'fieldguide-source',
  'fieldguide-node-ids',
  'fieldguide-updated',
  'aliases',
  'tags',
])

/* ──────────── YAML scalars ──────────── */

/**
 * Quote a YAML scalar when leaving it bare would change its meaning.
 *
 * Note titles are free-form (they come from the user's own project), so `:`/`#`
 * and a leading indicator character all have to be handled rather than hoped away.
 */
export function yamlScalar(value: string): string {
  const text = String(value ?? '')
  if (text === '') return "''"
  const needsQuotes =
    /^[\s]|[\s]$/.test(text)
    || /[:#]/.test(text)
    // A quote anywhere makes the bare scalar ambiguous (or invalid) YAML, so it
    // must be quoted and escaped no matter where it sits.
    || text.includes('"')
    || /^[-?*&!|>%@`'[\]{}]/.test(text)
    || /[\n\r\t]/.test(text)
    || /^(true|false|null|yes|no|on|off|~)$/i.test(text)
    || /^[+-]?(\d|\.\d)/.test(text)
  if (!needsQuotes) return text
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`
}

/** Inline YAML list, always via the flow style so it stays one line we control. */
export function yamlList(values: string[]): string {
  if (values.length === 0) return '[]'
  return `[${values.map((v) => yamlScalar(v)).join(', ')}]`
}

/** Parse the inline-list form we write, tolerating comma-separated input. */
export function parseInlineList(raw: string): string[] {
  const text = String(raw ?? '').trim()
  if (!text || text === '[]') return []
  const inner = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text
  return inner
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

/* ──────────── frontmatter ──────────── */

export interface NoteMeta {
  kind: VaultNoteKind
  /** Project slug. */
  project: string
  projectName: string
  /** Source row id ('' for aggregate notes). */
  source: string
  nodeIds: string[]
  /** ISO timestamp of this generation. */
  updated: string
  /** Extra link targets, so `[[Card title]]` resolves. */
  aliases?: string[]
  /** Extra tags beyond the Fieldguide defaults. */
  extraTags?: string[]
}

/** Tags every generated note carries, so the vault can be filtered by project. */
function noteTags(meta: NoteMeta): string[] {
  return [
    'fieldguide',
    `project/${meta.project}`,
    `kind/${meta.kind}`,
    ...(meta.extraTags ?? []),
  ]
}

export interface FrontmatterParts {
  /** Raw frontmatter body (without the `---` fences), '' when the file has none. */
  body: string
  rest: string
}

/** Split a note into its frontmatter and the remainder. */
export function splitFrontmatter(content: string): FrontmatterParts {
  const text = String(content ?? '')
  if (!text.startsWith('---')) return { body: '', rest: text }
  const end = text.indexOf('\n---', 3)
  if (end < 0) return { body: '', rest: text }
  const body = text.slice(text.indexOf('\n', 3) + 1, end)
  const afterFence = text.indexOf('\n', end + 1)
  const rest = afterFence < 0 ? '' : text.slice(afterFence + 1)
  return { body, rest }
}

/** Value of a top-level frontmatter key, or null when absent. */
export function frontmatterValue(body: string, key: string): string | null {
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.*)$`, 'm')
  const match = pattern.exec(body)
  return match ? match[1].trim() : null
}

/**
 * Merge our keys into existing frontmatter without touching the user's own.
 *
 * Line-based on purpose: a full YAML round-trip would reformat the whole block
 * (and could drop comments or anchors) in a file the user also edits.
 */
export function mergeFrontmatter(existingBody: string, meta: NoteMeta): string {
  const desired: Array<[string, string]> = [
    ['type', yamlScalar(`fieldguide/${meta.kind}`)],
    ['fieldguide-project', yamlScalar(meta.project)],
    ['fieldguide-project-name', yamlScalar(meta.projectName)],
    ['fieldguide-kind', yamlScalar(meta.kind)],
    ['fieldguide-source', yamlScalar(meta.source)],
    ['fieldguide-node-ids', yamlList(meta.nodeIds)],
    ['fieldguide-updated', yamlScalar(meta.updated)],
    ['aliases', yamlList(meta.aliases ?? [])],
    [
      'tags',
      yamlList([...new Set([...parseInlineList(frontmatterValue(existingBody, 'tags') ?? ''), ...noteTags(meta)])]),
    ],
  ]

  const lines = existingBody.split('\n').filter((line, index, all) => !(index === all.length - 1 && line === ''))
  const emitted = new Set<string>()

  const merged = lines.map((line) => {
    const match = /^([A-Za-z0-9_-]+)\s*:/.exec(line)
    const key = match?.[1]
    if (!key || !OWNED_KEYS.has(key)) return line
    if (emitted.has(key)) return line
    const replacement = desired.find(([k]) => k === key)
    emitted.add(key)
    return replacement ? `${replacement[0]}: ${replacement[1]}` : line
  })

  for (const [key, value] of desired) {
    if (!emitted.has(key)) merged.push(`${key}: ${value}`)
  }

  return merged.join('\n')
}

/* ──────────── managed block ──────────── */

export interface ManagedSplit {
  /** Everything before the opening marker (the user's preamble). */
  before: string
  /** Generated body, '' when the markers are missing. */
  managed: string
  /** Everything after the closing marker (the user's own notes). */
  after: string
  hasMarkers: boolean
}

/** Split a note body around the managed block. */
export function splitManaged(body: string): ManagedSplit {
  const text = String(body ?? '')
  const beginAt = text.indexOf(MANAGED_BEGIN)
  const endAt = text.indexOf(MANAGED_END)
  if (beginAt < 0 || endAt < 0 || endAt < beginAt) {
    return { before: text, managed: '', after: '', hasMarkers: false }
  }
  return {
    before: text.slice(0, beginAt),
    managed: text.slice(beginAt + MANAGED_BEGIN.length, endAt),
    after: text.slice(endAt + MANAGED_END.length),
    hasMarkers: true,
  }
}

/** Wrap a generated body in the markers. */
export function wrapManaged(body: string): string {
  const inner = String(body ?? '').trim()
  return `${MANAGED_BEGIN}\n${inner}\n${MANAGED_END}`
}

/** Text the user wrote outside the managed region — their annotations. */
export function userAnnotationText(content: string): string {
  const { rest } = splitFrontmatter(content)
  const { before, after, hasMarkers } = splitManaged(rest)
  if (!hasMarkers) return ''
  return `${before}\n${after}`.trim()
}

/* ──────────── whole notes ──────────── */

export interface RenderNoteInput {
  meta: NoteMeta
  /** Generated body markdown (no frontmatter, no markers). */
  body: string
  /** Existing file content, when the note already exists. */
  existing?: string
}

/** Render a brand-new note (frontmatter + managed block). */
export function renderNote(input: RenderNoteInput): string {
  const frontmatter = mergeFrontmatter(
    input.existing ? splitFrontmatter(input.existing).body : '',
    input.meta,
  )
  return `---\n${frontmatter}\n---\n\n${wrapManaged(input.body)}\n`
}

/**
 * Re-render an existing note.
 *
 * `mode: 'block'` means the markers were intact: frontmatter is merged and only the
 * generated region is replaced, so the reader's own notes survive verbatim.
 */
export function rerenderNote(input: RenderNoteInput & { existing: string }): { content: string; mode: 'block' | 'full' } {
  const { body: frontmatterBody, rest } = splitFrontmatter(input.existing)
  const split = splitManaged(rest)

  if (!split.hasMarkers) {
    // No markers: the file is either ours-but-rewritten or foreign. The caller
    // decides (conflict); when it does rewrite, the user's text is preserved
    // below the fresh managed block rather than dropped.
    const preserved = rest.trim()
    const frontmatter = mergeFrontmatter(frontmatterBody, input.meta)
    const tail = preserved ? `\n\n${preserved}\n` : '\n'
    return { content: `---\n${frontmatter}\n---\n\n${wrapManaged(input.body)}${tail}`, mode: 'full' }
  }

  const before = split.before.replace(/\s+$/, '')
  const after = split.after.replace(/^\s+/, '').replace(/\s+$/, '')
  const parts = [before, wrapManaged(input.body), after].filter((part) => part !== '')
  const frontmatter = mergeFrontmatter(frontmatterBody, input.meta)
  return { content: `---\n${frontmatter}\n---\n\n${parts.join('\n\n')}\n`, mode: 'block' }
}

/* ──────────── names & hashes ──────────── */

/** Characters that are illegal in a Windows filename or break Obsidian links. */
const ILLEGAL_NAME = /[\\/:*?"<>|#^[\]{}]/g

/**
 * Drop control characters (and DEL).
 *
 * Written as a code-point filter rather than a regex range: a `\u0000-\u001f`
 * class reads as an invisible trap in review, and the linter rightly flags it.
 */
function stripControlChars(value: string): string {
  let out = ''
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code < 32 || code === 127) continue
    out += char
  }
  return out
}

/**
 * Turn a card title into a filename.
 *
 * CJK is kept (NTFS and Obsidian both handle it, and it is what makes
 * `[[概念名]]` work); only characters that would break a filename or a wikilink
 * are stripped. Collisions get a numeric suffix instead of silently overwriting.
 */
export function sanitizeNoteName(title: string, taken: Set<string> = new Set()): string {
  const base = stripControlChars(String(title ?? ''))
    .replace(ILLEGAL_NAME, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
    .trim() || 'Untitled'

  let name = base
  let counter = 2
  while (taken.has(name.toLowerCase())) {
    name = `${base}-${counter}`
    counter += 1
  }
  taken.add(name.toLowerCase())
  return name
}

/** Content hash used as the "we wrote exactly this" baseline. */
export function computeHash(content: string): string {
  return createHash('sha1').update(String(content ?? ''), 'utf8').digest('hex')
}

/**
 * Content with the Fieldguide timestamp line removed.
 *
 * `fieldguide-updated` changes on every run, so comparing raw content would make
 * every sync rewrite every note — the opposite of an incremental sync. Stripping
 * it gives "did anything the reader would notice actually change?".
 */
export function withoutUpdatedStamp(content: string): string {
  return String(content ?? '').replace(/^fieldguide-updated:.*\r?\n?/m, '')
}

/** Vault-relative posix path for a note. */
export function notePath(folderRel: string, subfolder: string, fileName: string): string {
  const segments = [folderRel, subfolder].filter((part) => part && part !== '.')
  return [...segments, `${fileName}.md`].join('/').replace(/\/{2,}/g, '/')
}

/** Escape a title for use inside `[[…]]`. */
export function wikilink(title: string, alias?: string): string {
  const target = String(title).replace(/[[\]|]/g, '').trim()
  return alias ? `[[${target}|${alias}]]` : `[[${target}]]`
}

/** Which subfolder a note kind lives in ('' = project root). */
export function subfolderForKind(kind: VaultNoteKind): string {
  switch (kind) {
    case 'index': return ''
    case 'report': return ''
    case 'note': return 'notes'
    default: return 'cards'
  }
}
