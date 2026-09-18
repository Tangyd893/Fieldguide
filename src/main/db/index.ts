/**
 * SQLite database layer — architecture.md §6.2
 *
 * Manages Fieldguide extension data: projects, index_jobs.
 * Graph nodes/edges are NOT stored here (UA knowledge-graph.json is the authority).
 */
import Database from 'better-sqlite3'
import { join } from 'node:path'
import type { ArchitectureSummary, KnowledgeNode, InterviewQuestion } from '../../shared/understand'
import { dataDir } from '../config'
import { SCHEMA_VERSION, planMigrations, migrationSql } from './migrations'

let db: Database.Database | null = null

function dbPath(): string {
  // Shares the data-directory resolution with config.ts, so a portable install
  // (or an E2E run) keeps the database and the config together.
  return join(dataDir(), 'app.db')
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    migrate(db)
  }
  return db
}

/**
 * Schema version lives in db/migrations.ts along with the planning rules, so
 * that the migration logic stays testable without the native driver.
 */
export function getSchemaVersion(): number {
  return getDb().pragma('user_version', { simple: true }) as number
}

/** Column names of a table, or undefined when the table does not exist. */
function tableColumns(db: Database.Database, table: string): string[] | undefined {
  const exists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(table)
  if (!exists) return undefined
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.map((r) => r.name)
}

function migrate(db: Database.Database): void {
  const from = db.pragma('user_version', { simple: true }) as number

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'local',
      source_uri TEXT NOT NULL DEFAULT '',
      root_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      language TEXT DEFAULT '',
      node_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      indexed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS index_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      phase TEXT,
      progress REAL DEFAULT 0,
      error TEXT,
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      arxiv_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      authors TEXT NOT NULL DEFAULT '',
      summary TEXT DEFAULT '',
      published TEXT DEFAULT '',
      pdf_path TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concept_links (
      id TEXT PRIMARY KEY,
      paper_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      anchor_text TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (paper_id) REFERENCES papers(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS paper_highlights (
      id TEXT PRIMARY KEY,
      paper_id TEXT NOT NULL,
      page INTEGER NOT NULL DEFAULT 1,
      text TEXT NOT NULL,
      color TEXT DEFAULT 'yellow',
      created_at TEXT NOT NULL,
      FOREIGN KEY (paper_id) REFERENCES papers(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      steps_json TEXT DEFAULT '',
      node_refs TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS architecture_summaries (
      project_id TEXT PRIMARY KEY,
      summary_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      concept TEXT NOT NULL,
      principle TEXT NOT NULL DEFAULT '',
      tradeoffs TEXT NOT NULL DEFAULT '',
      examples TEXT NOT NULL DEFAULT '',
      related_node_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS interview_questions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      problem TEXT NOT NULL,
      context TEXT NOT NULL DEFAULT '',
      answer TEXT NOT NULL DEFAULT '',
      related_concepts TEXT NOT NULL DEFAULT '[]',
      knowledge_ids TEXT NOT NULL DEFAULT '[]',
      related_node_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- v3: learning state -----------------------------------------------------

    -- B1: per-node reading progress, so the workbench can answer
    -- "what have I actually learned here?".
    CREATE TABLE IF NOT EXISTS learn_progress (
      project_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unseen',
      confidence INTEGER NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      last_seen_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (project_id, node_id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- B2: notes pinned to a node and/or a line range of a file.
    CREATE TABLE IF NOT EXISTS code_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      node_id TEXT DEFAULT '',
      file_path TEXT NOT NULL,
      line_start INTEGER,
      line_end INTEGER,
      body TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- B3: spaced-repetition cards + their review history.
    CREATE TABLE IF NOT EXISTS review_cards (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      node_ids TEXT NOT NULL DEFAULT '[]',
      due_at TEXT NOT NULL,
      interval_days REAL NOT NULL DEFAULT 0,
      ease REAL NOT NULL DEFAULT 2.5,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS review_logs (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      interval_days REAL NOT NULL DEFAULT 0,
      reviewed_at TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES review_cards(id)
    );

    -- B5: LLM code/architecture review findings.
    CREATE TABLE IF NOT EXISTS review_findings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      kind TEXT NOT NULL DEFAULT 'debt',
      title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      file_path TEXT DEFAULT '',
      line INTEGER,
      node_id TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    -- B6: generated learning paths for a target goal.
    CREATE TABLE IF NOT EXISTS learning_paths (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      goal TEXT NOT NULL,
      steps_json TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'heuristic',
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `)

  // ── Additive migrations ──
  // A database created by an earlier version already has its tables, so the
  // CREATE TABLE statements above are no-ops for it and new columns must be
  // added here. The rules live in db/migrations.ts.
  const steps = planMigrations(from, {
    chat_messages: tableColumns(db, 'chat_messages'),
  })
  for (const step of steps) {
    db.exec(migrationSql(step))
    console.log(`[db] added column ${step.table}.${step.column}`)
  }

  // Indexes the hot query paths rely on.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_project
      ON chat_messages(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_project
      ON knowledge_nodes(project_id);
    CREATE INDEX IF NOT EXISTS idx_interview_questions_project
      ON interview_questions(project_id);
    CREATE INDEX IF NOT EXISTS idx_learn_progress_project
      ON learn_progress(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_code_notes_project
      ON code_notes(project_id, file_path);
    CREATE INDEX IF NOT EXISTS idx_review_cards_due
      ON review_cards(project_id, due_at);
    CREATE INDEX IF NOT EXISTS idx_review_findings_project
      ON review_findings(project_id, severity);
  `)

  if (from !== SCHEMA_VERSION) {
    db.pragma(`user_version = ${SCHEMA_VERSION}`)
    console.log(`[db] schema migrated: v${from} → v${SCHEMA_VERSION}`)
  }
}

export interface ProjectRow {
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

export function listProjects(): ProjectRow[] {
  const db = getDb()
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as ProjectRow[]
}

export function getProject(id: string): ProjectRow | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
}

export function insertProject(p: Omit<ProjectRow, 'created_at' | 'node_count' | 'language' | 'indexed_at'>): ProjectRow {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO projects (id, name, slug, source_type, source_uri, root_path, status, language, node_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '', 0, ?)
  `).run(p.id, p.name, p.slug, p.source_type, p.source_uri, p.root_path, p.status, now)
  return getProject(p.id)!
}

export function updateProjectStatus(id: string, status: ProjectRow['status'], nodeCount?: number): void {
  const db = getDb()
  if (nodeCount !== undefined) {
    db.prepare('UPDATE projects SET status = ?, node_count = ?, indexed_at = ? WHERE id = ?')
      .run(status, nodeCount, new Date().toISOString(), id)
  } else {
    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, id)
  }
}

/**
 * Reset projects left in `indexing` by a crash or a kill.
 *
 * Indexing only ever runs inside this process, so any row still marked
 * `indexing` when the app starts is stale — without this the project could never
 * be indexed again (the IPC guard rejects a second run).
 *
 * Returns the ids that were reset.
 */
export function resetStaleIndexingStatus(): string[] {
  const db = getDb()
  const rows = db.prepare("SELECT id FROM projects WHERE status = 'indexing'").all() as Array<{ id: string }>
  if (rows.length === 0) return []
  db.prepare("UPDATE projects SET status = 'pending' WHERE status = 'indexing'").run()
  return rows.map((r) => r.id)
}

export function removeProject(id: string): void {  const db = getDb()
  db.prepare('DELETE FROM index_jobs WHERE project_id = ?').run(id)
  db.prepare('DELETE FROM concept_links WHERE project_id = ?').run(id)
  db.prepare('DELETE FROM architecture_summaries WHERE project_id = ?').run(id)
  db.prepare('DELETE FROM knowledge_nodes WHERE project_id = ?').run(id)
  db.prepare('DELETE FROM interview_questions WHERE project_id = ?').run(id)
  db.prepare('DELETE FROM chat_messages WHERE project_id = ?').run(id)
  db.prepare('DELETE FROM projects WHERE id = ?').run(id)
}

/* ──────────── Papers ──────────── */

export interface PaperRow {
  id: string
  arxiv_id: string
  title: string
  authors: string
  summary: string
  published: string
  pdf_path: string
  notes: string
  tags: string
  created_at: string
}

export function listPapers(): PaperRow[] {
  return getDb().prepare('SELECT * FROM papers ORDER BY created_at DESC').all() as PaperRow[]
}

export function getPaper(id: string): PaperRow | undefined {
  return getDb().prepare('SELECT * FROM papers WHERE id = ?').get(id) as PaperRow | undefined
}

export function getPaperByArxivId(arxivId: string): PaperRow | undefined {
  return getDb().prepare('SELECT * FROM papers WHERE arxiv_id = ?').get(arxivId) as PaperRow | undefined
}

export function insertPaper(p: Omit<PaperRow, 'id' | 'created_at'>): PaperRow {
  const db = getDb()
  const id = `paper-${Date.now()}`
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO papers (id, arxiv_id, title, authors, summary, published, pdf_path, notes, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, p.arxiv_id, p.title, p.authors, p.summary, p.published, p.pdf_path, p.notes, p.tags, now)
  return getPaper(id)!
}

export function updatePaper(id: string, patch: Partial<Pick<PaperRow, 'notes' | 'tags' | 'pdf_path'>>): PaperRow | undefined {
  const db = getDb()
  const sets: string[] = []
  const vals: unknown[] = []
  if (patch.notes !== undefined) { sets.push('notes = ?'); vals.push(patch.notes) }
  if (patch.tags !== undefined) { sets.push('tags = ?'); vals.push(patch.tags) }
  if (patch.pdf_path !== undefined) { sets.push('pdf_path = ?'); vals.push(patch.pdf_path) }
  if (sets.length === 0) return getPaper(id)
  vals.push(id)
  db.prepare(`UPDATE papers SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return getPaper(id)
}

export function removePaper(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM concept_links WHERE paper_id = ?').run(id)
  db.prepare('DELETE FROM papers WHERE id = ?').run(id)
}

/* ──────────── Concept Links ──────────── */

export interface ConceptLinkRow {
  id: string
  paper_id: string
  project_id: string
  node_id: string
  anchor_text: string
  note: string
  created_at: string
}

export function listConceptLinks(projectId?: string, paperId?: string): ConceptLinkRow[] {
  if (projectId && paperId) {
    return getDb().prepare('SELECT * FROM concept_links WHERE project_id = ? AND paper_id = ? ORDER BY created_at DESC')
      .all(projectId, paperId) as ConceptLinkRow[]
  }
  if (projectId) {
    return getDb().prepare('SELECT * FROM concept_links WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId) as ConceptLinkRow[]
  }
  return getDb().prepare('SELECT * FROM concept_links ORDER BY created_at DESC').all() as ConceptLinkRow[]
}

export function insertConceptLink(link: Omit<ConceptLinkRow, 'id' | 'created_at'>): ConceptLinkRow {
  const db = getDb()
  const id = `cl-${Date.now()}`
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO concept_links (id, paper_id, project_id, node_id, anchor_text, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, link.paper_id, link.project_id, link.node_id, link.anchor_text, link.note, now)
  return db.prepare('SELECT * FROM concept_links WHERE id = ?').get(id) as ConceptLinkRow
}

export function removeConceptLink(id: string): void {
  getDb().prepare('DELETE FROM concept_links WHERE id = ?').run(id)
}

/* ──────────── Paper Highlights ──────────── */

export interface PaperHighlightRow {
  id: string
  paper_id: string
  page: number
  text: string
  color: string
  created_at: string
}

export function listPaperHighlights(paperId: string): PaperHighlightRow[] {
  return getDb().prepare('SELECT * FROM paper_highlights WHERE paper_id = ? ORDER BY page, created_at')
    .all(paperId) as PaperHighlightRow[]
}

export function insertPaperHighlight(h: Omit<PaperHighlightRow, 'id' | 'created_at'>): PaperHighlightRow {
  const id = `hl-${Date.now()}`
  const now = new Date().toISOString()
  getDb().prepare(`
    INSERT INTO paper_highlights (id, paper_id, page, text, color, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, h.paper_id, h.page, h.text, h.color, now)
  return getDb().prepare('SELECT * FROM paper_highlights WHERE id = ?').get(id) as PaperHighlightRow
}

export function removePaperHighlight(id: string): void {
  getDb().prepare('DELETE FROM paper_highlights WHERE id = ?').run(id)
}

/* ──────────── Chat History ──────────── */

export interface ChatMessageRow {
  id: string
  project_id: string
  role: string
  content: string
  steps_json: string
  /** JSON array of graph node ids cited by an assistant answer. */
  node_refs: string
  created_at: string
}

export function listChatMessages(projectId: string, limit = 50): ChatMessageRow[] {
  return getDb().prepare(
    'SELECT * FROM chat_messages WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(projectId, limit).reverse() as ChatMessageRow[]
}

export function insertChatMessage(
  m: Omit<ChatMessageRow, 'id' | 'created_at' | 'node_refs'> & { node_refs?: string },
): ChatMessageRow {
  const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()
  getDb().prepare(`
    INSERT INTO chat_messages (id, project_id, role, content, steps_json, node_refs, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, m.project_id, m.role, m.content, m.steps_json, m.node_refs ?? '[]', now)
  return getDb().prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as ChatMessageRow
}

export function clearChatMessages(projectId: string): void {
  getDb().prepare('DELETE FROM chat_messages WHERE project_id = ?').run(projectId)
}

/* ──────────── Architecture / Knowledge / Interview ──────────── */

export function getArchitectureSummary(projectId: string): ArchitectureSummary | null {
  const row = getDb().prepare('SELECT summary_json FROM architecture_summaries WHERE project_id = ?').get(projectId) as
    | { summary_json: string }
    | undefined
  if (!row) return null
  try {
    return JSON.parse(row.summary_json) as ArchitectureSummary
  } catch {
    return null
  }
}

export function replaceArchitectureSummary(projectId: string, summary: ArchitectureSummary): void {
  const now = new Date().toISOString()
  getDb().prepare(`
    INSERT INTO architecture_summaries (project_id, summary_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET summary_json = excluded.summary_json, updated_at = excluded.updated_at
  `).run(projectId, JSON.stringify({ ...summary, projectId }), now)
}

export function listKnowledgeNodes(projectId: string): KnowledgeNode[] {
  const rows = getDb().prepare(
    'SELECT * FROM knowledge_nodes WHERE project_id = ? ORDER BY created_at ASC',
  ).all(projectId) as Array<{
    id: string
    project_id: string
    concept: string
    principle: string
    tradeoffs: string
    examples: string
    related_node_ids: string
    created_at: string
  }>
  return rows.map(r => ({
    id: r.id,
    projectId: r.project_id,
    concept: r.concept,
    principle: r.principle,
    tradeoffs: r.tradeoffs,
    examples: r.examples,
    relatedNodeIds: safeJsonArray(r.related_node_ids),
    createdAt: r.created_at,
  }))
}

export function replaceKnowledgeNodes(
  projectId: string,
  nodes: Array<Omit<KnowledgeNode, 'id' | 'createdAt'> & { id?: string }>,
): KnowledgeNode[] {
  const db = getDb()
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM knowledge_nodes WHERE project_id = ?').run(projectId)
    const insert = db.prepare(`
      INSERT INTO knowledge_nodes (id, project_id, concept, principle, tradeoffs, examples, related_node_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const n of nodes) {
      const id = n.id || `kn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      insert.run(
        id,
        projectId,
        n.concept,
        n.principle || '',
        n.tradeoffs || '',
        n.examples || '',
        JSON.stringify(n.relatedNodeIds || []),
        now,
      )
    }
  })
  tx()
  return listKnowledgeNodes(projectId)
}

export function listQuestions(projectId: string): InterviewQuestion[] {
  const rows = getDb().prepare(
    'SELECT * FROM interview_questions WHERE project_id = ? ORDER BY created_at ASC',
  ).all(projectId) as Array<{
    id: string
    project_id: string
    problem: string
    context: string
    answer: string
    related_concepts: string
    knowledge_ids: string
    related_node_ids: string
    created_at: string
  }>
  return rows.map(r => ({
    id: r.id,
    projectId: r.project_id,
    problem: r.problem,
    context: r.context,
    answer: r.answer,
    relatedConcepts: safeJsonArray(r.related_concepts),
    knowledgeIds: safeJsonArray(r.knowledge_ids),
    relatedNodeIds: safeJsonArray(r.related_node_ids),
    createdAt: r.created_at,
  }))
}

export function replaceQuestions(
  projectId: string,
  questions: Array<Omit<InterviewQuestion, 'id' | 'createdAt'> & { id?: string }>,
): InterviewQuestion[] {
  const db = getDb()
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM interview_questions WHERE project_id = ?').run(projectId)
    const insert = db.prepare(`
      INSERT INTO interview_questions
        (id, project_id, problem, context, answer, related_concepts, knowledge_ids, related_node_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const q of questions) {
      const id = q.id || `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      insert.run(
        id,
        projectId,
        q.problem,
        q.context || '',
        q.answer || '',
        JSON.stringify(q.relatedConcepts || []),
        JSON.stringify(q.knowledgeIds || []),
        JSON.stringify(q.relatedNodeIds || []),
        now,
      )
    }
  })
  tx()
  return listQuestions(projectId)
}

function safeJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

/* ──────────── B1: learning progress ──────────── */

export type LearnStatus = 'unseen' | 'reading' | 'mastered'

export interface LearnProgressRow {
  project_id: string
  node_id: string
  status: LearnStatus
  confidence: number
  review_count: number
  last_seen_at: string | null
  updated_at: string
}

export function listLearnProgress(projectId: string): LearnProgressRow[] {
  return getDb().prepare(
    'SELECT * FROM learn_progress WHERE project_id = ?',
  ).all(projectId) as LearnProgressRow[]
}

/** Upsert one node's progress; returns the stored row. */
export function setLearnProgress(
  projectId: string,
  nodeId: string,
  status: LearnStatus,
  confidence?: number,
): LearnProgressRow {
  const db = getDb()
  const now = new Date().toISOString()
  const existing = db.prepare(
    'SELECT * FROM learn_progress WHERE project_id = ? AND node_id = ?',
  ).get(projectId, nodeId) as LearnProgressRow | undefined

  const isReview = status !== 'unseen'
  const nextConfidence = confidence ?? existing?.confidence ?? (status === 'mastered' ? 5 : status === 'reading' ? 2 : 0)
  const reviewCount = (existing?.review_count ?? 0) + (isReview ? 1 : 0)

  db.prepare(`
    INSERT INTO learn_progress (project_id, node_id, status, confidence, review_count, last_seen_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, node_id) DO UPDATE SET
      status = excluded.status,
      confidence = excluded.confidence,
      review_count = excluded.review_count,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
  `).run(projectId, nodeId, status, nextConfidence, reviewCount, isReview ? now : existing?.last_seen_at ?? null, now)

  return db.prepare(
    'SELECT * FROM learn_progress WHERE project_id = ? AND node_id = ?',
  ).get(projectId, nodeId) as LearnProgressRow
}

export function clearLearnProgress(projectId: string): void {
  getDb().prepare('DELETE FROM learn_progress WHERE project_id = ?').run(projectId)
}

/* ──────────── B2: code notes ──────────── */

export interface CodeNoteRow {
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

export interface CodeNoteInput {
  project_id: string
  node_id?: string
  file_path: string
  line_start?: number | null
  line_end?: number | null
  body: string
  tags?: string
}

export function listCodeNotes(projectId: string, filter?: { filePath?: string; nodeId?: string }): CodeNoteRow[] {
  const clauses = ['project_id = ?']
  const params: Array<string> = [projectId]
  if (filter?.filePath) { clauses.push('file_path = ?'); params.push(filter.filePath) }
  if (filter?.nodeId) { clauses.push('node_id = ?'); params.push(filter.nodeId) }
  return getDb().prepare(
    `SELECT * FROM code_notes WHERE ${clauses.join(' AND ')} ORDER BY file_path ASC, line_start ASC, created_at ASC`,
  ).all(...params) as CodeNoteRow[]
}

export function insertCodeNote(note: CodeNoteInput): CodeNoteRow {
  const db = getDb()
  const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO code_notes
      (id, project_id, node_id, file_path, line_start, line_end, body, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, note.project_id, note.node_id ?? '', note.file_path,
    note.line_start ?? null, note.line_end ?? null, note.body, note.tags ?? '', now, now,
  )
  return db.prepare('SELECT * FROM code_notes WHERE id = ?').get(id) as CodeNoteRow
}

export function updateCodeNote(id: string, patch: { body?: string; tags?: string }): CodeNoteRow | undefined {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM code_notes WHERE id = ?').get(id) as CodeNoteRow | undefined
  if (!existing) return undefined
  db.prepare('UPDATE code_notes SET body = ?, tags = ?, updated_at = ? WHERE id = ?')
    .run(patch.body ?? existing.body, patch.tags ?? existing.tags, new Date().toISOString(), id)
  return db.prepare('SELECT * FROM code_notes WHERE id = ?').get(id) as CodeNoteRow
}

export function removeCodeNote(id: string): void {
  getDb().prepare('DELETE FROM code_notes WHERE id = ?').run(id)
}

/* ──────────── B3: review cards ──────────── */

export interface ReviewCardRow {
  id: string
  project_id: string
  source_type: 'knowledge' | 'question' | 'note'
  source_id: string
  front: string
  back: string
  node_ids: string
  due_at: string
  interval_days: number
  ease: number
  reps: number
  lapses: number
  last_reviewed_at: string | null
  created_at: string
}

export interface ReviewCardInput {
  project_id: string
  source_type: ReviewCardRow['source_type']
  source_id: string
  front: string
  back: string
  node_ids?: string[]
}

export function listReviewCards(projectId: string): ReviewCardRow[] {
  return getDb().prepare(
    'SELECT * FROM review_cards WHERE project_id = ? ORDER BY due_at ASC',
  ).all(projectId) as ReviewCardRow[]
}

export function countReviewCards(projectId: string): number {
  const row = getDb().prepare(
    'SELECT COUNT(*) AS n FROM review_cards WHERE project_id = ?',
  ).get(projectId) as { n: number }
  return row?.n ?? 0
}

/**
 * Insert cards that do not exist yet (matched by source_type + source_id).
 * Returns the number of new cards, so callers can report "already generated".
 */
export function insertReviewCardsIfMissing(cards: ReviewCardInput[]): number {
  const db = getDb()
  const now = new Date().toISOString()
  const exists = db.prepare(
    'SELECT 1 FROM review_cards WHERE project_id = ? AND source_type = ? AND source_id = ?',
  )
  const insert = db.prepare(`
    INSERT INTO review_cards
      (id, project_id, source_type, source_id, front, back, node_ids, due_at, interval_days, ease, reps, lapses, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 2.5, 0, 0, ?)
  `)

  let added = 0
  const tx = db.transaction(() => {
    for (const card of cards) {
      if (exists.get(card.project_id, card.source_type, card.source_id)) continue
      insert.run(
        `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        card.project_id, card.source_type, card.source_id,
        card.front, card.back, JSON.stringify(card.node_ids ?? []),
        now, now,
      )
      added += 1
    }
  })
  tx()
  return added
}

export function getReviewCard(id: string): ReviewCardRow | undefined {
  return getDb().prepare('SELECT * FROM review_cards WHERE id = ?').get(id) as ReviewCardRow | undefined
}

export function updateReviewCardSchedule(
  id: string,
  patch: { due_at: string; interval_days: number; ease: number; reps: number; lapses: number; last_reviewed_at: string },
): void {
  getDb().prepare(`
    UPDATE review_cards
    SET due_at = ?, interval_days = ?, ease = ?, reps = ?, lapses = ?, last_reviewed_at = ?
    WHERE id = ?
  `).run(patch.due_at, patch.interval_days, patch.ease, patch.reps, patch.lapses, patch.last_reviewed_at, id)
}

export function insertReviewLog(cardId: string, projectId: string, rating: number, intervalDays: number): void {
  getDb().prepare(`
    INSERT INTO review_logs (id, card_id, project_id, rating, interval_days, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    cardId, projectId, rating, intervalDays, new Date().toISOString(),
  )
}

export interface ReviewLogRow {
  id: string
  card_id: string
  project_id: string
  rating: number
  interval_days: number
  reviewed_at: string
}

export function listReviewLogs(projectId: string, limit = 500): ReviewLogRow[] {
  return getDb().prepare(
    'SELECT * FROM review_logs WHERE project_id = ? ORDER BY reviewed_at DESC LIMIT ?',
  ).all(projectId, limit) as ReviewLogRow[]
}

export function removeReviewCardsForProject(projectId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM review_logs WHERE project_id = ?').run(projectId)
  db.prepare('DELETE FROM review_cards WHERE project_id = ?').run(projectId)
}

/* ──────────── B5: review findings ──────────── */

export interface ReviewFindingRow {
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

export interface ReviewFindingInput {
  severity: ReviewFindingRow['severity']
  kind: ReviewFindingRow['kind']
  title: string
  detail?: string
  file_path?: string
  line?: number | null
  node_id?: string
}

export function listReviewFindings(projectId: string): ReviewFindingRow[] {
  return getDb().prepare(
    'SELECT * FROM review_findings WHERE project_id = ? ORDER BY created_at DESC',
  ).all(projectId) as ReviewFindingRow[]
}

/** Replace the stored findings for a project (a re-run supersedes the old set). */
export function replaceReviewFindings(projectId: string, findings: ReviewFindingInput[]): ReviewFindingRow[] {
  const db = getDb()
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM review_findings WHERE project_id = ?').run(projectId)
    const insert = db.prepare(`
      INSERT INTO review_findings
        (id, project_id, severity, kind, title, detail, file_path, line, node_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const f of findings) {
      insert.run(
        `find-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        projectId, f.severity, f.kind, f.title, f.detail ?? '',
        f.file_path ?? '', f.line ?? null, f.node_id ?? '', now,
      )
    }
  })
  tx()
  return listReviewFindings(projectId)
}

export function removeReviewFindings(projectId: string): void {
  getDb().prepare('DELETE FROM review_findings WHERE project_id = ?').run(projectId)
}

/* ──────────── B6: learning paths ──────────── */

export interface LearningStep {
  order: number
  title: string
  why?: string
  nodeIds?: string[]
  files?: string[]
}

export interface LearningPathRow {
  id: string
  project_id: string
  goal: string
  steps_json: string
  source: string
  created_at: string
}

export function listLearningPaths(projectId: string): Array<Omit<LearningPathRow, 'steps_json'> & { steps: LearningStep[] }> {
  const rows = getDb().prepare(
    'SELECT * FROM learning_paths WHERE project_id = ? ORDER BY created_at DESC',
  ).all(projectId) as LearningPathRow[]
  return rows.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    goal: r.goal,
    source: r.source,
    created_at: r.created_at,
    steps: parseSteps(r.steps_json),
  }))
}

function parseSteps(raw: string): LearningStep[] {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? (v as LearningStep[]) : []
  } catch {
    return []
  }
}

export function insertLearningPath(
  projectId: string,
  goal: string,
  steps: LearningStep[],
  source: 'heuristic' | 'llm',
): void {
  getDb().prepare(`
    INSERT INTO learning_paths (id, project_id, goal, steps_json, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `path-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId, goal, JSON.stringify(steps), source, new Date().toISOString(),
  )
}

export function removeLearningPaths(projectId: string): void {
  getDb().prepare('DELETE FROM learning_paths WHERE project_id = ?').run(projectId)
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
