/**
 * Atomic file writes.
 *
 * Every graph/overlay/config write used to be a bare `writeFileSync`, which
 * truncates the target first: a crash, a power loss or a concurrent read during
 * the write leaves a half-written JSON file that later loads as corrupt. Writing
 * to a sibling temp file and renaming makes the swap atomic on both NTFS and
 * POSIX (rename replaces the destination in one step).
 *
 * All writes in this module are synchronous on purpose: they run in the Electron
 * main process on small files, and callers rely on the file being durable when
 * the call returns.
 */
import { writeFileSync, renameSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'

/** Write `content` to `path` atomically (temp file + rename). */
export function atomicWriteFileSync(path: string, content: string | Buffer): void {
  const dir = dirname(path)
  const tmp = join(dir, `.${basename(path)}.${process.pid}.${Date.now()}.tmp`)
  try {
    writeFileSync(tmp, content)
    renameSync(tmp, path)
  } catch (err) {
    // Never leave the temp file behind on failure.
    try { rmSync(tmp, { force: true }) } catch { /* best effort */ }
    throw err
  }
}

/** Serialize `value` as pretty JSON and write it atomically. */
export function atomicWriteJson(path: string, value: unknown): void {
  atomicWriteFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

/** Read and parse JSON, returning null instead of throwing. */
export function readJsonSafe<T = unknown>(path: string): T | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

/** True when the file exists and contains parseable JSON. */
export function isJsonReadable(path: string): boolean {
  if (!existsSync(path)) return false
  try {
    JSON.parse(readFileSync(path, 'utf-8'))
    return true
  } catch {
    return false
  }
}
