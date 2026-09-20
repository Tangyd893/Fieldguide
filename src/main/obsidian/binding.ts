/**
 * Vault binding — validation, classification, and directory scaffolding.
 *
 * Binding writes into a directory the user owns, so the rules are enforced before
 * anything is persisted: a vault must exist, must be a directory, and must not
 * overlap a project root (nesting one inside the other would make the indexer walk
 * the vault, or the vault walk the repo). The pure checks take their inputs as
 * arguments so they can be unit-tested without touching config, SQLite or disk.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { classifyVaultPath, isInsidePath, pathsOverlap } from './parse'
import type { VaultBinding, VaultInfo } from './types'

export interface ValidationResult {
  ok: boolean
  /** Machine-greppable reason; the UI localises from it, never from prose. */
  reason?: 'missing' | 'not-a-directory' | 'overlaps-project' | 'empty'
}

/**
 * Check a directory the user picked as a vault root.
 *
 * `projectRoots` are the registered repositories: a vault inside a project (or a
 * project inside a vault) is rejected rather than silently mis-indexed later.
 */
export function validateVaultDirectory(dir: string, projectRoots: string[] = []): ValidationResult {
  const value = String(dir ?? '').trim()
  if (!value) return { ok: false, reason: 'empty' }
  if (!existsSync(value)) return { ok: false, reason: 'missing' }
  try {
    if (!statSync(value).isDirectory()) return { ok: false, reason: 'not-a-directory' }
  } catch {
    return { ok: false, reason: 'missing' }
  }
  for (const root of projectRoots) {
    if (root && pathsOverlap(root, value)) return { ok: false, reason: 'overlaps-project' }
  }
  return { ok: true }
}

/** The project subfolder name inside the vault; ASCII-safe and deterministic. */
export function projectFolderName(slug: string, projectId: string, allSlugs: string[]): string {
  const base = (slug || projectId).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || projectId
  const collides = allSlugs.filter((s) => s === slug).length > 1
  // Two projects can share a slug (same repo cloned twice); the id suffix keeps
  // their folders distinct *and* stable across syncs.
  return collides ? `${base}-${projectId.slice(-6)}` : base
}

/** Absolute path of the folder this project owns inside the vault. */
export function projectFolderPath(vaultPath: string, folder: string, projectFolder: string): string {
  return join(vaultPath, ...folder.split('/').filter(Boolean), projectFolder)
}

/** Vault-relative posix path of the project folder, as the CLI expects it. */
export function projectFolderRelative(folder: string, projectFolder: string): string {
  return [...folder.split('/').filter(Boolean), projectFolder].join('/')
}

export interface ScaffoldResult {
  path: string
  created: boolean
}

const ILLEGAL_NAME_CHARS = /[\\/:*?"<>|\0]/

/**
 * Create a new vault directory.
 *
 * Only the folder and an empty `.obsidian/` are created: Obsidian treats a folder
 * with that marker as a vault, and everything else (workspace, plugins, cache) is
 * the app's business. The user still confirms it in Obsidian's vault manager —
 * Fieldguide never writes Obsidian's own configuration.
 */
export function createVaultDirectory(parentDir: string, name: string): ScaffoldResult {
  const cleanParent = String(parentDir ?? '').trim()
  const cleanName = String(name ?? '').trim()
  if (!cleanParent) throw new Error('empty parent directory')
  if (!cleanName || cleanName === '.' || cleanName === '..' || ILLEGAL_NAME_CHARS.test(cleanName)) {
    throw new Error('invalid vault name')
  }
  const target = resolve(join(cleanParent, cleanName))
  if (!isInsidePath(cleanParent, target) || !existsSync(cleanParent)) {
    throw new Error('invalid vault directory')
  }
  if (existsSync(target)) {
    if (!statSync(target).isDirectory()) throw new Error('target exists and is not a directory')
    return { path: target, created: false }
  }
  mkdirSync(target, { recursive: true })
  mkdirSync(join(target, '.obsidian'), { recursive: true })
  // A tiny readme gives the folder a purpose when the user opens it before the
  // first sync, and doubles as a smoke test that the directory is writable.
  try {
    writeFileSync(
      join(target, 'README.md'),
      '# Fieldguide vault\n\nThis vault is maintained by Fieldguide. Generated cards live under the configured Fieldguide folder.\n',
      'utf-8',
    )
  } catch {
    /* non-fatal: the vault still works without it */
  }
  return { path: target, created: true }
}

/** Display name for a binding whose vault name is unknown. */
export function fallbackVaultName(path: string): string {
  return basename(resolve(path)) || path
}

/**
 * Classify the stored binding against Obsidian's vault registry.
 *
 * `kind` is only meaningful when the CLI answered — without a vault list we cannot
 * know whether Obsidian has this folder open as a vault, so an empty list yields
 * `unregistered` and the caller renders the CLI state as the explanation.
 */
export function classifyBinding(bindingPath: string, bindingName: string, vaults: VaultInfo[]): VaultBinding {
  const named = (binding: VaultBinding): VaultBinding => ({
    ...binding,
    name: bindingName || binding.name || fallbackVaultName(bindingPath),
  })
  if (vaults.length === 0) {
    return named({ path: bindingPath, name: '', kind: 'unregistered' })
  }
  return named(classifyVaultPath(vaults, bindingPath))
}
