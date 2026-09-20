/**
 * Sync orchestration — gather, plan, apply.
 *
 * The CLI is deliberately *not* required here. Writing cards is plain filesystem
 * work, and Obsidian picks the files up from disk; requiring a running app would
 * break the feature for anyone who syncs before opening Obsidian. The CLI is used
 * only where it is the only way to do something: opening a note, searching the
 * vault, checking registration.
 *
 * Every write is "plan first, then apply": the same `planVaultSync` result drives
 * the dry-run preview and the real run, so what the user confirms is what happens.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  getProject,
  listVaultNotes,
  removeVaultNote,
  upsertVaultNote,
  type VaultNoteRow,
} from '../db'
import { loadConfig } from '../config'
import { atomicWriteFileSync } from '../fs-atomic'
import { logError, logInfo } from '../logger'
import { resolveVaultPath } from '../paths'
import type { IpcErrorCode } from '../../shared/ipc'
import { buildProjectNotes, collectCardSources, type CollectOptions } from './cards'
import { openNote, probeCli } from './cli'
import { projectFolderRel } from './read'
import {
  MANAGED_BEGIN,
  computeHash,
  notePath,
  renderNote,
  rerenderNote,
  sanitizeNoteName,
  splitFrontmatter,
  splitManaged,
} from './render'
import { planVaultSync } from './plan'
import { beginSync, endSync, isSyncRunning } from './state'
import type { DiskNote, KnownNote, VaultNoteDoc, VaultSyncReport } from './types'

/** Failures the IPC layer turns into a specific `IpcErrorCode`. */
export class VaultError extends Error {
  constructor(
    readonly code: IpcErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message)
    this.name = 'VaultError'
  }
}

export interface SyncOptions extends CollectOptions {
  projectId: string
  /** Preview only: plan, report, write nothing. */
  dryRun?: boolean
  /** Open the index note in Obsidian afterwards (needs a reachable CLI). */
  openAfter?: boolean
  /** Injected by tests. */
  now?: () => Date
}

/** Reject a sync while another one is running — they plan and write the same files. */
function assertIdle(): void {
  if (isSyncRunning()) {
    throw new VaultError('VAULT_SYNC_IN_PROGRESS', '已有同步任务正在进行中，请稍候', true)
  }
}

function requireVault(): string {
  const { vaultPath } = loadConfig().obsidian
  if (!vaultPath) throw new VaultError('VAULT_NOT_BOUND', '尚未绑定 Obsidian vault')
  if (!existsSync(vaultPath) || !statSync(vaultPath).isDirectory()) {
    throw new VaultError('VAULT_NOT_FOUND', `vault 目录不存在：${vaultPath}`)
  }
  return vaultPath
}

/** Absolute path for a vault-relative note, refusing escapes. */
function absoluteFor(vaultPath: string, relPath: string): string {
  const check = resolveVaultPath(vaultPath, relPath)
  if (!check.ok) throw new VaultError('VAULT_PATH_INVALID', `笔记路径不合法：${relPath}（${check.reason}）`)
  return check.fullPath!
}

function toKnown(rows: VaultNoteRow[]): KnownNote[] {
  return rows.map((row) => ({
    notePath: row.note_path,
    title: row.title,
    kind: row.kind as KnownNote['kind'],
    sourceId: row.source_id,
    contentHash: row.content_hash,
  }))
}

/** Read the files the plan may touch. Missing (or invalid) paths are simply absent. */
function readDisk(vaultPath: string, paths: string[]): DiskNote[] {
  const notes: DiskNote[] = []
  for (const relPath of paths) {
    let abs: string
    try {
      abs = absoluteFor(vaultPath, relPath)
    } catch (err) {
      logError('obsidian:path-rejected', { path: relPath, message: String(err) })
      continue
    }
    if (!existsSync(abs)) continue
    try {
      notes.push({ notePath: relPath, content: readFileSync(abs, 'utf-8') })
    } catch (err) {
      logError('obsidian:read-failed', { path: relPath, message: String(err) })
    }
  }
  return notes
}

export async function syncProject(opts: SyncOptions): Promise<VaultSyncReport> {
  assertIdle()
  const now = opts.now ?? (() => new Date())
  const vaultPath = requireVault()
  const project = getProject(opts.projectId)
  if (!project) throw new VaultError('PROJECT_NOT_FOUND', `项目 ${opts.projectId} 不存在`)

  beginSync()
  let report: VaultSyncReport | null = null
  try {
    const updatedAt = (opts.updatedAt ?? now().toISOString())
    const sources = collectCardSources(opts.projectId, { ...opts, updatedAt })
    const desired = buildProjectNotes(sources)
    const known = listVaultNotes(opts.projectId)

    const touched = new Set<string>([
      ...desired.map((doc) => doc.notePath),
      ...known.map((row) => row.note_path),
    ])
    const disk = readDisk(vaultPath, [...touched])

    const plan = planVaultSync({
      desired,
      known: toKnown(known),
      disk,
      updatedAt,
      project: project.slug,
      projectName: project.name,
    })

    const warnings = [...plan.warnings]
    // A vault path is the user's own directory; say so rather than fail later.
    if (!existsSync(vaultPath)) warnings.push(`vault 目录已不存在：${vaultPath}`)

    report = {
      projectId: opts.projectId,
      projectName: project.name,
      vaultPath,
      folder: projectFolderRel(opts.projectId),
      dryRun: Boolean(opts.dryRun),
      created: plan.summary.created,
      updated: plan.summary.updated,
      unchanged: plan.summary.unchanged,
      removed: plan.summary.removed,
      conflicts: plan.conflicts,
      orphaned: plan.orphaned,
      warnings,
      actions: plan.actions,
      applied: false,
      finishedAt: now().toISOString(),
    }

    if (opts.dryRun) {
      logInfo('obsidian:sync-preview', {
        project: project.name,
        create: report.created,
        update: report.updated,
        conflicts: report.conflicts.length,
      })
      return report
    }

    // ── apply ──
    const syncedAt = now().toISOString()
    for (const write of plan.writes) {
      const abs = absoluteFor(vaultPath, write.notePath)
      mkdirSync(dirname(abs), { recursive: true })
      atomicWriteFileSync(abs, write.content)
      upsertVaultNote({
        project_id: opts.projectId,
        note_path: write.notePath,
        vault_path: vaultPath,
        kind: write.kind,
        source_id: write.sourceId,
        title: write.title,
        content_hash: computeHash(write.content),
        synced_at: syncedAt,
      })
    }

    for (const relPath of plan.deletes) {
      const abs = absoluteFor(vaultPath, relPath)
      const row = known.find((entry) => entry.note_path === relPath)
      try {
        if (existsSync(abs)) rmSync(abs, { force: true })
        if (row) removeVaultNote(row.id)
      } catch (err) {
        report.warnings.push(`无法删除 ${relPath}：${String(err)}`)
      }
    }

    report.applied = true
    report.finishedAt = now().toISOString()
    logInfo('obsidian:sync', {
      project: project.name,
      vault: vaultPath,
      created: report.created,
      updated: report.updated,
      removed: report.removed,
      conflicts: report.conflicts.length,
    })

    if (opts.openAfter) {
      const opened = await openIndexNote(opts.projectId)
      if (!opened) report.warnings.push('未能在 Obsidian 中打开索引笔记（CLI 不可用？）')
    }

    return report
  } finally {
    // Always release the lock — a dry run used to leave it held, which made every
    // later sync fail with "already running".
    endSync()
  }
}

/** Open a project's index note (or the first card) in the running Obsidian. */
async function openIndexNote(projectId: string): Promise<boolean> {
  const { cliPath, vaultName } = loadConfig().obsidian
  const cli = await probeCli({ cliPath })
  if (cli.state !== 'ok' || !cli.cliPath) return false
  const notes = listVaultNotes(projectId)
  const target = notes.find((row) => row.kind === 'index') ?? notes[0]
  if (!target) return false
  const result = await openNote({
    cliPath: cli.cliPath,
    vaultName: vaultName || undefined,
    notePath: target.note_path,
  })
  return result.ok
}

/**
 * Remove the notes Fieldguide generated for a project.
 *
 * Only files still identical to what we wrote are deleted: anything the user has
 * edited stays, because "clean up the generated cards" must not mean "delete my
 * writing".
 */
export async function cleanupProject(projectId: string): Promise<{ removed: number; kept: string[] }> {
  const vaultPath = loadConfig().obsidian.vaultPath
  if (!vaultPath) throw new VaultError('VAULT_NOT_BOUND', '尚未绑定 Obsidian vault')
  const rows = listVaultNotes(projectId)
  const kept: string[] = []
  let removed = 0

  for (const row of rows) {
    const abs = absoluteFor(vaultPath, row.note_path)
    if (!existsSync(abs)) {
      removeVaultNote(row.id)
      continue
    }
    let content = ''
    try {
      content = readFileSync(abs, 'utf-8')
    } catch {
      kept.push(row.note_path)
      continue
    }
    if (computeHash(content) !== row.content_hash) {
      kept.push(row.note_path)
      continue
    }
    try {
      rmSync(abs, { force: true })
      removeVaultNote(row.id)
      removed += 1
    } catch (err) {
      logError('obsidian:cleanup-failed', { path: row.note_path, message: String(err) })
      kept.push(row.note_path)
    }
  }

  logInfo('obsidian:cleanup', { projectId, removed, kept: kept.length })
  return { removed, kept }
}

/** What the panel offers for a conflicted note. */
export type ConflictResolution = 'keep-user' | 'overwrite' | 'save-copy'

/**
 * Resolve one conflicted note.
 *
 * `keep-user` treats the file as the baseline (nothing is written); `overwrite`
 * regenerates it from the current sources; `save-copy` writes the incoming version
 * beside the user's file, so neither version is lost.
 */
export async function resolveNote(
  projectId: string,
  relPath: string,
  action: ConflictResolution,
  opts: CollectOptions = {},
): Promise<{ notePath: string; status: string }> {
  const vaultPath = requireVault()
  const row = listVaultNotes(projectId).find((entry) => entry.note_path === relPath)
  if (!row) throw new VaultError('VAULT_NOT_FOUND', '该笔记不在同步记录中，可能是手动创建的')

  const abs = absoluteFor(vaultPath, relPath)
  if (action === 'keep-user') {
    if (!existsSync(abs)) throw new VaultError('VAULT_NOT_FOUND', '文件已不存在')
    const content = readFileSync(abs, 'utf-8')
    upsertVaultNote({
      project_id: row.project_id,
      note_path: row.note_path,
      vault_path: row.vault_path,
      kind: row.kind,
      source_id: row.source_id,
      title: row.title,
      content_hash: computeHash(content),
      synced_at: new Date().toISOString(),
    })
    logInfo('obsidian:resolve', { projectId, path: relPath, action })
    return { notePath: relPath, status: 'user-version-kept' }
  }

  const sources = collectCardSources(projectId, opts)
  const doc = buildProjectNotes(sources).find((entry) => entry.notePath === relPath)
  if (!doc) throw new VaultError('VAULT_NOT_FOUND', '该笔记的来源已不存在，无法重新生成')

  const meta = {
    kind: doc.kind,
    project: sources.project.slug,
    projectName: sources.project.name,
    source: doc.sourceId,
    nodeIds: doc.nodeIds,
    updated: new Date().toISOString(),
    aliases: [doc.title],
  }

  if (action === 'save-copy') {
    const dir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : ''
    const base = relPath.slice(relPath.lastIndexOf('/') + 1).replace(/\.md$/, '')
    const copyRel = notePath(dir, '', sanitizeNoteName(`${base} (Fieldguide 版本)`))
    const copyAbs = absoluteFor(vaultPath, copyRel)
    mkdirSync(dirname(copyAbs), { recursive: true })
    const content = existsSync(copyAbs)
      ? rerenderNote({ meta, body: doc.body, existing: readFileSync(copyAbs, 'utf-8') }).content
      : renderNote({ meta, body: doc.body })
    atomicWriteFileSync(copyAbs, content)
    upsertVaultNote({
      project_id: projectId,
      note_path: copyRel,
      vault_path: vaultPath,
      kind: doc.kind,
      source_id: doc.sourceId,
      title: `${doc.title} (Fieldguide 版本)`,
      content_hash: computeHash(content),
      synced_at: new Date().toISOString(),
    })
    logInfo('obsidian:resolve', { projectId, path: relPath, action, copy: copyRel })
    return { notePath: copyRel, status: 'saved-as-copy' }
  }

  const existing = existsSync(abs) ? readFileSync(abs, 'utf-8') : undefined
  const content = existing
    ? rerenderNote({ meta, body: doc.body, existing }).content
    : renderNote({ meta, body: doc.body })
  mkdirSync(dirname(abs), { recursive: true })
  atomicWriteFileSync(abs, content)
  upsertVaultNote({
    project_id: row.project_id,
    note_path: row.note_path,
    vault_path: row.vault_path,
    kind: row.kind,
    source_id: row.source_id,
    title: row.title,
    content_hash: computeHash(content),
    synced_at: new Date().toISOString(),
  })
  logInfo('obsidian:resolve', { projectId, path: relPath, action })
  return { notePath: relPath, status: 'overwritten' }
}

/**
 * Write (or update) a single card on behalf of the coaching agent.
 *
 * Deliberately narrow: the path is forced inside the project's own folder, an
 * existing file must already belong to this project, and size is bounded. The
 * agent may organise cards, never roam the vault.
 */
export async function upsertAgentCard(input: {
  projectId: string
  title: string
  body: string
  kind?: VaultNoteDoc['kind']
  path?: string
  sourceId?: string
  nodeIds?: string[]
}): Promise<{ notePath: string; created: boolean }> {
  assertIdle()
  const config = loadConfig()
  if (!config.obsidian.agentWrite) {
    throw new VaultError('VAULT_WRITE_CONFLICT', '设置中已关闭「允许 Agent 写入卡片」')
  }
  const vaultPath = requireVault()
  const project = getProject(input.projectId)
  if (!project) throw new VaultError('PROJECT_NOT_FOUND', `项目 ${input.projectId} 不存在`)

  const folderRel = projectFolderRel(input.projectId)
  const title = String(input.title ?? '').trim()
  if (!title) throw new VaultError('VAULT_PATH_INVALID', '卡片标题不能为空')
  const body = String(input.body ?? '').trim()
  if (!body) throw new VaultError('VAULT_PATH_INVALID', '卡片内容不能为空')
  if (body.length > 64 * 1024) throw new VaultError('VAULT_PATH_INVALID', '卡片内容过长（上限 64KB）')

  const kind = input.kind ?? 'knowledge'
  const relPath = input.path
    ? notePath(folderRel, '', sanitizeNoteName(String(input.path).replace(/\.md$/, '')))
    : notePath(folderRel, 'cards', sanitizeNoteName(title))

  // The agent may only touch notes inside this project's folder.
  if (!relPath.startsWith(`${folderRel}/`) && relPath !== folderRel) {
    throw new VaultError('VAULT_PATH_INVALID', '只允许在本项目的 vault 子目录内写入')
  }

  const abs = absoluteFor(vaultPath, relPath)
  const existing = existsSync(abs) ? readFileSync(abs, 'utf-8') : undefined
  if (existing !== undefined) {
    const { body: frontmatter } = splitFrontmatter(existing)
    const owner = /^fieldguide-project\s*:\s*(.+)$/m.exec(frontmatter)?.[1]?.replace(/["']/g, '').trim()
    if (owner && owner !== project.slug) {
      throw new VaultError('VAULT_WRITE_CONFLICT', `该笔记属于项目 ${owner}，已拒绝写入`)
    }
    if (!owner && !splitManaged(splitFrontmatter(existing).rest).hasMarkers && !existing.includes(MANAGED_BEGIN)) {
      throw new VaultError('VAULT_WRITE_CONFLICT', '该文件没有 Fieldguide 标记，可能是你自己的笔记，已拒绝写入')
    }
  }

  const meta = {
    kind,
    project: project.slug,
    projectName: project.name,
    source: input.sourceId ?? `agent-${Date.now()}`,
    nodeIds: input.nodeIds ?? [],
    updated: new Date().toISOString(),
    aliases: [title],
  }
  const content = existing !== undefined
    ? rerenderNote({ meta, body, existing }).content
    : renderNote({ meta, body })

  mkdirSync(dirname(abs), { recursive: true })
  atomicWriteFileSync(abs, content)
  upsertVaultNote({
    project_id: input.projectId,
    note_path: relPath,
    vault_path: vaultPath,
    kind,
    source_id: meta.source,
    title,
    content_hash: computeHash(content),
    synced_at: new Date().toISOString(),
  })
  logInfo('obsidian:agent-card', { projectId: input.projectId, path: relPath, created: existing === undefined })
  return { notePath: relPath, created: existing === undefined }
}
