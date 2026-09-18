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

interface GraphMeta {
  hasNodes: boolean
  hasEdges: boolean
  hasLayers: boolean
  hasTour: boolean
  hasDomain: boolean
}

/** Payload of `graph:search` — backend reports which matcher actually ran. */
interface GraphSearchResult {
  mode: 'text' | 'semantic'
  backend: 'ua' | 'substring'
  results: Array<{
    id: string
    label?: string
    name?: string
    type?: string
    filePath?: string
    lineRange?: [number, number]
    matchScore?: number | null
    metadata?: { summary?: string }
    summary?: string
  }>
}

/** Payload of `paper:indexStatus`. */
interface PaperIndexStatus {
  paperId: string
  chunkCount: number
  totalStats: { totalPapers: number; totalChunks: number }
}

/** Payload of `file:grep`. */
interface ContentSearchResult {
  query: string
  matches: Array<{ path: string; line: number; text: string }>
  filesScanned: number
  filesWithMatches: number
  truncated: boolean
}

/** Shared graph node shape used by the insights IPC payloads. */
interface GraphNodeLite {
  id: string
  label?: string
  name?: string
  type?: string
  filePath?: string
  lineRange?: [number, number]
}

/** Payload of `insights:evolution` (B7). */
interface EvolutionResult {
  isRepo: boolean
  commitsScanned: number
  since: string | null
  until: string | null
  buckets: Array<{ month: string; commits: number }>
  hotspots: Array<{ path: string; commits: number; lastChanged: string; nodeCount: number }>
  hottestPath: string | null
  error?: string
}

/** Payload of `insights:communities` (B8). */
interface CommunityResult {
  communities: Array<{ id: number; nodeIds: string[]; dominantPath: string; weight: number }>
  cohesion: number
  iterations: number
}

/** B1 learning progress row. */
type LearnStatus = 'unseen' | 'reading' | 'mastered'

interface LearnProgressRow {
  project_id: string
  node_id: string
  status: LearnStatus
  confidence: number
  review_count: number
  last_seen_at: string | null
  updated_at: string
}

/** B2 code note row. */
interface CodeNoteRow {
  id: string
  project_id: string
  node_id: string
  file_path: string
  line_start: number | null
  line_end: number | null
  body: string
  tags: string
  created_at: string
  updated_at: string
}

/** B3 review card + aggregate stats. */
interface ReviewCard {
  id: string
  project_id: string
  source_type: 'knowledge' | 'question' | 'note'
  source_id: string
  front: string
  back: string
  nodeIds: string[]
  due_at: string
  interval_days: number
  ease: number
  reps: number
  lapses: number
  last_reviewed_at: string | null
  created_at: string
}

interface ReviewStats {
  dueNow: number
  total: number
  reviewedToday: number
  retentionToday: number
  streakDays: number
}

/** B4 tutor payloads. */
interface TutorQuestion {
  question: string
  hints: string[]
  nodeIds: string[]
  source: 'heuristic' | 'llm'
}

interface TutorEvaluation {
  score: number
  verdict: 'weak' | 'ok' | 'strong'
  missed: string[]
  feedback: string
  source: 'heuristic' | 'llm'
}

/** B5 review finding. */
interface ReviewFinding {
  id: string
  project_id: string
  severity: 'high' | 'medium' | 'low' | 'info'
  kind: 'bug' | 'architecture' | 'debt' | 'performance' | 'security'
  title: string
  detail: string
  file_path: string
  line: number | null
  node_id: string
  created_at: string
}

/** B6 learning path step. */
interface LearningStep {
  order: number
  title: string
  why?: string
  nodeIds?: string[]
  files?: string[]
}

/** Payload of `insights:debtScan`. */
interface DebtScanResult {  items: Array<{
    kind: 'todo' | 'large-file' | 'high-fan-in' | 'no-summary'
    detail: string
    path?: string
    line?: number
    nodeId?: string
    weight: number
  }>
  counts: Record<'todo' | 'large-file' | 'high-fan-in' | 'no-summary', number>
  filesScanned: number
}

/** One RAG hit from `paper:query`. */interface PaperChunkHit {
  score: number
  chunk: {
    id: string
    paper_id: string
    chunk_index: number
    text: string
    token_count: number
    char_start: number
    char_end: number
  }
}

interface FieldguideAPI {
  // Config
  configGet(): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: { message: string } }>
  configSet(patch: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  configTestLlm(): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  configLlmStatus(): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  llmListProviders(): Promise<{ ok: boolean; data?: Array<{
    id: string
    labelKey: string
    baseUrl: string
    models: string[]
    embedModels: string[]
    customModel?: boolean
    source?: 'builtin' | 'live'
  }>; error?: { message: string } }>
  llmFetchModels(opts?: { providerId?: string; baseUrl?: string; apiKey?: string }): Promise<{
    ok: boolean
    data?: { ok: boolean; models: string[]; embedModels: string[]; error?: string; source: 'live' | 'builtin' }
    error?: { message: string }
  }>

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
  graphSearch(projectId: string, query: string, opts?: { mode?: 'text' | 'semantic'; limit?: number }): Promise<{ ok: boolean; data?: GraphSearchResult; error?: { message: string } }>
  graphGetSource(projectId: string, opts: { nodeId?: string; path?: string; lineStart?: number; lineEnd?: number }): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  graphStats(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  graphMeta(projectId: string): Promise<{ ok: boolean; data?: GraphMeta; error?: { message: string } }>

  // Index
  projectIndex(projectId: string, incremental?: boolean, skipLlm?: boolean): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  projectIndexCancel(projectId: string): Promise<{ ok: boolean; error?: { message: string } }>
  projectExportGraph(projectId: string): Promise<{ ok: boolean; data?: { exportPath?: string }; error?: { message: string } }>
  onIndexProgress(cb: (data: unknown) => void): () => void

  // File tree & code
  fileTree(projectId: string): Promise<{ ok: boolean; data?: FileEntry[]; error?: { message: string } }>
  fileRead(projectId: string, filePath: string): Promise<{ ok: boolean; data?: { path: string; content: string; size: number }; error?: { message: string } }>
  fileGrep(projectId: string, query: string, opts?: { caseSensitive?: boolean; limit?: number }): Promise<{ ok: boolean; data?: ContentSearchResult; error?: { message: string } }>

  // Insights
  insightsExportReport(projectId: string): Promise<{ ok: boolean; data?: { exportPath: string; bytes: number }; error?: { message: string } }>
  insightsDebtScan(projectId: string): Promise<{ ok: boolean; data?: DebtScanResult; error?: { message: string } }>
  insightsEvolution(projectId: string, maxCommits?: number): Promise<{ ok: boolean; data?: EvolutionResult; error?: { message: string } }>
  insightsCommunities(projectId: string): Promise<{ ok: boolean; data?: CommunityResult; error?: { message: string } }>
  graphNodeAtLine(projectId: string, path: string, line?: number): Promise<{ ok: boolean; data?: { node: GraphNodeLite | null; candidates: GraphNodeLite[] }; error?: { message: string } }>

  // B1 learning progress
  progressList(projectId: string): Promise<{ ok: boolean; data?: { rows: LearnProgressRow[] }; error?: { message: string } }>
  progressSet(projectId: string, nodeId: string, status: LearnStatus, confidence?: number): Promise<{ ok: boolean; data?: LearnProgressRow; error?: { message: string } }>
  progressClear(projectId: string): Promise<{ ok: boolean; error?: { message: string } }>

  // B2 code notes
  notesList(projectId: string, filter?: { filePath?: string; nodeId?: string }): Promise<{ ok: boolean; data?: CodeNoteRow[]; error?: { message: string } }>
  notesAdd(note: {
    project_id: string
    node_id?: string
    file_path: string
    line_start?: number | null
    line_end?: number | null
    body: string
    tags?: string
  }): Promise<{ ok: boolean; data?: CodeNoteRow; error?: { message: string } }>
  notesUpdate(id: string, patch: { body?: string; tags?: string }): Promise<{ ok: boolean; data?: CodeNoteRow; error?: { message: string } }>
  notesRemove(id: string): Promise<{ ok: boolean; error?: { message: string } }>

  // B3 spaced repetition
  reviewGenerate(projectId: string, reset?: boolean): Promise<{ ok: boolean; data?: { added: number; total: number; candidates: number }; error?: { message: string } }>
  reviewList(projectId: string): Promise<{ ok: boolean; data?: { cards: ReviewCard[]; stats: ReviewStats }; error?: { message: string } }>
  reviewGrade(cardId: string, rating: 0 | 1 | 2 | 3): Promise<{ ok: boolean; data?: { dueAt: string; intervalDays: number; ease: number }; error?: { message: string } }>

  // B4 tutor
  tutorQuestion(projectId: string, opts?: { focusedNodeId?: string | null; filePath?: string | null }): Promise<{ ok: boolean; data?: TutorQuestion; error?: { message: string } }>
  tutorEvaluate(projectId: string, payload: { question: string; answer: string; hints?: string[]; focusedNodeId?: string | null }): Promise<{ ok: boolean; data?: TutorEvaluation; error?: { message: string } }>

  // B5 code review
  reviewAudit(projectId: string, opts?: { paths?: string[]; maxFiles?: number }): Promise<{ ok: boolean; data?: { findings: ReviewFinding[]; filesReviewed: string[]; source: 'heuristic' | 'llm' }; error?: { message: string } }>
  reviewFindings(projectId: string): Promise<{ ok: boolean; data?: ReviewFinding[]; error?: { message: string } }>

  // B6 learning path
  pathGenerate(projectId: string, goal: string): Promise<{ ok: boolean; data?: { goal: string; steps: LearningStep[]; source: 'heuristic' | 'llm' }; error?: { message: string } }>
  pathList(projectId: string): Promise<{ ok: boolean; data?: Array<{ id: string; goal: string; steps: LearningStep[]; source: string; created_at: string }>; error?: { message: string } }>
  pathClear(projectId: string): Promise<{ ok: boolean; error?: { message: string } }>

  // Shell
  openInExplorer(projectId: string, filePath: string): Promise<{ ok: boolean; error?: { message: string } }>
  openFile(filePath: string): Promise<{ ok: boolean; error?: { message: string } }>
  openFolderDialog(): Promise<{ ok: boolean; data?: string | null; error?: { message: string } }>

  // Chat
  chatSend(
    projectId: string,
    messages: Array<{ role: string; content: string }>,
    opts?: { focusedNodeId?: string | null; tourStepIndex?: number | null },
  ): Promise<{ ok: boolean; data?: { content: string; steps?: unknown[]; nodeRefs?: string[] }; error?: { message: string } }>
  chatHistory(projectId: string): Promise<{ ok: boolean; data?: unknown[]; error?: { message: string } }>
  chatClear(projectId: string): Promise<{ ok: boolean; error?: { message: string } }>

  // Papers
  paperList(): Promise<{ ok: boolean; data?: PaperRow[]; error?: { message: string } }>
  paperSave(paper: { arxiv_id: string; title: string; authors: string; summary: string; published: string; pdf_path?: string; tags?: string }): Promise<{ ok: boolean; data?: PaperRow; error?: { message: string } }>
  paperUpdate(id: string, patch: { notes?: string; tags?: string; pdf_path?: string }): Promise<{ ok: boolean; data?: PaperRow; error?: { message: string } }>
  paperRemove(id: string): Promise<{ ok: boolean; error?: { message: string } }>
  paperSearch(query: string): Promise<{ ok: boolean; data?: PaperRow[]; error?: { message: string } }>
  paperDownloadPdf(id: string): Promise<{ ok: boolean; data?: { pdf_path: string }; error?: { message: string } }>
  paperIndex(id: string): Promise<{ ok: boolean; data?: { paperId: string; chunkCount: number; skipped?: boolean }; error?: { message: string; code?: string } }>
  paperQuery(query: string, paperId?: string, topK?: number): Promise<{ ok: boolean; data?: PaperChunkHit[]; error?: { message: string; code?: string } }>
  paperIndexStatus(id: string): Promise<{ ok: boolean; data?: PaperIndexStatus; error?: { message: string } }>
  paperHighlights(paperId: string): Promise<{ ok: boolean; data?: unknown[]; error?: { message: string } }>
  paperAddHighlight(paperId: string, page: number, text: string, color?: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  paperRemoveHighlight(id: string): Promise<{ ok: boolean; error?: { message: string } }>

  // Concept Links
  conceptList(projectId?: string, paperId?: string): Promise<{ ok: boolean; data?: ConceptLinkRow[]; error?: { message: string } }>
  conceptAdd(link: { paper_id: string; project_id: string; node_id: string; anchor_text?: string; note?: string }): Promise<{ ok: boolean; data?: ConceptLinkRow; error?: { message: string } }>
  conceptRemove(id: string): Promise<{ ok: boolean; error?: { message: string } }>

  // Diff
  diffAnalyze(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  onDiffResult(cb: (data: unknown) => void): () => void
  onMenuOpenProjectsFolder(cb: () => void): () => void
  onMenuOpenProject(cb: () => void): () => void
  onMenuAbout(cb: () => void): () => void
  onMenuShortcuts(cb: () => void): () => void
  onMenuZoomIn(cb: () => void): () => void
  onMenuZoomOut(cb: () => void): () => void
  onMenuZoomReset(cb: () => void): () => void
  menuPopupTopLevel(id: 'file' | 'edit' | 'view' | 'help', x: number, y: number): Promise<{ ok: boolean; error?: { message: string } }>
  menuTopLevelLabels(): Promise<{ ok: boolean; data?: Record<'file' | 'edit' | 'view' | 'help', string>; error?: { message: string } }>
  windowMinimize(): Promise<{ ok: boolean; error?: { message: string } }>
  windowMaximize(): Promise<{ ok: boolean; data?: { maximized: boolean }; error?: { message: string } }>
  windowClose(): Promise<{ ok: boolean; error?: { message: string } }>
  windowIsMaximized(): Promise<{ ok: boolean; data?: { maximized: boolean }; error?: { message: string } }>
  windowPlatform(): Promise<{ ok: boolean; data?: { platform: string; customTitleBar: boolean }; error?: { message: string } }>
  onWindowMaximizeChange(cb: (maximized: boolean) => void): () => void

  // Bridge Tour
  bridgeGenerateTour(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  onBridgeTourGenerated(cb: (data: unknown) => void): () => void

  // Understanding workbench
  understandGetArchitecture(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  understandListKnowledge(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  understandListQuestions(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>
  understandRun(
    projectId: string,
    stages?: Array<'structure' | 'architecture' | 'knowledge' | 'interview'>,
    skipLlm?: boolean,
  ): Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>

  // App
  appVersion(): Promise<string>
  dashboardUrl(): Promise<string>
  dashboardSetProject(projectRoot: string | null): Promise<void>

  // Diagnostics
  diagnosticsGetLogs(lines?: number): Promise<{ ok: boolean; data?: { files: string[]; content: string; logDir: string }; error?: { message: string } }>
  diagnosticsOpenLogDir(): Promise<{ ok: boolean; error?: { message: string } }>
  dataOpenDir(): Promise<{ ok: boolean; data?: { path?: string }; error?: { message: string } }>
  dataClearCache(): Promise<{ ok: boolean; data?: { removed?: number }; error?: { message: string } }>
}

declare global {
  interface Window {
    fieldguide: FieldguideAPI
  }

  /**
   * Payload types for the B1–B8 workbench channels.
   *
   * These live in `declare global` (unlike the legacy types above, which are
   * module-scoped and therefore re-declared by each view) so the new panels can
   * share one definition instead of three drifting copies.
   */
  interface GraphNodeLite {
    id: string
    label?: string
    name?: string
    type?: string
    filePath?: string
    lineRange?: [number, number]
  }

  interface EvolutionResult {
    isRepo: boolean
    commitsScanned: number
    since: string | null
    until: string | null
    buckets: Array<{ month: string; commits: number }>
    hotspots: Array<{ path: string; commits: number; lastChanged: string; nodeCount: number }>
    hottestPath: string | null
    error?: string
  }

  interface CommunityResult {
    communities: Array<{ id: number; nodeIds: string[]; dominantPath: string; weight: number }>
    cohesion: number
    iterations: number
  }

  type LearnStatus = 'unseen' | 'reading' | 'mastered'

  interface LearnProgressRow {
    project_id: string
    node_id: string
    status: LearnStatus
    confidence: number
    review_count: number
    last_seen_at: string | null
    updated_at: string
  }

  interface CodeNoteRow {
    id: string
    project_id: string
    node_id: string
    file_path: string
    line_start: number | null
    line_end: number | null
    body: string
    tags: string
    created_at: string
    updated_at: string
  }

  interface ReviewCard {
    id: string
    project_id: string
    source_type: 'knowledge' | 'question' | 'note'
    source_id: string
    front: string
    back: string
    nodeIds: string[]
    due_at: string
    interval_days: number
    ease: number
    reps: number
    lapses: number
    last_reviewed_at: string | null
    created_at: string
  }

  interface ReviewStats {
    dueNow: number
    total: number
    reviewedToday: number
    retentionToday: number
    streakDays: number
  }

  interface TutorQuestion {
    question: string
    hints: string[]
    nodeIds: string[]
    source: 'heuristic' | 'llm'
  }

  interface TutorEvaluation {
    score: number
    verdict: 'weak' | 'ok' | 'strong'
    missed: string[]
    feedback: string
    source: 'heuristic' | 'llm'
  }

  interface ReviewFinding {
    id: string
    project_id: string
    severity: 'high' | 'medium' | 'low' | 'info'
    kind: 'bug' | 'architecture' | 'debt' | 'performance' | 'security'
    title: string
    detail: string
    file_path: string
    line: number | null
    node_id: string
    created_at: string
  }

  interface LearningStep {
    order: number
    title: string
    why?: string
    nodeIds?: string[]
    files?: string[]
  }
}

export {}
