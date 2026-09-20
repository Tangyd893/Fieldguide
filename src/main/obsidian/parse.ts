/**
 * Pure parsing & classification for the Obsidian integration.
 *
 * Kept free of `electron` and of any process spawning so the tricky parts — CLI
 * output shapes and vault-path containment — are unit-testable. The exact shape
 * of `obsidian vaults verbose` output is documented only loosely upstream, so
 * every parser here accepts the plausible variants and degrades to "unknown"
 * instead of throwing.
 */
import { basename, isAbsolute, relative, resolve } from 'node:path'
import type { VaultBinding, VaultCliState, VaultInfo } from './types'

export interface CliRunResult {
  ok: boolean
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  /** Spawn-level failure (ENOENT/EACCES), when any. */
  error?: string
}

/* ──────────── version ──────────── */

const VERSION_RE = /\b(\d+\.\d+(?:\.\d+)?)\b/

/** First semver-ish token in the output, or '' when there is none. */
export function parseVersion(text: string): string {
  return VERSION_RE.exec(String(text ?? ''))?.[1] ?? ''
}

/** Obsidian installer the CLI requires (docs: "Requires Obsidian 1.12 installer"). */
const MIN_OBSIDIAN_VERSION = '1.12.7'

/** Compare dotted versions; missing segments count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n) || 0)
  const pb = b.split('.').map((n) => Number(n) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

/* ──────────── probe classification ──────────── */

const APP_NOT_RUNNING_RE = /unable to find obsidian|obsidian is running|make sure obsidian/i
const OLD_INSTALLER_RE = /requires obsidian|update obsidian|installer version|not supported/i

/**
 * Turn one `obsidian version` run into a state.
 *
 * A CLI that answers is by definition usable, so a low reported version is only a
 * *warning* detail rather than a failure — gating on it would lock out working
 * setups.
 */
export function interpretProbe(run: CliRunResult): { state: VaultCliState; version: string; detail: string } {
  const stderr = String(run.stderr ?? '').trim()
  const stdout = String(run.stdout ?? '').trim()
  const detail = (stderr || run.error || '').slice(0, 400)

  if (run.timedOut) {
    return { state: 'error', version: '', detail: detail || 'timed out waiting for the Obsidian CLI' }
  }
  if (run.error && /ENOENT|not recognized|cannot find/i.test(run.error)) {
    return { state: 'cli-missing', version: '', detail }
  }
  if (APP_NOT_RUNNING_RE.test(stderr)) {
    return { state: 'app-not-running', version: '', detail }
  }
  if (run.code !== 0 && OLD_INSTALLER_RE.test(stderr)) {
    return { state: 'unsupported-version', version: parseVersion(stdout), detail }
  }
  if (run.ok && run.code === 0) {
    const version = parseVersion(stdout) || parseVersion(stderr)
    const low = version !== '' && compareVersions(version, MIN_OBSIDIAN_VERSION) < 0
    return {
      state: 'ok',
      version,
      detail: low ? `reported version ${version} is older than ${MIN_OBSIDIAN_VERSION}` : detail,
    }
  }
  return { state: 'error', version: parseVersion(stdout), detail: detail || `exit code ${run.code ?? 'unknown'}` }
}

/* ──────────── vault lists ──────────── */

function vaultFromPath(path: string): VaultInfo {
  const trimmed = path.trim()
  return { name: basename(trimmed) || trimmed, path: trimmed }
}

/** Pull one `path` (and an optional leading `name`) out of a plain-text line. */
function parseVaultLine(line: string): VaultInfo | null {
  const raw = line.trim()
  if (!raw || /^[-=]+$/.test(raw)) return null

  const driveAt = raw.search(/[A-Za-z]:[\\/]/)
  if (driveAt >= 0) {
    const path = raw.slice(driveAt).trim()
    const name = raw.slice(0, driveAt).replace(/[\t|·—-]+$/g, '').trim()
    return { name: name || basename(path) || path, path }
  }
  if (raw.startsWith('/') || raw.startsWith('~')) {
    const path = raw.split(/\s{2,}|\t/)[0].trim()
    return vaultFromPath(path)
  }
  // "Name    relative/path"
  const parts = raw.split(/\t|\s{2,}/).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2 && /[\\/]/.test(parts[parts.length - 1])) {
    const path = parts[parts.length - 1]
    return { name: parts.slice(0, -1).join(' ') || basename(path), path }
  }
  return null
}

/**
 * Parse `obsidian vaults verbose` / `... format=json`.
 *
 * Accepts a JSON array of strings, a JSON array of objects, a wrapper object, or
 * tab/space separated text lines. Returns [] when nothing looks like a vault,
 * which callers treat as "could not enumerate" rather than "no vaults".
 */
export function parseVaultList(stdout: string): VaultInfo[] {
  const text = String(stdout ?? '').trim()
  if (!text) return []

  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const data = JSON.parse(text) as unknown
      const rows: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray((data as { vaults?: unknown[] }).vaults)
          ? (data as { vaults: unknown[] }).vaults
          : []
      const parsed = rows
        .map((row): VaultInfo | null => {
          if (typeof row === 'string') return row ? vaultFromPath(row) : null
          if (row && typeof row === 'object') {
            const obj = row as Record<string, unknown>
            const path = String(obj.path ?? obj.vault ?? obj.dir ?? '').trim()
            if (!path) return null
            const name = String(obj.name ?? obj.id ?? '').trim()
            return { name: name || basename(path) || path, path }
          }
          return null
        })
        .filter((v): v is VaultInfo => Boolean(v))
      if (parsed.length > 0) return dedupeVaults(parsed)
    } catch {
      /* fall through to the text parser */
    }
  }

  return dedupeVaults(text.split(/\r?\n/).map(parseVaultLine).filter((v): v is VaultInfo => Boolean(v)))
}

function dedupeVaults(vaults: VaultInfo[]): VaultInfo[] {
  const seen = new Set<string>()
  const out: VaultInfo[] = []
  for (const vault of vaults) {
    // Obsidian paths are unique per vault; names are not (nested vaults).
    const key = vault.path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(vault)
  }
  return out
}

/* ──────────── path containment & binding ──────────── */

/**
 * True when `child` is inside `parent` (or equal to it).
 *
 * Windows paths are compared case-insensitively: `D:\Vault` and `d:\vault` are
 * the same directory, and a case mismatch must not be read as "outside".
 * Different drives are handled by `relative`, which returns an absolute path and
 * is therefore rejected.
 */
export function isInsidePath(parent: string, child: string, caseInsensitive = process.platform === 'win32'): boolean {
  const norm = (p: string) => {
    const resolved = resolve(p)
    return caseInsensitive ? resolved.toLowerCase() : resolved
  }
  const rel = relative(norm(parent), norm(child))
  if (rel === '') return true
  if (isAbsolute(rel)) return false
  return !rel.startsWith('..') && !rel.split(/[/\\]/).includes('..')
}

/** Same path, ignoring separators and (on Windows) case. */
export function samePath(a: string, b: string, caseInsensitive = process.platform === 'win32'): boolean {
  const norm = (p: string) => {
    const resolved = resolve(p).replace(/[/\\]+$/, '')
    return caseInsensitive ? resolved.toLowerCase() : resolved
  }
  return norm(a) === norm(b)
}

/**
 * Classify a picked directory against Obsidian's vault registry.
 *
 * Nested vaults are legitimate (a vault opened inside another vault's folder), so
 * `nested` is reported with its parent instead of being rejected.
 */
export function classifyVaultPath(
  vaults: VaultInfo[],
  dir: string,
  caseInsensitive = process.platform === 'win32',
): VaultBinding {
  const exact = vaults.find((v) => samePath(v.path, dir, caseInsensitive))
  if (exact) return { path: resolve(dir), name: exact.name, kind: 'registered' }

  const parent = vaults
    .filter((v) => isInsidePath(v.path, dir, caseInsensitive))
    // Most specific vault (deepest path) wins.
    .sort((a, b) => b.path.length - a.path.length)[0]
  if (parent) {
    return { path: resolve(dir), name: basename(resolve(dir)) || dir, kind: 'nested', parentVault: parent }
  }

  return { path: resolve(dir), name: basename(resolve(dir)) || dir, kind: 'unregistered' }
}

/** True when one path is inside the other — i.e. binding them would nest a project and a vault. */
export function pathsOverlap(a: string, b: string, caseInsensitive = process.platform === 'win32'): boolean {
  return isInsidePath(a, b, caseInsensitive) || isInsidePath(b, a, caseInsensitive)
}
