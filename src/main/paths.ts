/**
 * Path safety for IPC handlers.
 *
 * `ua/file-content.ts` already validated paths for the graph source endpoint, but
 * `file:read`, `graph:getSource`'s path branch and the shell handlers joined
 * renderer-supplied strings onto the project root without any bounds check: a
 * crafted `../../..` escaped the project, and `shell:openFile` accepted **any**
 * absolute path (so a compromised renderer could launch a local executable).
 *
 * Everything that turns renderer input into a filesystem path goes through here.
 */
import { join, resolve, relative, isAbsolute, normalize, sep } from 'node:path'
import { existsSync } from 'node:fs'
import { app } from 'electron'
import { loadConfig } from './config'
import { listProjects } from './db'

/** True when `child` is inside `parent` (or equal to it). */
export function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  if (rel === '') return true
  return !rel.startsWith('..') && !isAbsolute(rel)
}

export interface PathCheckResult {
  ok: boolean
  /** Absolute path when ok. */
  fullPath?: string
  reason?: string
}

/**
 * Resolve a project-relative path, refusing anything that escapes the root.
 *
 * Rejects absolute inputs outright (a project-relative API should never accept
 * them), `..` traversal, and NUL bytes.
 */
export function resolveProjectPath(projectRoot: string, userPath: string): PathCheckResult {
  if (typeof userPath !== 'string' || userPath.length === 0) {
    return { ok: false, reason: 'empty path' }
  }
  if (userPath.includes('\0')) {
    return { ok: false, reason: 'invalid path' }
  }
  if (isAbsolute(userPath)) {
    return { ok: false, reason: 'absolute paths are not allowed' }
  }

  const normalized = normalize(userPath).replace(/^([/\\])+/, '')
  if (normalized === '..' || normalized.startsWith(`..${sep}`) || normalized.split(/[/\\]/).includes('..')) {
    return { ok: false, reason: 'path escapes the project root' }
  }

  const fullPath = join(projectRoot, normalized)
  if (!isInside(projectRoot, fullPath)) {
    return { ok: false, reason: 'path escapes the project root' }
  }
  return { ok: true, fullPath }
}

/**
 * Resolve a vault-relative path, refusing anything that escapes the vault.
 *
 * Same contract as `resolveProjectPath`: the renderer and the agent hand us note
 * paths, and a vault is somebody else's directory — a note path must never be a
 * way to write outside it.
 */
export function resolveVaultPath(vaultPath: string, userPath: string): PathCheckResult {
  if (typeof vaultPath !== 'string' || vaultPath.length === 0) {
    return { ok: false, reason: 'no vault bound' }
  }
  if (typeof userPath !== 'string' || userPath.length === 0) {
    return { ok: false, reason: 'empty path' }
  }
  if (userPath.includes('\0')) {
    return { ok: false, reason: 'invalid path' }
  }
  if (isAbsolute(userPath)) {
    return { ok: false, reason: 'absolute paths are not allowed' }
  }

  const normalized = normalize(userPath).replace(/^([/\\])+/, '')
  if (normalized === '..' || normalized.startsWith(`..${sep}`) || normalized.split(/[/\\]/).includes('..')) {
    return { ok: false, reason: 'path escapes the vault' }
  }

  const fullPath = join(vaultPath, normalized)
  if (!isInside(vaultPath, fullPath)) {
    return { ok: false, reason: 'path escapes the vault' }
  }
  return { ok: true, fullPath }
}

/**
 * Roots that the shell is allowed to hand to the OS.
 *
 * `shell.openFile` opens an arbitrary path with the system default handler, so
 * it is limited to places this app owns: its own data directory, the configured
 * projects root, every registered project root, and the bound Obsidian vault
 * (notes the user asked us to manage, and may want to open in their editor).
 */
export function allowedOpenRoots(): string[] {
  const roots: string[] = []
  try {
    roots.push(join(app.getPath('appData'), 'Fieldguide'))
  } catch { /* app not ready */ }
  try {
    const { projectsRoot, obsidian } = loadConfig()
    if (projectsRoot) roots.push(projectsRoot)
    if (obsidian?.vaultPath) roots.push(obsidian.vaultPath)
  } catch { /* config unavailable */ }
  try {
    for (const project of listProjects()) {
      if (project.root_path) roots.push(project.root_path)
    }
  } catch { /* db unavailable */ }
  return roots.filter(Boolean)
}

/** True when an absolute path may be opened externally. */
export function isAllowedOpenPath(userPath: string): boolean {
  if (typeof userPath !== 'string' || !userPath || userPath.includes('\0')) return false
  if (!isAbsolute(userPath)) return false
  const resolved = resolve(userPath)
  if (!existsSync(resolved)) return false
  return allowedOpenRoots().some((root) => isInside(root, resolved))
}
