/**
 * Reading back what is in the vault.
 *
 * The panel needs per-note drift ("is this still what we wrote?"), and the agent
 * needs the reader's own annotations as context. Both come from the same place:
 * compare the file on disk with the hash recorded when we wrote it.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getProject, listVaultNotes, listProjects } from '../db'
import { loadConfig } from '../config'
import { resolveVaultPath } from '../paths'
import { projectFolderName, projectFolderPath, projectFolderRelative } from './binding'
import { computeHash, splitFrontmatter, splitManaged, userAnnotationText } from './render'
import type { VaultNoteStatus, VaultNoteView } from './types'

/** Vault-relative folder a project owns, e.g. `Fieldguide/pulsegate`. */
export function projectFolderRel(projectId: string): string {
  const project = getProject(projectId)
  if (!project) throw new Error(`project ${projectId} not found`)
  const slugs = listProjects().map((row) => row.slug)
  const folder = projectFolderName(project.slug, project.id, slugs)
  return projectFolderRelative(loadConfig().obsidian.folder, folder)
}

/** Absolute path of the folder a project owns inside the bound vault. */
export function projectFolderAbs(projectId: string): string {
  const project = getProject(projectId)
  if (!project) throw new Error(`project ${projectId} not found`)
  const { vaultPath, folder } = loadConfig().obsidian
  const slugs = listProjects().map((row) => row.slug)
  return projectFolderPath(vaultPath, folder, projectFolderName(project.slug, project.id, slugs))
}

export interface NoteWithContent extends VaultNoteView {
  content: string
  absolutePath: string
}

/** Classify one note relative to what we last wrote. */
export function classifyNote(content: string | null, recordedHash: string): VaultNoteStatus {
  if (content === null) return 'missing'
  if (computeHash(content) === recordedHash) return 'clean'
  const { rest } = splitFrontmatter(content)
  return splitManaged(rest).hasMarkers ? 'user-edited' : 'conflict'
}

export function listProjectNotes(projectId: string): VaultNoteView[] {
  const vaultPath = loadConfig().obsidian.vaultPath
  return listVaultNotes(projectId).map((row) => {
    const abs = safeJoin(vaultPath, row.note_path)
    let content: string | null = null
    if (abs && existsSync(abs)) {
      try {
        content = readFileSync(abs, 'utf-8')
      } catch {
        content = null
      }
    }
    return {
      notePath: row.note_path,
      title: row.title,
      kind: row.kind as VaultNoteView['kind'],
      sourceId: row.source_id,
      status: classifyNote(content, row.content_hash),
      syncedAt: row.synced_at,
      userChars: content ? userAnnotationText(content).length : 0,
    }
  })
}

/** One note's content, for the panel preview and for the agent's read tool. */
export function readProjectNote(projectId: string, notePath: string): NoteWithContent | null {
  const row = listVaultNotes(projectId).find((entry) => entry.note_path === notePath)
  const vaultPath = loadConfig().obsidian.vaultPath
  const abs = safeJoin(vaultPath, notePath)
  if (!abs || !existsSync(abs)) return null
  let content: string
  try {
    content = readFileSync(abs, 'utf-8')
  } catch {
    return null
  }
  return {
    notePath,
    title: row?.title ?? notePath,
    kind: (row?.kind as VaultNoteView['kind']) ?? 'knowledge',
    sourceId: row?.source_id ?? '',
    status: classifyNote(content, row?.content_hash ?? ''),
    syncedAt: row?.synced_at ?? '',
    userChars: userAnnotationText(content).length,
    content,
    absolutePath: abs,
  }
}

/** Text the reader wrote outside the generated block, or '' when there is none. */
export function userAnnotationOf(projectId: string, notePath: string): string {
  const note = readProjectNote(projectId, notePath)
  if (!note) return ''
  return userAnnotationText(note.content)
}

/**
 * Markdown files under a project's vault folder, as vault-relative paths.
 *
 * Needed because the bookkeeping table and the folder can disagree: another
 * install (or a wiped database) may have written cards we have no rows for. A tool
 * that answered "0 cards" in that situation sent the coach looking for a problem
 * that did not exist, so callers report both views.
 */
export function listVaultFiles(projectId: string, limit = 200): string[] {
  const vaultPath = loadConfig().obsidian.vaultPath
  if (!vaultPath) return []
  let folder: string
  try {
    folder = projectFolderAbs(projectId)
  } catch {
    return []
  }
  const rel = projectFolderRel(projectId)
  const out: string[] = []
  const walk = (dir: string, prefix: string): void => {
    if (out.length >= limit) return
    let entries: import('node:fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (out.length >= limit) return
      const child = join(dir, entry.name)
      const childRel = `${prefix}/${entry.name}`
      if (entry.isDirectory()) walk(child, childRel)
      else if (entry.name.toLowerCase().endsWith('.md')) out.push(`${rel}${childRel}`)
    }
  }
  walk(folder, '')
  return out
}

/** Join a vault-relative path, refusing anything that escapes the vault. */
function safeJoin(vaultPath: string, relPath: string): string | null {
  if (!vaultPath) return null
  const check = resolveVaultPath(vaultPath, relPath)
  return check.ok ? check.fullPath! : null
}
