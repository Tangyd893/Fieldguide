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
  db.prepare('DELETE FROM projects WHERE id = ?').run(id)
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
