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

  // Projects
  projectList: (): Promise<IpcResult<unknown[]>> =>
    ipcRenderer.invoke('project:list'),
  projectAddLocal: (path: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('project:addLocal', { path }),
  projectAddGit: (url: string, branch?: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('project:addGit', { url, branch }),

  // Graph
  graphGet: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('graph:get', { projectId }),

  // Index
  projectIndex: (projectId: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke('project:index', { projectId }),
  onIndexProgress: (cb: (data: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => cb(data)
    ipcRenderer.on('index:progress', handler)
    return () => {
      ipcRenderer.removeListener('index:progress', handler)
    }
  },

  // App
  appVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:version'),
  dashboardUrl: (): Promise<string> =>
    ipcRenderer.invoke('dashboard:url'),
}

contextBridge.exposeInMainWorld('fieldguide', api)

export type FieldguideAPI = typeof api
