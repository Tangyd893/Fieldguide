/**
 * Project-wide content search ("find in files").
 *
 * The renderer can only reach the filesystem through main, and the file tree IPC
 * returns names only — so "where is this string?" had no answer. This walks the
 * project with the same ignore rules the indexer uses, caps the work, and returns
 * matches with their line numbers so results can be opened directly.
 *
 * Deliberately simple (substring, case-insensitive) and bounded: it is an
 * interactive search, not a code index.
 */
import { readFileSync, statSync, readdirSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { BINARY_EXTS, IGNORE_DIRS, getProjectIgnoreFilter } from './project-ignore'

export interface ContentMatch {
  path: string
  line: number
  text: string
}

export interface ContentSearchResult {
  query: string
  matches: ContentMatch[]
  filesScanned: number
  filesWithMatches: number
  truncated: boolean
}

export interface ContentSearchOptions {
  maxMatches?: number
  maxFiles?: number
  /** Skip files larger than this (default 1 MB). */
  maxFileBytes?: number
  caseSensitive?: boolean
}

const DEFAULT_MAX_MATCHES = 200
const DEFAULT_MAX_FILES = 400
const DEFAULT_MAX_BYTES = 1_000_000
const MAX_LINE_CHARS = 240
/** Depth cap for the walk — deep enough for real repos, bounded for safety. */
const WALK_MAX_DEPTH = 12

/**
 * Collect project-relative paths with the same ignore rules as the indexer.
 *
 * Walks the filesystem directly instead of using `file:tree`: the tree IPC caps
 * at depth 8 / 2000 nodes for UI responsiveness, which would silently hide
 * matches in large repositories.
 */
function collectFiles(
  rootPath: string,
  ignoreFilter: { ignores: (p: string) => boolean },
  limit: number,
): string[] {
  const out: string[] = []

  const walk = (dir: string, depth: number) => {
    if (out.length >= limit || depth > WALK_MAX_DEPTH) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      if (out.length >= limit) return
      if (entry.startsWith('.') || IGNORE_DIRS.has(entry)) continue

      const full = join(dir, entry)
      const rel = relative(rootPath, full).replace(/\\/g, '/')
      if (ignoreFilter.ignores(rel)) continue

      let st: ReturnType<typeof statSync>
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        walk(full, depth + 1)
      } else if (st.isFile()) {
        if (BINARY_EXTS.has(extname(entry).toLowerCase())) continue
        out.push(rel)
      }
    }
  }

  walk(rootPath, 0)
  return out
}

export async function searchProjectContent(
  rootPath: string,
  query: string,
  opts: ContentSearchOptions = {},
): Promise<ContentSearchResult> {
  const needle = String(query ?? '')
  if (needle.trim().length === 0) {
    return { query: needle, matches: [], filesScanned: 0, filesWithMatches: 0, truncated: false }
  }

  const maxMatches = opts.maxMatches ?? DEFAULT_MAX_MATCHES
  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES
  const maxBytes = opts.maxFileBytes ?? DEFAULT_MAX_BYTES
  const haystackNeedle = opts.caseSensitive ? needle : needle.toLowerCase()

  const ignoreFilter = await getProjectIgnoreFilter(rootPath)
  const files = collectFiles(rootPath, ignoreFilter, maxFiles * 4)

  const matches: ContentMatch[] = []
  let filesScanned = 0
  const filesHit = new Set<string>()
  let truncated = false

  for (const relPath of files) {
    if (filesScanned >= maxFiles || matches.length >= maxMatches) {
      truncated = true
      break
    }

    let size = 0
    try {
      size = statSync(join(rootPath, relPath)).size
    } catch {
      continue
    }
    if (size === 0 || size > maxBytes) continue

    let content: string
    try {
      content = readFileSync(join(rootPath, relPath), 'utf-8')
    } catch {
      continue
    }
    // Cheap binary guard: NUL byte means it is not text.
    if (content.includes('\u0000')) continue

    filesScanned += 1
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const haystack = opts.caseSensitive ? line : line.toLowerCase()
      if (!haystack.includes(haystackNeedle)) continue

      matches.push({
        path: relPath,
        line: i + 1,
        text: line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS)}…` : line.trim(),
      })
      filesHit.add(relPath)
      if (matches.length >= maxMatches) {
        truncated = true
        break
      }
    }
  }

  return {
    query: needle,
    matches,
    filesScanned,
    filesWithMatches: filesHit.size,
    truncated,
  }
}
