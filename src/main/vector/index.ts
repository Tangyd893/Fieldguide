/**
 * Vector storage & retrieval — SQLite-backed paper RAG.
 *
 * Stores paper chunks + their embeddings in SQLite (`paper_chunks` table).
 * Embedding vectors are stored as JSON arrays (Float32 → number[]).
 * Search uses pure TypeScript cosine similarity over loaded embeddings.
 *
 * Architecture.md §九:
 *   - Chunks organized by paperId
 *   - 512 token chunks, 64 token overlap
 *   - OpenAI-compatible /embeddings endpoint
 */
import { getDb } from '../db'
import { extractPdfText, chunkText, type PaperChunk } from './chunk'
import { generateEmbeddings, cosineSimilarity } from './embed'
import type { PaperRow } from '../db'

// ─── DB Schema ───

/** Ensure paper_chunks table exists (idempotent migration) */
function ensureChunksTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS paper_chunks (
      id TEXT PRIMARY KEY,
      paper_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      token_count INTEGER NOT NULL,
      embedding_json TEXT,
      char_start INTEGER NOT NULL DEFAULT 0,
      char_end INTEGER NOT NULL DEFAULT 0,
      indexed_at TEXT,
      FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper
      ON paper_chunks(paper_id, chunk_index);
  `)
}

export interface PaperChunkRow {
  id: string
  paper_id: string
  chunk_index: number
  text: string
  token_count: number
  embedding_json: string | null
  char_start: number
  char_end: number
  indexed_at: string | null
}

export interface ChunkSearchResult {
  chunk: PaperChunkRow
  /** Cosine similarity score (0–1, higher = more relevant) */
  score: number
}

// ─── Indexing ───

export interface IndexPaperResult {
  paperId: string
  chunkCount: number
  errors: string[]
}

/**
 * Index a paper: extract PDF text → chunk → embed → store.
 *
 * Returns after all chunks are processed. If the paper has no PDF,
 * returns with chunkCount=0.
 */
export async function indexPaper(paper: PaperRow): Promise<IndexPaperResult> {
  ensureChunksTable()

  const errors: string[] = []

  // Check if already indexed
  const existing = countChunks(paper.id)
  if (existing > 0) {
    // Re-index: clear existing chunks
    getDb().prepare('DELETE FROM paper_chunks WHERE paper_id = ?').run(paper.id)
  }

  if (!paper.pdf_path) {
    return { paperId: paper.id, chunkCount: 0, errors: ['No PDF path for this paper'] }
  }

  // 1. Extract text from PDF
  let text: string
  try {
    text = await extractPdfText(paper.pdf_path)
  } catch (err) {
    return { paperId: paper.id, chunkCount: 0, errors: [`PDF extraction failed: ${String(err)}`] }
  }

  if (!text || text.trim().length === 0) {
    return { paperId: paper.id, chunkCount: 0, errors: ['PDF contained no extractable text'] }
  }

  // 2. Chunk
  const chunks = chunkText(text)
  if (chunks.length === 0) {
    return { paperId: paper.id, chunkCount: 0, errors: ['No chunks produced'] }
  }

  // 3. Generate embeddings in batches
  const chunkTexts = chunks.map(c => c.text)
  let embeddings: number[][]
  try {
    embeddings = await generateEmbeddings(chunkTexts)
  } catch (err) {
    return { paperId: paper.id, chunkCount: 0, errors: [`Embedding generation failed: ${String(err)}`] }
  }

  if (embeddings.length !== chunks.length) {
    errors.push(`Embedding count mismatch: got ${embeddings.length}, expected ${chunks.length}`)
  }

  // 4. Store
  const now = new Date().toISOString()
  const insert = getDb().prepare(`
    INSERT INTO paper_chunks (id, paper_id, chunk_index, text, token_count, embedding_json, char_start, char_end, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const tx = getDb().transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const emb = embeddings[i]
      const id = `chunk-${paper.id}-${chunk.index}`
      insert.run(
        id,
        paper.id,
        chunk.index,
        chunk.text,
        chunk.tokenCount,
        emb ? JSON.stringify(emb) : null,
        chunk.charStart,
        chunk.charEnd,
        now,
      )
    }
  })

  tx()

  return {
    paperId: paper.id,
    chunkCount: chunks.length,
    errors,
  }
}

// ─── Query ───

/**
 * Search paper chunks by semantic similarity.
 *
 * 1. Generate embedding for query
 * 2. Load all chunk embeddings for the paper (or all papers)
 * 3. Compute cosine similarity
 * 4. Return top-k results
 */
export async function queryPaper(
  query: string,
  paperId?: string,
  topK: number = 5,
): Promise<ChunkSearchResult[]> {
  ensureChunksTable()

  // Generate query embedding
  const [queryEmb] = await generateEmbeddings([query])
  if (!queryEmb || queryEmb.length === 0) {
    return []
  }

  // Load chunks (with embeddings)
  let rows: PaperChunkRow[]
  if (paperId) {
    rows = getDb()
      .prepare('SELECT * FROM paper_chunks WHERE paper_id = ? AND embedding_json IS NOT NULL')
      .all(paperId) as PaperChunkRow[]
  } else {
    rows = getDb()
      .prepare('SELECT * FROM paper_chunks WHERE embedding_json IS NOT NULL')
      .all() as PaperChunkRow[]
  }

  if (rows.length === 0) return []

  // Compute similarities
  const scored: ChunkSearchResult[] = []
  for (const row of rows) {
    let emb: number[]
    try {
      emb = JSON.parse(row.embedding_json!)
    } catch {
      continue
    }
    if (!emb || emb.length === 0) continue

    const score = cosineSimilarity(queryEmb, emb)
    scored.push({ chunk: row, score })
  }

  // Sort descending by score, take top K
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}

// ─── Helpers ───

export function countChunks(paperId: string): number {
  ensureChunksTable()
  const row = getDb()
    .prepare('SELECT COUNT(*) as cnt FROM paper_chunks WHERE paper_id = ?')
    .get(paperId) as { cnt: number } | undefined
  return row?.cnt ?? 0
}

export function getChunks(paperId: string): PaperChunkRow[] {
  ensureChunksTable()
  return getDb()
    .prepare('SELECT * FROM paper_chunks WHERE paper_id = ? ORDER BY chunk_index')
    .all(paperId) as PaperChunkRow[]
}

export function removeChunks(paperId: string): void {
  ensureChunksTable()
  getDb().prepare('DELETE FROM paper_chunks WHERE paper_id = ?').run(paperId)
}

export function getIndexStats(): { totalPapers: number; totalChunks: number } {
  ensureChunksTable()
  const papers = getDb()
    .prepare('SELECT COUNT(DISTINCT paper_id) as cnt FROM paper_chunks')
    .get() as { cnt: number }
  const chunks = getDb()
    .prepare('SELECT COUNT(*) as cnt FROM paper_chunks')
    .get() as { cnt: number }
  return { totalPapers: papers.cnt, totalChunks: chunks.cnt }
}
