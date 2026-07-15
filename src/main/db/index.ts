/**
 * SQLite database layer — architecture.md §6.2
 *
 * Manages Fieldguide extension data: projects, index_jobs.
 * Graph nodes/edges are NOT stored here (UA knowledge-graph.json is the authority).
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

let db: Database.Database | null = null

function dbPath(): string {
  const dir = join(app.getPath('appData'), 'Fieldguide')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, 'app.db')
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

function migrate(db: Database.Database): void {
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
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `)
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

export function removeProject(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM index_jobs WHERE project_id = ?').run(id)
  db.prepare('DELETE FROM concept_links WHERE project_id = ?').run(id)
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
  created_at: string
}

export function listChatMessages(projectId: string, limit = 50): ChatMessageRow[] {
  return getDb().prepare(
    'SELECT * FROM chat_messages WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(projectId, limit).reverse() as ChatMessageRow[]
}

export function insertChatMessage(m: Omit<ChatMessageRow, 'id' | 'created_at'>): ChatMessageRow {
  const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()
  getDb().prepare(`
    INSERT INTO chat_messages (id, project_id, role, content, steps_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, m.project_id, m.role, m.content, m.steps_json, now)
  return getDb().prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as ChatMessageRow
}

export function clearChatMessages(projectId: string): void {
  getDb().prepare('DELETE FROM chat_messages WHERE project_id = ?').run(projectId)
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
