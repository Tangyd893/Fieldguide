/**
 * IPC Router — architecture.md §7
 *
 * Registers all invoke handlers and event emitters.
 * Renderer communicates exclusively through these channels.
 */
import { ipcMain } from 'electron'
import { loadConfig, updateConfig } from '../config'
import {
  listProjects,
  getProject,
  insertProject,
  updateProjectStatus,
  removeProject,
} from '../db'
import { v4 as uuid } from './uuid'
import type { IpcResult } from '../../shared/ipc'
import { ipcOk, ipcErr } from '../../shared/ipc'

/* ──────────── Config ──────────── */

ipcMain.handle('config:get', (): IpcResult<unknown> => {
  try {
    return ipcOk(loadConfig())
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('config:set', (_e, patch: Record<string, unknown>): IpcResult<unknown> => {
  try {
    return ipcOk(updateConfig(patch as never))
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── App ──────────── */

ipcMain.handle('app:version', (): string => {
  return '0.1.0'
})

/* ──────────── Projects ──────────── */

ipcMain.handle('project:list', (): IpcResult<unknown[]> => {
  try {
    return ipcOk(listProjects())
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('project:addLocal', (_e, { path }: { path: string }): IpcResult<unknown> => {
  try {
    if (!path) return ipcErr('SOURCE_UNAVAILABLE', '路径不能为空')
    const id = `local-${uuid()}`
    const name = path.split(/[/\\]/).pop() || path
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-')
    const project = insertProject({
      id,
      name,
      slug,
      source_type: 'local',
      source_uri: path,
      root_path: path,
      status: 'pending',
    })
    return ipcOk(project)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('project:addGit', (_e, { url, branch }: { url: string; branch?: string }): IpcResult<unknown> => {
  try {
    if (!url) return ipcErr('SOURCE_UNAVAILABLE', 'Git URL 不能为空')
    const id = `git-${uuid()}`
    const name = url.split('/').pop()?.replace('.git', '') || url
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-')
    const config = loadConfig()
    const targetPath = `${config.projectsRoot || ''}/${slug}`
    const project = insertProject({
      id,
      name,
      slug,
      source_type: 'git',
      source_uri: `${url}${branch ? `#${branch}` : ''}`,
      root_path: targetPath,
      status: 'pending',
    })
    return ipcOk(project)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('project:remove', (_e, { id }: { id: string }): IpcResult<null> => {
  try {
    removeProject(id)
    return ipcOk(null)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── Graph ──────────── */

ipcMain.handle('graph:get', (_e, { projectId }: { projectId: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) {
    return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)
  }
  return ipcErr('UNKNOWN', 'graph:get 尚未实现（Phase 1.5）')
})

/* ──────────── Index (placeholder — 1.5 fills) ──────────── */

ipcMain.handle('project:index', (_e, { projectId }: { projectId: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)
  updateProjectStatus(projectId, 'indexing')
  // TODO 1.5: trigger UA pipeline, send index:progress events
  return ipcErr('UNKNOWN', '索引功能尚未实现（Phase 1.5）')
})
