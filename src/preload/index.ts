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

  // Projects
  projectList: (): Promise<IpcResult<unknown[]>> =>
    ipcRenderer.invoke('project:list'),
  projectAddLocal: (path: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('project:addLocal', { path }),
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
  graphSearch: (projectId: string, query: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:search', { projectId, query }),
  graphGetSource: (projectId: string, opts: { nodeId?: string; path?: string; lineStart?: number; lineEnd?: number }): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:getSource', { projectId, ...opts }),
  graphStats: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:stats', { projectId }),

  // Index
  projectIndex: (projectId: string, incremental?: boolean): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('project:index', { projectId, incremental }),
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

  // Shell
  openInExplorer: (projectId: string, filePath: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('shell:openPath', { projectId, filePath }),
  openFile: (filePath: string): Promise<IpcResult<null>> =>
    ipcRenderer.invoke('shell:openFile', { filePath }),
  openFolderDialog: (): Promise<IpcResult<string | null>> =>
    ipcRenderer.invoke('dialog:openFolder'),

  // Chat
  chatSend: (projectId: string, messages: Array<{ role: string; content: string }>): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('chat:send', { projectId, messages }),

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

  // App
  appVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:version'),
  dashboardUrl: (): Promise<string> =>
    ipcRenderer.invoke('dashboard:url'),
  dashboardSetProject: (projectRoot: string | null): Promise<void> =>
    ipcRenderer.invoke('dashboard:setProject', { projectRoot }),
}

contextBridge.exposeInMainWorld('fieldguide', api)

export type FieldguideAPI = typeof api
