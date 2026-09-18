import { contextBridge, ipcRenderer } from 'electron'
import type { IpcResult } from '../shared/ipc'

/**
 * Narrow type-safe API exposed to the renderer.
 * See architecture.md §7 for the full IPC contract.
 */
const api = {
  // Config
  configGet: (): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('config:get'),
  configSet: (patch: Record<string, unknown>): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('config:set', patch),
  configTestLlm: (): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('config:testLlm'),
  configLlmStatus: (): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('config:llmStatus'),
  llmListProviders: (): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('llm:listProviders'),
  llmFetchModels: (opts?: { providerId?: string; baseUrl?: string; apiKey?: string }): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('llm:fetchModels', opts ?? {}),

  // Projects
  projectList: (): Promise<IpcResult<unknown[]>> =>
    ipcRenderer.invoke('project:list'),
  projectAddLocal: (path: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('project:addLocal', { path }),
  projectInstallDemo: (projectsRoot?: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('project:installDemo', { projectsRoot }),
  projectAddGit: (url: string, branch?: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('project:addGit', { url, branch }),
  projectRemove: (id: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('project:remove', { id }),

  // Graph
  graphGet: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:get', { projectId }),
  graphGetNode: (projectId: string, nodeId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:getNode', { projectId, nodeId }),
  graphNeighbors: (projectId: string, nodeId: string, depth?: number): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:neighbors', { projectId, nodeId, depth }),
  graphSearch: (
    projectId: string,
    query: string,
    opts?: { mode?: 'text' | 'semantic'; limit?: number },
  ): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:search', {
      projectId,
      query,
      mode: opts?.mode ?? 'text',
      limit: opts?.limit,
    }),
  graphGetSource: (projectId: string, opts: { nodeId?: string; path?: string; lineStart?: number; lineEnd?: number }): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:getSource', { projectId, ...opts }),
  graphStats: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:stats', { projectId }),
  graphMeta: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:meta', { projectId }),

  // Index
  projectIndex: (projectId: string, incremental?: boolean, skipLlm?: boolean): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('project:index', { projectId, incremental, skipLlm }),
  projectIndexCancel: (projectId: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('project:indexCancel', { projectId }),
  projectExportGraph: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('project:exportGraph', { projectId }),
  onIndexProgress: (cb: (data: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => cb(data)
    ipcRenderer.on('index:progress', handler)
    return () => {
      ipcRenderer.removeListener('index:progress', handler)
    }
  },

  // File tree & code
  fileTree: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('file:tree', { projectId }),
  fileRead: (projectId: string, filePath: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('file:read', { projectId, filePath }),
  /** Find in files (substring, bounded). */
  fileGrep: (
    projectId: string,
    query: string,
    opts?: { caseSensitive?: boolean; limit?: number },
  ): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('file:grep', {
      projectId,
      query,
      caseSensitive: opts?.caseSensitive,
      limit: opts?.limit,
    }),

  // Insights
  insightsExportReport: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('insights:exportReport', { projectId }),
  insightsDebtScan: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('insights:debtScan', { projectId }),
  insightsEvolution: (projectId: string, maxCommits?: number): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('insights:evolution', { projectId, maxCommits }),
  insightsCommunities: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('insights:communities', { projectId }),
  graphNodeAtLine: (projectId: string, path: string, line?: number): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:nodeAtLine', { projectId, path, line }),

  // B1 learning progress
  progressList: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('progress:list', { projectId }),
  progressSet: (
    projectId: string,
    nodeId: string,
    status: 'unseen' | 'reading' | 'mastered',
    confidence?: number,
  ): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('progress:set', { projectId, nodeId, status, confidence }),
  progressClear: (projectId: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('progress:clear', { projectId }),

  // B2 code notes
  notesList: (projectId: string, filter?: { filePath?: string; nodeId?: string }): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('notes:list', { projectId, filePath: filter?.filePath, nodeId: filter?.nodeId }),
  notesAdd: (note: {
    project_id: string
    node_id?: string
    file_path: string
    line_start?: number | null
    line_end?: number | null
    body: string
    tags?: string
  }): Promise<IpcResult<unknown>> => ipcRenderer.invoke('notes:add', note),
  notesUpdate: (id: string, patch: { body?: string; tags?: string }): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('notes:update', { id, patch }),
  notesRemove: (id: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('notes:remove', { id }),

  // B3 spaced repetition
  reviewGenerate: (projectId: string, reset?: boolean): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('review:generate', { projectId, reset }),
  reviewList: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('review:list', { projectId }),
  reviewGrade: (cardId: string, rating: 0 | 1 | 2 | 3): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('review:grade', { cardId, rating }),

  // B4 tutor
  tutorQuestion: (
    projectId: string,
    opts?: { focusedNodeId?: string | null; filePath?: string | null },
  ): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('tutor:question', {
      projectId,
      focusedNodeId: opts?.focusedNodeId ?? null,
      filePath: opts?.filePath ?? null,
    }),
  tutorEvaluate: (
    projectId: string,
    payload: { question: string; answer: string; hints?: string[]; focusedNodeId?: string | null },
  ): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('tutor:evaluate', { projectId, ...payload }),

  // B5 code review
  reviewAudit: (projectId: string, opts?: { paths?: string[]; maxFiles?: number }): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('review:audit', { projectId, paths: opts?.paths, maxFiles: opts?.maxFiles }),
  reviewFindings: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('review:findings', { projectId }),

  // B6 learning path
  pathGenerate: (projectId: string, goal: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('path:generate', { projectId, goal }),
  pathList: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('path:list', { projectId }),
  pathClear: (projectId: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('path:clear', { projectId }),

  // Shell
  openInExplorer: (projectId: string, filePath: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('shell:openPath', { projectId, filePath }),
  openFile: (filePath: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('shell:openFile', { filePath }),
  openFolderDialog: (): Promise<IpcResult<string | null>> =>
    ipcRenderer.invoke('dialog:openFolder'),

  // Chat
  chatSend: (
    projectId: string,
    messages: Array<{ role: string; content: string }>,
    opts?: { focusedNodeId?: string | null; tourStepIndex?: number | null },
  ): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('chat:send', {
      projectId,
      messages,
      focusedNodeId: opts?.focusedNodeId ?? null,
      tourStepIndex: opts?.tourStepIndex ?? null,
    }),
  chatHistory: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('chat:history', { projectId }),
  chatClear: (projectId: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('chat:clear', { projectId }),

  // Papers
  paperList: (): Promise<IpcResult<unknown[]>> =>
    ipcRenderer.invoke('paper:list'),
  paperSave: (paper: { arxiv_id: string; title: string; authors: string; summary: string; published: string; pdf_path?: string; tags?: string }): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('paper:save', paper),
  paperUpdate: (id: string, patch: { notes?: string; tags?: string; pdf_path?: string }): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('paper:update', { id, patch }),
  paperRemove: (id: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('paper:remove', { id }),
  paperSearch: (query: string): Promise<IpcResult<unknown[]>> =>
    ipcRenderer.invoke('paper:search', { query }),
  paperDownloadPdf: (id: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('paper:downloadPdf', { id }),
  paperIndex: (id: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('paper:index', { id }),
  paperQuery: (query: string, paperId?: string, topK?: number): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('paper:query', { query, paperId, topK }),
  paperIndexStatus: (id: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('paper:indexStatus', { id }),
  paperHighlights: (paperId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('paper:highlights', { paperId }),
  paperAddHighlight: (paperId: string, page: number, text: string, color?: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('paper:addHighlight', { paperId, page, text, color }),
  paperRemoveHighlight: (id: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('paper:removeHighlight', { id }),

  // Concept Links
  conceptList: (projectId?: string, paperId?: string): Promise<IpcResult<unknown[]>> =>
    ipcRenderer.invoke('concept:list', { projectId, paperId }),
  conceptAdd: (link: { paper_id: string; project_id: string; node_id: string; anchor_text?: string; note?: string }): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('concept:add', link),
  conceptRemove: (id: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('concept:remove', { id }),

  // Diff
  diffAnalyze: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('diff:analyze', { projectId }),
  onDiffResult: (cb: (data: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => cb(data)
    ipcRenderer.on('diff:result', handler)
    return () => {
      ipcRenderer.removeListener('diff:result', handler)
    }
  },

  onMenuOpenProjectsFolder: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:openProjectsFolder', handler)
    return () => {
      ipcRenderer.removeListener('menu:openProjectsFolder', handler)
    }
  },
  onMenuOpenProject: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:openProject', handler)
    return () => ipcRenderer.removeListener('menu:openProject', handler)
  },
  onMenuAbout: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:about', handler)
    return () => {
      ipcRenderer.removeListener('menu:about', handler)
    }
  },
  onMenuShortcuts: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:shortcuts', handler)
    return () => {
      ipcRenderer.removeListener('menu:shortcuts', handler)
    }
  },
  onMenuZoomIn: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:zoomIn', handler)
    return () => ipcRenderer.removeListener('menu:zoomIn', handler)
  },
  onMenuZoomOut: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:zoomOut', handler)
    return () => ipcRenderer.removeListener('menu:zoomOut', handler)
  },
  onMenuZoomReset: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:zoomReset', handler)
    return () => ipcRenderer.removeListener('menu:zoomReset', handler)
  },

  menuPopupTopLevel: (id: 'file' | 'edit' | 'view' | 'help', x: number, y: number): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('menu:popupTopLevel', { id, x, y }),
  menuTopLevelLabels: (): Promise<IpcResult<Record<'file' | 'edit' | 'view' | 'help', string>>> =>
    ipcRenderer.invoke('menu:topLevelLabels'),

  windowMinimize: (): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('window:minimize'),
  windowMaximize: (): Promise<IpcResult<{ maximized: boolean }>> =>
    ipcRenderer.invoke('window:maximize'),
  windowClose: (): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('window:close'),
  windowIsMaximized: (): Promise<IpcResult<{ maximized: boolean }>> =>
    ipcRenderer.invoke('window:isMaximized'),
  windowPlatform: (): Promise<IpcResult<{ platform: string; customTitleBar: boolean }>> =>
    ipcRenderer.invoke('window:platform'),
  onWindowMaximizeChange: (cb: (maximized: boolean) => void) => {
    const handler = (_event: unknown, maximized: boolean) => cb(maximized)
    ipcRenderer.on('window:maximize-changed', handler)
    return () => ipcRenderer.removeListener('window:maximize-changed', handler)
  },

  // Bridge Tour
  bridgeGenerateTour: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('bridge:generateTour', { projectId }),
  onBridgeTourGenerated: (cb: (data: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => cb(data)
    ipcRenderer.on('bridge:tourGenerated', handler)
    return () => {
      ipcRenderer.removeListener('bridge:tourGenerated', handler)
    }
  },

  // Understanding workbench (architecture / knowledge / interview)
  understandGetArchitecture: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('understand:getArchitecture', { projectId }),
  understandListKnowledge: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('understand:listKnowledge', { projectId }),
  understandListQuestions: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('understand:listQuestions', { projectId }),
  understandRun: (projectId: string, stages?: Array<'structure' | 'architecture' | 'knowledge' | 'interview'>, skipLlm?: boolean): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('understand:run', { projectId, stages, skipLlm }),

  // App
  appVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:version'),
  dashboardUrl: (): Promise<string> =>
    ipcRenderer.invoke('dashboard:url'),
  dashboardSetProject: (projectRoot: string | null): Promise<void> =>
    ipcRenderer.invoke('dashboard:setProject', { projectRoot }),

  // Diagnostics
  diagnosticsGetLogs: (lines?: number): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('diagnostics:getLogs', { lines }),
  diagnosticsOpenLogDir: (): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('diagnostics:openLogDir'),

  // Data management
  dataOpenDir: (): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('data:openDir'),
  dataClearCache: (): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('data:clearCache'),
}

contextBridge.exposeInMainWorld('fieldguide', api)

export type FieldguideAPI = typeof api
