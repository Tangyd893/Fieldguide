/// <reference types="vite/client" />

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  children?: FileEntry[]
}
  id: string
  name: string
  slug: string
  source_type: 'local' | 'git'
  source_uri: string
  root_path: string
  status: 'pending' | 'indexing' | 'ready' | 'failed' | 'stale'
  language: string
  node_count: number
  created_at: string
  indexed_at: string | null
}

interface FieldguideAPI {
  // Config
  configGet(): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: { message: string } }>
  configSet(patch: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>

  // Projects
  projectList(): Promise<{ ok: boolean; data?: ProjectRow[]; error?: { message: string } }>
  projectAddLocal(path: string): Promise<{ ok: boolean; data?: ProjectRow; error?: { message: string } }>
  projectAddGit(url: string, branch?: string): Promise<{ ok: boolean; data?: ProjectRow; error?: { message: string } }>
  projectRemove(id: string): Promise<{ ok: boolean; error?: { message: string } }>

  // Graph
  graphGet(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>

  // Index
  projectIndex(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  onIndexProgress(cb: (data: unknown) => void): () => void

  // File tree & code
  fileTree(projectId: string): Promise<{ ok: boolean; data?: FileEntry[]; error?: { message: string } }>
  fileRead(projectId: string, filePath: string): Promise<{ ok: boolean; data?: { path: string; content: string; size: number }; error?: { message: string } }>

  // App
  appVersion(): Promise<string>
  dashboardUrl(): Promise<string>
}

declare global {
  interface Window {
    fieldguide: FieldguideAPI
  }
}

export {}
