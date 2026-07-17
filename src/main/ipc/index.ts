/**
 * IPC Router — architecture.md §7
 *
 * Registers all invoke handlers and event emitters.
 * Renderer communicates exclusively through these channels.
 */
import { ipcMain, BrowserWindow, shell, app, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { loadConfig, updateConfig } from '../config'
import { joinLlmUrl } from '../../shared/llm-url'
import {
  listProjects,
  getProject,
  insertProject,
  updateProjectStatus,
  removeProject,
  listPapers,
  getPaper,
  getPaperByArxivId,
  insertPaper,
  updatePaper,
  removePaper,
  listConceptLinks,
  insertConceptLink,
  removeConceptLink,
  listPaperHighlights,
  insertPaperHighlight,
  removePaperHighlight,
  listChatMessages,
  insertChatMessage,
  clearChatMessages,
} from '../db'
import type { PaperRow } from '../db'
import { readProjectTree } from '../file-tree'
import { getProjectIgnoreFilter } from '../project-ignore'
import { setApplicationMenu, popupTopLevelMenu, getTopLevelMenuLabels, type TopLevelMenuId } from '../menu'
import { cloneRepo } from '../git'
import { installDemoProject } from '../sample-project'
import { indexProject, beginIndex, cancelIndex } from '../ua/client'
import { setDashboardGraph, setDashboardDiffOverlay } from '../ua/dashboard'
import { buildUARuntimeConfig, isLLMConfigured, maskedApiKey } from '../ua/config-bridge'
import { getLlmProviderCatalog, fetchProviderModels } from '../llm/catalog'
import {
  loadGraph,
  getNode,
  getNeighbors,
  searchNodes,
  getNodeSource,
  getGraphStats,
  isGraphStale,
} from '../ua/graph-reader'
import { indexPaper, queryPaper, countChunks, getChunks, removeChunks, getIndexStats } from '../vector'
import { analyzeProjectDiff } from '../ua/diff'
import { generateCrossTour } from '../ua/cross-tour'
import { runAgent } from '../agent/react'
import { logInfo, logError, logIndexStart, logIndexComplete, logIndexError, logChatRequest } from '../logger'
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
    const prev = loadConfig()
    const next = updateConfig(patch as never)
    if ('locale' in patch && patch.locale !== prev.locale) {
      setApplicationMenu(next.locale)
    }
    return ipcOk(next)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('config:llmStatus', (): IpcResult<unknown> => {
  try {
    return ipcOk({ configured: isLLMConfigured(), maskedKey: maskedApiKey() })
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('config:uaRuntime', (): IpcResult<unknown> => {
  try {
    return ipcOk(buildUARuntimeConfig())
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('config:testLlm', async (): Promise<IpcResult<unknown>> => {
  const config = loadConfig()
  if (!isLLMConfigured()) {
    return ipcErr('LLM_NOT_CONFIGURED', '请先配置 LLM', true)
  }
  const url = joinLlmUrl(config.llm.baseUrl, '/v1/chat/completions')
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.llm.apiKey}` },
      body: JSON.stringify({
        model: config.llm.chatModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return ipcErr('LLM_API_ERROR', `API 返回 ${resp.status}: ${text.slice(0, 200)}`, true)
    }
    return ipcOk({ ok: true })
  } catch (err) {
    return ipcErr('LLM_API_ERROR', `连接失败: ${err instanceof Error ? err.message : String(err)}`, true)
  }
})

ipcMain.handle('llm:listProviders', (): IpcResult<unknown> => {
  try {
    return ipcOk(getLlmProviderCatalog())
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle(
  'llm:fetchModels',
  async (
    _e,
    opts: { providerId?: string; baseUrl?: string; apiKey?: string } = {},
  ): Promise<IpcResult<unknown>> => {
    try {
      const config = loadConfig()
      const result = await fetchProviderModels({
        providerId: opts.providerId,
        baseUrl: opts.baseUrl || config.llm.baseUrl,
        apiKey: opts.apiKey !== undefined ? opts.apiKey : config.llm.apiKey,
      })
      // Always return models (live or builtin fallback) so the UI stays usable
      return ipcOk(result)
    } catch (err) {
      return ipcErr('LLM_API_ERROR', String(err), true)
    }
  },
)

/* ──────────── App ──────────── */

ipcMain.handle('app:version', (): string => {
  try {
    const pkg = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf-8'))
    return pkg.version || '0.2.0'
  } catch {
    return '0.2.0'
  }
})

// Dashboard URL is set by main process after protocol registration
let dashboardUrl = ''

export function setDashboardUrl(url: string): void {
  dashboardUrl = url
}

ipcMain.handle('dashboard:url', (): string => {
  return dashboardUrl
})

ipcMain.handle('dashboard:setProject', (_e, { projectRoot }: { projectRoot: string | null }): void => {
  setDashboardGraph(projectRoot)
})

/* ──────────── Shell ──────────── */

ipcMain.handle('shell:openPath', async (_e, { projectId, filePath }: { projectId: string; filePath: string }): Promise<IpcResult<null>> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', '项目不存在')
  const fullPath = join(project.root_path, filePath)
  const result = await shell.openPath(fullPath)
  if (result) return ipcErr('UNKNOWN', result)
  return ipcOk(null)
})

ipcMain.handle('shell:openFile', async (_e, { filePath }: { filePath: string }): Promise<IpcResult<null>> => {
  try {
    const result = await shell.openPath(filePath)
    if (result) return ipcErr('UNKNOWN', result)
    return ipcOk(null)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('dialog:openFolder', async (): Promise<IpcResult<string | null>> => {
  const { dialog } = await import('electron')
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win) return ipcErr('UNKNOWN', '没有可用窗口')
  try {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择文件夹',
      buttonLabel: '选择',
    })
    if (result.canceled || result.filePaths.length === 0) {
      return ipcOk(null)
    }
    return ipcOk(result.filePaths[0])
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── Window chrome (custom title bar) ──────────── */

function targetWindow(e: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(e.sender) ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

ipcMain.handle('window:minimize', (e): IpcResult<null> => {
  targetWindow(e)?.minimize()
  return ipcOk(null)
})

ipcMain.handle('window:maximize', (e): IpcResult<{ maximized: boolean }> => {
  const win = targetWindow(e)
  if (!win) return ipcOk({ maximized: false })
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
  return ipcOk({ maximized: win.isMaximized() })
})

ipcMain.handle('window:close', (e): IpcResult<null> => {
  targetWindow(e)?.close()
  return ipcOk(null)
})

ipcMain.handle('window:isMaximized', (e): IpcResult<{ maximized: boolean }> => {
  const win = targetWindow(e)
  return ipcOk({ maximized: win?.isMaximized() ?? false })
})

ipcMain.handle('window:platform', (): IpcResult<{ platform: NodeJS.Platform; customTitleBar: boolean }> => {
  return ipcOk({ platform: process.platform, customTitleBar: process.platform === 'win32' })
})

ipcMain.handle(
  'menu:popupTopLevel',
  (e, { id, x, y }: { id: TopLevelMenuId; x: number; y: number }): IpcResult<null> => {
    try {
      // Coordinates from renderer getBoundingClientRect are window-relative;
      // Menu.popup expects window content coordinates.
      popupTopLevelMenu(id, x, y)
      return ipcOk(null)
    } catch (err) {
      return ipcErr('UNKNOWN', String(err))
    }
  },
)

ipcMain.handle('menu:topLevelLabels', (): IpcResult<Record<TopLevelMenuId, string>> => {
  try {
    return ipcOk(getTopLevelMenuLabels(loadConfig().locale))
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── Projects ──────────── */

ipcMain.handle('project:list', (): IpcResult<unknown[]> => {
  try {
    const projects = listProjects()
    // Check staleness for each project using graph-reader
    const enriched = projects.map((p) => {
      if (p.status !== 'ready') return p
      if (isGraphStale(p.root_path)) {
        return { ...p, status: 'stale' as const }
      }
      return p
    })
    return ipcOk(enriched)
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

ipcMain.handle('project:installDemo', (_e, { projectsRoot }: { projectsRoot?: string }): IpcResult<unknown> => {
  try {
    const project = installDemoProject(projectsRoot)
    return ipcOk(project)
  } catch (err) {
    return ipcErr('SOURCE_UNAVAILABLE', String(err))
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
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  const graph = loadGraph(project.root_path)
  if (!graph) return ipcErr('UNKNOWN', '图谱尚未生成，请先索引该项目')

  // Normalize tour: UA Core pipeline produces flat TourStep[], but shell
  // consumers (TourPanel) expect Tour[] with { name, description, steps }.
  // The Dashboard reads the raw file directly via custom protocol and is
  // compatible with TourStep[] — we only normalize for the shell side.
  if (Array.isArray(graph.tour) && graph.tour.length > 0) {
    const first = graph.tour[0]
    // A TourStep has 'order'; a Tour has 'steps'. Only normalize flat arrays.
    if (first && typeof first === 'object' && 'order' in first && !('steps' in first)) {
      graph.tour = [{ name: 'Guided Tour', steps: graph.tour }] as unknown as typeof graph.tour
    }
  }

  return ipcOk(graph)
})

ipcMain.handle('graph:getNode', (_e, { projectId, nodeId }: { projectId: string; nodeId: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  const graph = loadGraph(project.root_path)
  if (!graph) return ipcErr('UNKNOWN', '图谱尚未生成，请先索引该项目')

  const node = getNode(graph, nodeId)
  if (!node) return ipcErr('UNKNOWN', `节点 ${nodeId} 不存在`)

  return ipcOk(node)
})

ipcMain.handle('graph:neighbors', (_e, { projectId, nodeId, depth }: { projectId: string; nodeId: string; depth?: number }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  const graph = loadGraph(project.root_path)
  if (!graph) return ipcErr('UNKNOWN', '图谱尚未生成，请先索引该项目')

  const result = getNeighbors(graph, nodeId, depth ?? 1)
  return ipcOk(result)
})

ipcMain.handle('graph:search', (_e, { projectId, query }: { projectId: string; query: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  const graph = loadGraph(project.root_path)
  if (!graph) return ipcErr('UNKNOWN', '图谱尚未生成，请先索引该项目')

  const nodes = searchNodes(graph, query)
  return ipcOk(nodes)
})

ipcMain.handle('graph:getSource', (_e, { projectId, nodeId, path, lineStart, lineEnd }: {
  projectId: string; nodeId?: string; path?: string; lineStart?: number; lineEnd?: number
}): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  // If path is provided directly, read that file
  if (path) {
    const fullPath = join(project.root_path, path)
    if (!existsSync(fullPath)) return ipcErr('SOURCE_UNAVAILABLE', `文件不存在: ${path}`)
    try {
      const content = readFileSync(fullPath, 'utf-8')
      const lines = content.split('\n')
      const start = Math.max(0, (lineStart ?? 1) - 1)
      const end = Math.min(lines.length, lineEnd ?? lines.length)
      return ipcOk({
        content: lines.slice(start, end).join('\n'),
        lineStart: start + 1,
        lineEnd: end,
        path,
      })
    } catch (err) {
      return ipcErr('PARSE_ERROR', String(err))
    }
  }

  // If nodeId is provided, look up the node and read its source
  if (nodeId) {
    const graph = loadGraph(project.root_path)
    if (!graph) return ipcErr('UNKNOWN', '图谱尚未生成，请先索引该项目')

    const node = getNode(graph, nodeId)
    if (!node) return ipcErr('UNKNOWN', `节点 ${nodeId} 不存在`)

    const source = getNodeSource(project.root_path, node)
    if (!source) return ipcErr('SOURCE_UNAVAILABLE', '无法读取节点源码')

    return ipcOk({ ...source, path: node.filePath })
  }

  return ipcErr('UNKNOWN', '请提供 nodeId 或 path')
})

ipcMain.handle('graph:stats', (_e, { projectId }: { projectId: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  const graph = loadGraph(project.root_path)
  if (!graph) return ipcErr('UNKNOWN', '图谱尚未生成，请先索引该项目')

  return ipcOk(getGraphStats(graph))
})

ipcMain.handle('graph:meta', (_e, { projectId }: { projectId: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  const graph = loadGraph(project.root_path)
  const domainPath = join(project.root_path, '.understand-anything', 'domain-graph.json')
  const hasDomain = existsSync(domainPath)

  return ipcOk({
    hasNodes: (graph?.nodes?.length ?? 0) > 0,
    hasEdges: (graph?.edges?.length ?? 0) > 0,
    hasLayers: (graph?.layers?.length ?? 0) > 0,
    hasTour: Array.isArray(graph?.tour) && graph.tour.length > 0,
    hasDomain,
  })
})

/* ──────────── File Tree & Code ──────────── */

ipcMain.handle('file:tree', async (_e, { projectId }: { projectId: string }): Promise<IpcResult<unknown>> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)
  try {
    const ignoreFilter = await getProjectIgnoreFilter(project.root_path)
    const tree = readProjectTree(project.root_path, { ignoreFilter })
    return ipcOk(tree)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('file:read', (_e, { projectId, filePath }: { projectId: string; filePath: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)
  const fullPath = join(project.root_path, filePath)
  if (!existsSync(fullPath)) return ipcErr('SOURCE_UNAVAILABLE', `文件不存在: ${filePath}`)
  try {
    const content = readFileSync(fullPath, 'utf-8')
    return ipcOk({ path: filePath, content, size: content.length })
  } catch (err) {
    return ipcErr('PARSE_ERROR', String(err))
  }
})

/* ──────────── Chat ──────────── */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

ipcMain.handle('chat:send', async (_e, {
  projectId,
  messages,
  focusedNodeId,
  tourStepIndex,
}: {
  projectId: string
  messages: ChatMessage[]
  focusedNodeId?: string | null
  tourStepIndex?: number | null
}): Promise<IpcResult<unknown>> => {
  const config = loadConfig()

  if (!isLLMConfigured()) {
    return ipcErr('LLM_NOT_CONFIGURED', '请先在设置中配置 LLM API Key', true)
  }

  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  if (lastUser) {
    insertChatMessage({
      project_id: projectId,
      role: 'user',
      content: lastUser.content,
      steps_json: '',
    })
  }

  try {
    const result = await runAgent(
      {
        projectId,
        projectName: project.name,
        projectRoot: project.root_path,
        locale: config.locale,
        focusedNodeId: focusedNodeId ?? null,
        tourStepIndex: tourStepIndex ?? null,
      },
      messages,
    )

    insertChatMessage({
      project_id: projectId,
      role: 'assistant',
      content: result.content,
      steps_json: JSON.stringify(result.steps),
    })

    logChatRequest(project.name, messages.length, result.content.length)
    return ipcOk({
      content: result.content,
      steps: result.steps,
      nodeRefs: result.nodeRefs,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429')) return ipcErr('LLM_RATE_LIMIT', 'API 请求过于频繁，请稍后再试', true)
    return ipcErr('LLM_API_ERROR', `Agent 请求失败: ${msg}`, true)
  }
})

ipcMain.handle('chat:history', (_e, { projectId }: { projectId: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)
  try {
    const rows = listChatMessages(projectId)
    return ipcOk(rows.map(r => ({
      id: r.id,
      role: r.role,
      content: r.content,
      steps: r.steps_json ? JSON.parse(r.steps_json) : [],
      timestamp: r.created_at,
    })))
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('chat:clear', (_e, { projectId }: { projectId: string }): IpcResult<null> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)
  try {
    clearChatMessages(projectId)
    return ipcOk(null)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('project:index', async (_e, { projectId, incremental, skipLlm }: { projectId: string; incremental?: boolean; skipLlm?: boolean }): Promise<IpcResult<unknown>> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)
  if (project.status === 'indexing') return ipcErr('INDEX_IN_PROGRESS', '索引正在进行中', true)

  // Start indexing
  updateProjectStatus(projectId, 'indexing')
  const win = BrowserWindow.getAllWindows()[0]

  try {
    const startTime = Date.now()
    logIndexStart(project.name, 0, !!incremental)

    const config = loadConfig()
    const useLlm = !skipLlm && isLLMConfigured()
    const signal = beginIndex()

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
      incremental,
      useLlm ? {
        baseUrl: config.llm.baseUrl,
        apiKey: config.llm.apiKey,
        chatModel: config.llm.chatModel,
      } : undefined,
      signal,
      config.ua?.language,
    )

    if (result.error === 'INDEX_CANCELLED') {
      updateProjectStatus(projectId, 'pending')
      win?.webContents.send('index:progress', { type: 'cancelled', projectId })
      return ipcErr('INDEX_CANCELLED', '索引已取消', false)
    }

    if (result.success) {
      updateProjectStatus(projectId, 'ready', result.nodeCount)
      logIndexComplete(project.name, result.nodeCount, result.edgeCount, Date.now() - startTime)
      win?.webContents.send('index:progress', {
        type: 'complete',
        projectId,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
      })
      return ipcOk({ nodeCount: result.nodeCount, edgeCount: result.edgeCount })
    } else {
      updateProjectStatus(projectId, 'failed')
      logIndexError(project.name, result.error ?? '未知错误')
      win?.webContents.send('index:progress', { type: 'error', projectId, error: result.error })
      return ipcErr('UNKNOWN', result.error ?? '索引失败')
    }
  } catch (err) {
    updateProjectStatus(projectId, 'failed')
    const msg = err instanceof Error ? err.message : String(err)
    logIndexError(project.name, msg)
    win?.webContents.send('index:progress', { type: 'error', projectId, error: msg })
    return ipcErr('UNKNOWN', msg)
  }
})

ipcMain.handle('project:indexCancel', (_e, { projectId }: { projectId: string }): IpcResult<null> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)
  if (project.status !== 'indexing') {
    return ipcErr('UNKNOWN', '当前没有进行中的索引', false)
  }
  const cancelled = cancelIndex()
  if (!cancelled) return ipcErr('UNKNOWN', '无法取消索引', false)
  return ipcOk(null)
})

ipcMain.handle('project:exportGraph', (_e, { projectId }: { projectId: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  const graphPath = join(project.root_path, '.understand-anything', 'knowledge-graph.json')
  if (!existsSync(graphPath)) return ipcErr('UNKNOWN', '图谱尚未生成，请先索引该项目')

  try {
    const exportsDir = join(app.getPath('appData'), 'Fieldguide', 'exports')
    if (!existsSync(exportsDir)) mkdirSync(exportsDir, { recursive: true })
    const dest = join(exportsDir, `${project.slug}-knowledge-graph.json`)
    copyFileSync(graphPath, dest)
    return ipcOk({ exportPath: dest })
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── Papers ──────────── */

ipcMain.handle('paper:list', (): IpcResult<unknown> => {
  try {
    return ipcOk(listPapers())
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('paper:get', (_e, { id }: { id: string }): IpcResult<unknown> => {
  const p = getPaper(id)
  if (!p) return ipcErr('UNKNOWN', '论文不存在')
  return ipcOk(p)
})

ipcMain.handle('paper:save', (_e, paper: {
  arxiv_id: string; title: string; authors: string; summary: string
  published: string; pdf_path?: string; tags?: string
}): IpcResult<unknown> => {
  try {
    // Deduplicate by arxiv_id
    const existing = getPaperByArxivId(paper.arxiv_id)
    if (existing) return ipcOk(existing)
    const p = insertPaper({
      arxiv_id: paper.arxiv_id,
      title: paper.title,
      authors: paper.authors,
      summary: paper.summary,
      published: paper.published,
      pdf_path: paper.pdf_path || '',
      notes: '',
      tags: paper.tags || '',
    })
    return ipcOk(p)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('paper:update', (_e, { id, patch }: {
  id: string; patch: { notes?: string; tags?: string; pdf_path?: string }
}): IpcResult<unknown> => {
  try {
    const p = updatePaper(id, patch)
    if (!p) return ipcErr('UNKNOWN', '论文不存在')
    return ipcOk(p)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('paper:remove', (_e, { id }: { id: string }): IpcResult<null> => {
  try {
    removePaper(id)
    return ipcOk(null)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('paper:search', (_e, { query }: { query: string }): IpcResult<unknown> => {
  try {
    const papers = listPapers()
    const q = query.toLowerCase()
    const results = papers.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.notes.toLowerCase().includes(q) ||
      p.authors.toLowerCase().includes(q)
    ).slice(0, 10)
    return ipcOk(results)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('paper:downloadPdf', async (_e, { id }: { id: string }): Promise<IpcResult<unknown>> => {
  const paper = getPaper(id)
  if (!paper) return ipcErr('UNKNOWN', '论文不存在')

  // If already downloaded, just return the path
  if (paper.pdf_path && existsSync(paper.pdf_path)) {
    return ipcOk({ pdf_path: paper.pdf_path })
  }

  // Ensure papers directory exists
  const config = loadConfig()
  const papersDir = join(config.projectsRoot || app.getPath('documents'), 'Fieldguide', 'papers')
  if (!existsSync(papersDir)) mkdirSync(papersDir, { recursive: true })

  const pdfPath = join(papersDir, `${paper.arxiv_id}.pdf`)
  const pdfUrl = `https://arxiv.org/pdf/${paper.arxiv_id}.pdf`

  try {
    const resp = await fetch(pdfUrl, { signal: AbortSignal.timeout(60_000) })
    if (!resp.ok) return ipcErr('SOURCE_UNAVAILABLE', `PDF 下载失败 (${resp.status})`, true)
    const buffer = Buffer.from(await resp.arrayBuffer())
    writeFileSync(pdfPath, buffer)
    updatePaper(id, { pdf_path: pdfPath })
    return ipcOk({ pdf_path: pdfPath })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return ipcErr('UNKNOWN', `PDF 下载失败: ${msg}`, true)
  }
})

/* ──────────── Concept Links ──────────── */

ipcMain.handle('concept:list', (_e, { projectId, paperId }: {
  projectId?: string; paperId?: string
}): IpcResult<unknown> => {
  try {
    return ipcOk(listConceptLinks(projectId, paperId))
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('concept:add', (_e, link: {
  paper_id: string; project_id: string; node_id: string
  anchor_text?: string; note?: string
}): IpcResult<unknown> => {
  try {
    const cl = insertConceptLink({
      paper_id: link.paper_id,
      project_id: link.project_id,
      node_id: link.node_id,
      anchor_text: link.anchor_text || '',
      note: link.note || '',
    })
    return ipcOk(cl)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('concept:remove', (_e, { id }: { id: string }): IpcResult<null> => {
  try {
    removeConceptLink(id)
    return ipcOk(null)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── Paper Vector Index ──────────── */

ipcMain.handle('paper:index', async (_e, { id }: { id: string }): Promise<IpcResult<unknown>> => {
  const paper = getPaper(id)
  if (!paper) return ipcErr('UNKNOWN', '论文不存在')

  try {
    const result = await indexPaper(paper)
    return ipcOk(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('API key')) return ipcErr('LLM_NOT_CONFIGURED', '请先在设置中配置 Embedding 模型', true)
    return ipcErr('EMBED_API_ERROR', `论文索引失败: ${msg}`)
  }
})

ipcMain.handle('paper:query', async (_e, {
  query,
  paperId,
  topK,
}: {
  query: string
  paperId?: string
  topK?: number
}): Promise<IpcResult<unknown>> => {
  try {
    const results = await queryPaper(query, paperId, topK ?? 5)
    return ipcOk(results)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('API key')) return ipcErr('LLM_NOT_CONFIGURED', '请先在设置中配置 Embedding 模型', true)
    return ipcErr('EMBED_API_ERROR', `论文查询失败: ${msg}`)
  }
})

ipcMain.handle('paper:indexStatus', (_e, { id }: { id: string }): IpcResult<unknown> => {
  try {
    const stats = getIndexStats()
    const paperChunkCount = countChunks(id)
    return ipcOk({ paperId: id, chunkCount: paperChunkCount, totalStats: stats })
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── Diff Analysis ──────────── */

ipcMain.handle('diff:analyze', (_e, { projectId }: { projectId: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  try {
    const result = analyzeProjectDiff(project)
    if (!result) {
      return ipcOk({ noChanges: true, message: '未检测到文件变更，或图谱尚未生成。' })
    }

    // Notify dashboard to refresh diff overlay
    setDashboardDiffOverlay(project.root_path)

    // Push diff overlay to dashboard via postMessage
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('diff:result', {
        changedNodeIds: result.changedNodeIds || [],
        affectedNodeIds: result.affectedNodeIds || [],
        summary: result.summary,
      })
    }

    return ipcOk({
      ...result,
      changedNodeIds: result.changedNodeIds || [],
      affectedNodeIds: result.affectedNodeIds || [],
    })
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── Cross-Source Tour ──────────── */

ipcMain.handle('bridge:generateTour', (_e, { projectId }: { projectId: string }): IpcResult<unknown> => {
  try {
    const result = generateCrossTour(projectId)
    if (!result) {
      return ipcOk({ noLinks: true, message: '没有找到桥接关系，请先在「桥接」Tab 中创建论文↔代码关联。' })
    }

    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('bridge:tourGenerated', { stepCount: result.stepCount, summary: result.summary })
    }

    return ipcOk(result)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── Diagnostics ──────────── */

ipcMain.handle('diagnostics:getLogs', (_e, { lines }: { lines?: number }): IpcResult<unknown> => {
  try {
    const dir = join(app.getPath('appData'), 'Fieldguide', 'logs')
    if (!existsSync(dir)) return ipcOk({ files: [], content: '' })

    const logFiles = readdirSync(dir)
      .filter(f => f.endsWith('.log'))
      .sort()
      .reverse()
      .slice(0, 10)

    let content = ''
    if (logFiles.length > 0) {
      const latestPath = join(dir, logFiles[0])
      const raw = readFileSync(latestPath, 'utf-8')
      const allLines = raw.split('\n')
      const maxLines = lines ?? 200
      content = allLines.slice(-maxLines).join('\n')
    }

    return ipcOk({ files: logFiles, content, logDir: dir })
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('diagnostics:openLogDir', async (): Promise<IpcResult<null>> => {
  try {
    const dir = join(app.getPath('appData'), 'Fieldguide', 'logs')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    await shell.openPath(dir)
    return ipcOk(null)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── Data Management ──────────── */

ipcMain.handle('data:openDir', async (): Promise<IpcResult<unknown>> => {
  try {
    const dir = join(app.getPath('appData'), 'Fieldguide')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    await shell.openPath(dir)
    return ipcOk({ path: dir })
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('data:clearCache', (): IpcResult<unknown> => {
  try {
    const base = join(app.getPath('appData'), 'Fieldguide')
    const exportsDir = join(base, 'exports')
    let removed = 0
    if (existsSync(exportsDir)) {
      for (const f of readdirSync(exportsDir)) {
        rmSync(join(exportsDir, f), { force: true })
        removed++
      }
    }
    return ipcOk({ removed })
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

/* ──────────── Paper Highlights ──────────── */

ipcMain.handle('paper:highlights', (_e, { paperId }: { paperId: string }): IpcResult<unknown> => {
  const paper = getPaper(paperId)
  if (!paper) return ipcErr('UNKNOWN', '论文不存在')
  try {
    return ipcOk(listPaperHighlights(paperId))
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('paper:addHighlight', (_e, {
  paperId, page, text, color,
}: {
  paperId: string; page: number; text: string; color?: string
}): IpcResult<unknown> => {
  const paper = getPaper(paperId)
  if (!paper) return ipcErr('UNKNOWN', '论文不存在')
  if (!text?.trim()) return ipcErr('UNKNOWN', '高亮文本不能为空')
  try {
    const hl = insertPaperHighlight({
      paper_id: paperId,
      page: page || 1,
      text: text.trim(),
      color: color || 'yellow',
    })
    return ipcOk(hl)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})

ipcMain.handle('paper:removeHighlight', (_e, { id }: { id: string }): IpcResult<null> => {
  try {
    removePaperHighlight(id)
    return ipcOk(null)
  } catch (err) {
    return ipcErr('UNKNOWN', String(err))
  }
})
