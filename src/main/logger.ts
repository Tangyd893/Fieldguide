/**
 * Simple file logger — writes to `<data dir>/logs/`.
 * Phase 4.5: provides diagnostics for indexing errors and usage stats.
 *
 * Uses `dataDir()` rather than `app.getPath('appData')` so a portable install or an
 * E2E run (`FIELDGUIDE_DATA_DIR`) keeps its logs with the rest of its data — the
 * isolation the harness documents ("config, SQLite, exports and logs") only holds
 * if every writer honours the override.
 */
import { join } from 'node:path'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { dataDir } from './config'

function logDir(): string {
  const dir = join(dataDir(), 'logs')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function logFile(): string {
  const date = new Date().toISOString().slice(0, 10)
  return join(logDir(), `fieldguide-${date}.log`)
}

function format(level: string, message: string, detail?: Record<string, unknown>): string {
  const ts = new Date().toISOString()
  const extra = detail ? ' ' + JSON.stringify(detail) : ''
  return `[${ts}] ${level} ${message}${extra}\n`
}

export function logInfo(message: string, detail?: Record<string, unknown>): void {
  try { appendFileSync(logFile(), format('INFO', message, detail)) } catch { /* best effort */ }
}

export function logError(message: string, detail?: Record<string, unknown>): void {
  try { appendFileSync(logFile(), format('ERROR', message, detail)) } catch { /* best effort */ }
}

export function logIndexStart(projectName: string, fileCount: number, incremental: boolean): void {
  logInfo('index:start', { project: projectName, files: fileCount, incremental })
}

export function logIndexComplete(projectName: string, nodeCount: number, edgeCount: number, durationMs: number): void {
  logInfo('index:complete', { project: projectName, nodes: nodeCount, edges: edgeCount, durationMs })
}

export function logIndexError(projectName: string, error: string): void {
  logError('index:error', { project: projectName, error })
}

export function logChatRequest(projectName: string, messageCount: number, responseLength: number): void {
  logInfo('chat:request', { project: projectName, messages: messageCount, responseChars: responseLength })
}
