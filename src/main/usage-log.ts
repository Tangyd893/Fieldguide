/**
 * Local learning-behaviour log (RQ4 data source).
 *
 * Why this exists: the user-study protocol asks whether the learning loop
 * (progress marks, notes, spaced repetition, coach citations) is actually *used*
 * — and that question cannot be answered from the database alone, because most of
 * the answers live in the UI (panel switches, reference-chip clicks). Without a
 * log the study would have to rely on observation notes.
 *
 * Privacy rules, enforced in code rather than promised in prose:
 *
 *   1. **Off by default.** Nothing is written until the reader turns it on.
 *   2. **No free text.** Events carry an event name, a project id, an optional
 *      node/file identifier and a numeric value — never note bodies, never the
 *      questions asked. `sanitizeEvent` drops anything else.
 *   3. **Local only.** One JSONL file per day under the app data directory; there
 *      is no network code in this module and no upload path anywhere in the app.
 *   4. **Reader-exportable, reader-readable.** `usage:summary` aggregates in place,
 *      `usage:export` writes a CSV/Markdown file the reader chooses to keep.
 *
 * The unit tests assert rules 1–2 against hostile payloads (extra fields, long
 * strings), because "we only log counts" is exactly the kind of claim that rots.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir, loadConfig } from './config'

/**
 * Events the UI may report.
 *
 * Deliberately a closed set: an open `string` would let a future call site leak
 * whatever it happened to have in hand.
 */
export const USAGE_EVENTS = [
  'panel_opened',
  'node_opened',
  'file_opened',
  'note_added',
  'progress_marked',
  'review_graded',
  'coach_asked',
  'citation_clicked',
  'tour_step',
  'export_created',
] as const

export type UsageEventName = (typeof USAGE_EVENTS)[number]

export interface UsageEvent {
  /** ISO timestamp. */
  at: string
  /** Event name from the closed set above. */
  event: UsageEventName
  /** Project the event belongs to ('' when not project-scoped). */
  project: string
  /** Node id or project-relative file path — an identifier, never content. */
  target?: string
  /** Numeric payload (e.g. review rating, step index, elapsed seconds). */
  value?: number
}

/** Fields an event may carry. Anything else is dropped by `sanitizeEvent`. */
const ALLOWED_FIELDS = new Set(['at', 'event', 'project', 'target', 'value'])

/** Longest identifier we will persist (node ids and paths are short; payloads are not). */
const MAX_TARGET_CHARS = 200

/**
 * Identifier shape for `target`: letters (any script), digits, and the punctuation
 * that appears in node ids and file paths. Whitespace and newlines are rejected,
 * which is what stops a careless call site from parking a sentence there — prose
 * almost always contains a space.
 */
const TARGET_RE = /^[\p{L}\p{N}_./:@#()+[\]-]{1,200}$/u

function isUsageEventName(value: unknown): value is UsageEventName {
  return typeof value === 'string' && (USAGE_EVENTS as readonly string[]).includes(value)
}

/**
 * Drop everything that is not part of the schema.
 *
 * This is the privacy boundary: a caller that passes `{ content: '...' }` or a
 * `target` holding a whole question gets it silently removed, so no future call
 * site can widen what leaves the app by accident.
 */
export function sanitizeEvent(input: unknown): UsageEvent | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  if (!isUsageEventName(raw.event)) return null

  const event: UsageEvent = {
    at: typeof raw.at === 'string' && raw.at ? raw.at : new Date().toISOString(),
    event: raw.event,
    project: typeof raw.project === 'string' ? raw.project.slice(0, 64) : '',
  }
  if (typeof raw.target === 'string' && raw.target.trim()) {
    const candidate = raw.target.trim()
    // Drop rather than truncate: a shortened node id is a *wrong* identifier, and a
    // wrong identifier is worse for analysis than a missing one. The shape check is
    // what stops a careless call site from parking a sentence in this field.
    if (candidate.length <= MAX_TARGET_CHARS && TARGET_RE.test(candidate)) {
      event.target = candidate
    }
  }
  if (typeof raw.value === 'number' && Number.isFinite(raw.value)) {
    event.value = raw.value
  }
  // Assert (not just rely on construction): a future refactor that spreads `raw`
  // into the object would fail here rather than quietly persisting free text.
  for (const key of Object.keys(event)) {
    if (!ALLOWED_FIELDS.has(key)) return null
  }
  return event
}

/** True when the reader has opted in. */
export function usageLoggingEnabled(): boolean {
  try {
    return loadConfig().usage?.enabled === true
  } catch {
    return false
  }
}

function usageDir(): string {
  const dir = join(dataDir(), 'usage')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function fileFor(date: Date): string {
  return join(usageDir(), `usage-${date.toISOString().slice(0, 10)}.jsonl`)
}

/**
 * Append one event (no-op while logging is off).
 *
 * Never throws: instrumentation must not be able to break a user action, so a
 * full disk or a permission error is swallowed after a single console warning.
 */
export function recordUsage(input: unknown): void {
  try {
    if (!usageLoggingEnabled()) return
    const event = sanitizeEvent(input)
    if (!event) return
    appendFileSync(fileFor(new Date()), `${JSON.stringify(event)}\n`, 'utf-8')
  } catch (err) {
    console.warn(`[usage] event dropped: ${String(err)}`)
  }
}

export interface UsageSummary {
  /** Aggregated over the requested window. */
  days: number
  enabled: boolean
  totalEvents: number
  /** Count per event name. */
  byEvent: Record<string, number>
  /** Distinct projects seen. */
  projects: number
  /** Distinct nodes/files touched — a proxy for how wide the reading went. */
  distinctTargets: number
  /** Events per day, oldest first. */
  perDay: Array<{ date: string; count: number }>
  /** What the log may and may not contain, echoed so the UI can state it. */
  policy: { freeText: false; offByDefault: true; localOnly: true }
}

/** Read the log for the last `days` days and aggregate it. */
export function summarizeUsage(days = 7): UsageSummary {
  const now = new Date()
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 86_400_000)
    dates.push(day.toISOString().slice(0, 10))
  }

  const byEvent: Record<string, number> = {}
  const projects = new Set<string>()
  const targets = new Set<string>()
  const perDay: Array<{ date: string; count: number }> = []
  let totalEvents = 0

  for (const date of dates) {
    const path = join(dataDir(), 'usage', `usage-${date}.jsonl`)
    let count = 0
    if (existsSync(path)) {
      for (const line of readFileSync(path, 'utf-8').split('\n')) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line) as UsageEvent
          byEvent[event.event] = (byEvent[event.event] ?? 0) + 1
          if (event.project) projects.add(event.project)
          if (event.target) targets.add(event.target)
          count += 1
        } catch { /* a truncated final line is not worth failing the summary */ }
      }
    }
    perDay.push({ date, count })
    totalEvents += count
  }

  return {
    days,
    enabled: usageLoggingEnabled(),
    totalEvents,
    byEvent,
    projects: projects.size,
    distinctTargets: targets.size,
    perDay,
    policy: { freeText: false, offByDefault: true, localOnly: true },
  }
}

/** All usage files (newest first), for export and for "what is on disk?". */
export function usageFiles(): string[] {
  const dir = join(dataDir(), 'usage')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.startsWith('usage-') && f.endsWith('.jsonl'))
    .sort()
    .reverse()
    .map((f) => join(dir, f))
}

/** Markdown export of everything on disk, for the reader to keep or delete. */
export function exportUsageMarkdown(): { content: string; files: number; events: number } {
  const files = usageFiles()
  const lines: string[] = [
    '# Fieldguide 使用日志导出',
    '',
    `> 导出时间：${new Date().toISOString()}`,
    '> 内容：事件名 / 项目 id / 节点或文件标识 / 数值 / 时间戳。**不含笔记正文、不含提问文本、不含源码。**',
    '> 日志默认关闭，仅写入本机 `%APPDATA%/Fieldguide/usage/`，本导出由你主动触发。',
    '',
    `共 ${files.length} 个文件。`,
    '',
    '| 时间 | 事件 | 项目 | 目标 | 数值 |',
    '|------|------|------|------|------|',
  ]
  let events = 0
  for (const path of files) {
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line) as UsageEvent
        lines.push(
          `| ${event.at} | ${event.event} | ${event.project || '—'} | ${event.target ?? '—'} | ${event.value ?? '—'} |`,
        )
        events += 1
      } catch { /* skip malformed line */ }
    }
  }
  lines.push('')
  return { content: lines.join('\n'), files: files.length, events }
}
