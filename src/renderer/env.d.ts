/// <reference types="vite/client" />

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  children?: FileEntry[]
}

interface ProjectRow {
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

interface PaperRow {
  id: string; arxiv_id: string; title: string; authors: string
  summary: string; published: string; pdf_path: string
  notes: string; tags: string; created_at: string
}

interface ConceptLinkRow {
  id: string; paper_id: string; project_id: string
  node_id: string; anchor_text: string; note: string; created_at: string
}

interface FieldguideAPI {
  // Config
  configGet(): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: { message: string } }>
  configSet(patch: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  configTestLlm(): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>

  // Projects
  projectList(): Promise<{ ok: boolean; data?: ProjectRow[]; error?: { message: string } }>
  projectAddLocal(path: string): Promise<{ ok: boolean; data?: ProjectRow; error?: { message: string } }>
  projectInstallDemo(projectsRoot?: string): Promise<{ ok: boolean; data?: ProjectRow; error?: { message: string } }>
  projectAddGit(url: string, branch?: string): Promise<{ ok: boolean; data?: ProjectRow; error?: { message: string } }>
  projectRemove(id: string): Promise<{ ok: boolean; error?: { message: string } }>

  // Graph
  graphGet(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  graphGetNode(projectId: string, nodeId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  graphNeighbors(projectId: string, nodeId: string, depth?: number): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  graphSearch(projectId: string, query: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  graphGetSource(projectId: string, opts: { nodeId?: string; path?: string; lineStart?: number; lineEnd?: number }): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  graphStats(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>

  // Index
  projectIndex(projectId: string, incremental?: boolean): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  onIndexProgress(cb: (data: unknown) => void): () => void

  // File tree & code
  fileTree(projectId: string): Promise<{ ok: boolean; data?: FileEntry[]; error?: { message: string } }>
  fileRead(projectId: string, filePath: string): Promise<{ ok: boolean; data?: { path: string; content: string; size: number }; error?: { message: string } }>

  // Shell
  openInExplorer(projectId: string, filePath: string): Promise<{ ok: boolean; error?: { message: string } }>
  openFile(filePath: string): Promise<{ ok: boolean; error?: { message: string } }>
  openFolderDialog(): Promise<{ ok: boolean; data?: string | null; error?: { message: string } }>

  // Chat
  chatSend(projectId: string, messages: Array<{ role: string; content: string }>): Promise<{ ok: boolean; data?: { content: string }; error?: { message: string } }>

  // Papers
  paperList(): Promise<{ ok: boolean; data?: PaperRow[]; error?: { message: string } }>
  paperSave(paper: { arxiv_id: string; title: string; authors: string; summary: string; published: string; pdf_path?: string; tags?: string }): Promise<{ ok: boolean; data?: PaperRow; error?: { message: string } }>
  paperUpdate(id: string, patch: { notes?: string; tags?: string; pdf_path?: string }): Promise<{ ok: boolean; data?: PaperRow; error?: { message: string } }>
  paperRemove(id: string): Promise<{ ok: boolean; error?: { message: string } }>
  paperSearch(query: string): Promise<{ ok: boolean; data?: PaperRow[]; error?: { message: string } }>
  paperDownloadPdf(id: string): Promise<{ ok: boolean; data?: { pdf_path: string }; error?: { message: string } }>

  // Concept Links
  conceptList(projectId?: string, paperId?: string): Promise<{ ok: boolean; data?: ConceptLinkRow[]; error?: { message: string } }>
  conceptAdd(link: { paper_id: string; project_id: string; node_id: string; anchor_text?: string; note?: string }): Promise<{ ok: boolean; data?: ConceptLinkRow; error?: { message: string } }>
  conceptRemove(id: string): Promise<{ ok: boolean; error?: { message: string } }>

  // Diff
  diffAnalyze(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  onDiffResult(cb: (data: unknown) => void): () => void
  onMenuOpenProjectsFolder(cb: () => void): () => void
  onMenuAbout(cb: () => void): () => void

  // Bridge Tour
  bridgeGenerateTour(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  onBridgeTourGenerated(cb: (data: unknown) => void): () => void

  // App
  appVersion(): Promise<string>
  dashboardUrl(): Promise<string>
  dashboardSetProject(projectRoot: string | null): Promise<void>

  // Diagnostics
  diagnosticsGetLogs(lines?: number): Promise<{ ok: boolean; data?: { files: string[]; content: string; logDir: string }; error?: { message: string } }>
  diagnosticsOpenLogDir(): Promise<{ ok: boolean; error?: { message: string } }>
}

declare global {
  interface Window {
    fieldguide: FieldguideAPI
  }
}

export {}
