/**
 * IPC Router — architecture.md §7
 *
 * Registers all invoke handlers and event emitters.
 * Renderer communicates exclusively through these channels.
 */
import { ipcMain, BrowserWindow } from 'electron'
import { join, existsSync, readFileSync } from 'node:path'
import { loadConfig, updateConfig } from '../config'
import {
  listProjects,
  getProject,
  insertProject,
  updateProjectStatus,
  removeProject,
} from '../db'
import { cloneRepo } from '../git'
import { indexProject } from '../ua/client'
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

ipcMain.handle('project:addGit', async (_e, { url, branch }: { url: string; branch?: string }): Promise<IpcResult<unknown>> => {
  try {
    if (!url) return ipcErr('SOURCE_UNAVAILABLE', 'Git URL 不能为空')
    const id = `git-${uuid()}`
    const name = url.split('/').pop()?.replace('.git', '') || url
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-')
    const config = loadConfig()
    
    if (!config.projectsRoot) {
      return ipcErr('SOURCE_UNAVAILABLE', '请先在设置中配置项目根目录（projectsRoot）')
    }

    const targetPath = join(config.projectsRoot, slug)
    const cloneResult = await cloneRepo(url, targetPath, branch)
    
    if (!cloneResult.success) {
      return ipcErr('GIT_CLONE_FAILED', cloneResult.error ?? '克隆失败', true)
    }

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
  const graphPath = join(project.root_path, '.understand-anything', 'knowledge-graph.json')
  if (!existsSync(graphPath)) {
    return ipcErr('UNKNOWN', '图谱尚未生成，请先索引该项目')
  }
  try {
    const data = JSON.parse(readFileSync(graphPath, 'utf-8'))
    return ipcOk(data)
  } catch (err) {
    return ipcErr('PARSE_ERROR', `读取图谱失败: ${String(err)}`)
  }
})

/* ──────────── Index ──────────── */

ipcMain.handle('project:index', async (_e, { projectId }: { projectId: string }): Promise<IpcResult<unknown>> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)
  if (project.status === 'indexing') return ipcErr('INDEX_IN_PROGRESS', '索引正在进行中', true)

  // Start indexing
  updateProjectStatus(projectId, 'indexing')
  const win = BrowserWindow.getAllWindows()[0]

  try {
    const result = await indexProject(
      project.root_path,
      project.name,
      (phase) => {
        win?.webContents.send('index:progress', { type: 'phase', phase, projectId })
      },
      (current, total) => {
        win?.webContents.send('index:progress', {
          type: 'progress',
          phase: 'parse',
          current,
          total,
          projectId,
        })
      },
    )

    if (result.success) {
      updateProjectStatus(projectId, 'ready', result.nodeCount)
      win?.webContents.send('index:progress', {
        type: 'complete',
        projectId,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
      })
      return ipcOk({ nodeCount: result.nodeCount, edgeCount: result.edgeCount })
    } else {
      updateProjectStatus(projectId, 'failed')
      win?.webContents.send('index:progress', { type: 'error', projectId, error: result.error })
      return ipcErr('UNKNOWN', result.error ?? '索引失败')
    }
  } catch (err) {
    updateProjectStatus(projectId, 'failed')
    const msg = err instanceof Error ? err.message : String(err)
    win?.webContents.send('index:progress', { type: 'error', projectId, error: msg })
    return ipcErr('UNKNOWN', msg)
  }
})
