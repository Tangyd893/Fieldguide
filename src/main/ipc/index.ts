/**
 * IPC Router — architecture.md §7
 *
 * Registers all invoke handlers and event emitters.
 * Renderer communicates exclusively through these channels.
 */
import { ipcMain, BrowserWindow, shell, app } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { loadConfig, updateConfig } from '../config'
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
} from '../db'
import type { PaperRow } from '../db'
import { readProjectTree } from '../file-tree'
import { cloneRepo } from '../git'
import { indexProject } from '../ua/client'
import { setDashboardGraph, setDashboardDiffOverlay } from '../ua/dashboard'
import { buildUARuntimeConfig, isLLMConfigured, maskedApiKey } from '../ua/config-bridge'
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
    return ipcOk(updateConfig(patch as never))
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
  const url = `${config.llm.baseUrl}/v1/chat/completions`
    .replace(/\/+$/, '')
    .replace(/\/v1\/chat\/completions\/v1\/chat\/completions/, '/v1/chat/completions')
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

/* ──────────── App ──────────── */

ipcMain.handle('app:version', (): string => {
  return '0.1.0'
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
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return ipcErr('UNKNOWN', '没有可用窗口')
  try {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: '选择项目文件夹',
    })
    if (result.canceled || result.filePaths.length === 0) {
      return ipcOk(null)
    }
    return ipcOk(result.filePaths[0])
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

/* ──────────── File Tree & Code ──────────── */

ipcMain.handle('file:tree', (_e, { projectId }: { projectId: string }): IpcResult<unknown> => {
  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)
  try {
    const tree = readProjectTree(project.root_path)
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
}: {
  projectId: string
  messages: ChatMessage[]
}): Promise<IpcResult<unknown>> => {
  const config = loadConfig()

  if (!isLLMConfigured()) {
    return ipcErr('LLM_NOT_CONFIGURED', '请先在设置中配置 LLM API Key', true)
  }

  const project = getProject(projectId)
  if (!project) return ipcErr('PROJECT_NOT_FOUND', `项目 ${projectId} 不存在`)

  // Build code context from knowledge graph
  let codeContext = ''
  const graphPath = join(project.root_path, '.understand-anything', 'knowledge-graph.json')
  if (existsSync(graphPath)) {
    try {
      const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
      const nodes = (graph.nodes || []) as Array<{
        id: string; type: string; label: string; filePath?: string
        metadata?: { summary?: string; complexity?: string }
      }>
      // Provide a structured overview: file → symbols
      const fileMap = new Map<string, Array<{ name: string; type: string; summary?: string }>>()
      for (const node of nodes.slice(0, 200)) {
        const fp = node.filePath || node.id || ''
        const fileName = fp.split('/').slice(-1)[0] || fp
        if (!fileMap.has(fileName)) fileMap.set(fileName, [])
        fileMap.get(fileName)!.push({
          name: node.label || node.id || '',
          type: node.type || 'unknown',
          summary: node.metadata?.summary,
        })
      }
      const entries = [...fileMap.entries()].slice(0, 30)
      codeContext = entries.map(([file, syms]) =>
        `📄 ${file}:\n${syms.map(s => `  - ${s.type === 'function' ? '🔧' : s.type === 'class' ? '🏛️' : '📦'} ${s.name}${s.summary ? ` — ${s.summary}` : ''}`).join('\n')}`
      ).join('\n\n')
    } catch { /* ignore parse errors */ }
  }

  // Build paper context from saved papers
  let paperContext = ''
  try {
    const papers = listPapers()
    if (papers.length > 0) {
      paperContext = papers.slice(0, 10).map(p =>
        `📰 ${p.title} (arxiv:${p.arxiv_id})\n   ${p.summary.slice(0, 300)}${p.notes ? `\n   笔记: ${p.notes.slice(0, 200)}` : ''}`
      ).join('\n\n')
    }
  } catch { /* ignore */ }

  // Try paper RAG: query chunks relevant to user's latest question
  let ragContext = ''
  try {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMsg && lastUserMsg.content.trim().length > 10) {
      const ragResults = await queryPaper(lastUserMsg.content, undefined, 3)
      if (ragResults.length > 0) {
        ragContext = ragResults.map((r, i) =>
          `📎 Chunk ${i + 1} (score: ${r.score.toFixed(3)}, arxiv:${getPaper(r.chunk.paper_id)?.arxiv_id ?? '?'})\n${r.chunk.text.slice(0, 600)}`
        ).join('\n\n')
      }
    }
  } catch { /* RAG is best-effort; ignore failures */ }

  const systemPrompt = [
    'You are Fieldguide AI, a code analysis assistant that helps developers understand codebases and research papers.',
    codeContext ? `\n## Project Structure\n\n${codeContext}` : `\nThe project is "${project.name}".`,
    paperContext ? `\n## Saved Papers\n\n${paperContext}` : '',
    ragContext ? `\n## Relevant Paper Excerpts (RAG)\n\n${ragContext}\n\nUse these excerpts when relevant to the user\'s question. Cite the arxiv ID when referencing.` : '',
    '\nUse all available context to answer precisely. When referencing code, mention specific file names and symbols. When referencing papers, mention the arxiv ID. Keep answers concise and practical. Reply in the same language as the user\'s question.',
  ].filter(Boolean).join('\n')

  const allMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  const url = `${config.llm.baseUrl}/v1/chat/completions`
    .replace(/\/+$/, '')
    .replace(/\/v1\/chat\/completions\/v1\/chat\/completions/, '/v1/chat/completions')

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: config.llm.chatModel,
        messages: allMessages,
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      let errMsg = `LLM API 错误 (${resp.status})`
      if (resp.status === 401) errMsg = 'API Key 无效，请检查设置'
      else if (resp.status === 429) errMsg = 'API 请求过于频繁，请稍后再试'
      else if (text) {
        try {
          const j = JSON.parse(text)
          errMsg = j.error?.message || errMsg
        } catch { errMsg += `: ${text.slice(0, 200)}` }
      }
      return ipcErr('LLM_API_ERROR', errMsg, true)
    }

    const data = await resp.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content || ''

    logChatRequest(project.name, messages.length, content.length)
    return ipcOk({ content })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('AbortError') || msg.includes('timeout')) {
      return ipcErr('LLM_API_ERROR', 'LLM 请求超时，请检查网络或 API 地址', true)
    }
    return ipcErr('LLM_API_ERROR', `请求失败: ${msg}`, true)
  }
})

ipcMain.handle('project:index', async (_e, { projectId, incremental }: { projectId: string; incremental?: boolean }): Promise<IpcResult<unknown>> => {
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
    const hasLLM = isLLMConfigured()

    const result = await indexProject(
      project.root_path,
      project.name,
      (phase) => {
        win?.webContents.send('index:progress', { type: 'phase', phase, projectId })
        if (phase === 'scan') {
          // Log file count after scan completes (next phase)
        }
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
      hasLLM ? {
        baseUrl: config.llm.baseUrl,
        apiKey: config.llm.apiKey,
        chatModel: config.llm.chatModel,
      } : undefined,
    )

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
