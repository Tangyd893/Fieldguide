/**
 * UA-backed node search — lazily loads UA `SearchEngine` via dynamic import
 * (ESM-only package), then fuses it with a local lexical channel.
 *
 * Mirrors src/main/ua/client.ts loadCore() — never static-require @understand-anything/core.
 *
 * Lives in the UA integration layer because it is a graph-query capability shared by
 * the coach agent (agent/tools.ts) and the shell IPC surface (graph:search).
 *
 * Retrieval strategy (measured in docs/eval/agent-baseline.md):
 *
 *   The semantic engine alone is language-biased — Chinese questions asked against
 *   an English-summarised graph retrieved 12.8% Recall@5 versus 68.0% for keyword
 *   queries. Every query therefore runs through **two** channels whose rankings are
 *   fused by reciprocal rank fusion: the semantic engine (paraphrase recall) and a
 *   local BM25 channel with CJK bigrams + curated zh→en term expansion (exact
 *   identifier/term recall). RRF needs no score calibration between channels, which
 *   is what makes the combination defensible instead of a tuned guess.
 */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { buildLexicalIndex, lexicalSearch, rrfFuse, type LexicalIndex } from './lexical'

export interface SearchableNode {
  id: string
  type: string
  name: string
  filePath?: string
  lineRange?: [number, number]
  summary: string
  tags: string[]
  complexity: 'simple' | 'moderate' | 'complex'
  languageNotes?: string
}

export interface SearchHit {
  nodeId: string
  score: number
}

/**
 * Which matcher actually produced a result set.
 *
 * `hybrid` is the normal path (semantic ⊕ lexical); `lexical` means the semantic
 * engine could not load and BM25 carried the query; `ua` is kept for callers that
 * ask for the engine alone; `substring` is the plain matcher (explicit fallback or
 * an empty query).
 */
export type SearchBackend = 'hybrid' | 'lexical' | 'ua' | 'substring'

export interface DetailedSearchResult {
  hits: SearchHit[]
  backend: SearchBackend
}

export interface GraphSearchEngine {
  search(query: string, options?: { limit?: number }): SearchHit[]
}

type SearchEngineCtor = new (nodes: SearchableNode[]) => GraphSearchEngine

let SearchEngineClass: SearchEngineCtor | null = null
let loadFailed = false

function getAppRoot(): string {
  try {
    // Lazy require so vitest / plain node can still use substring fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- electron is only available at runtime
    const { app } = require('electron') as typeof import('electron')
    if (app?.isPackaged) return app.getAppPath()
  } catch {
    /* not running under Electron */
  }
  return process.cwd()
}

async function resolveCoreModule(): Promise<{ SearchEngine: SearchEngineCtor }> {
  const appRoot = getAppRoot()
  const require_ = createRequire(join(appRoot, 'package.json'))
  try {
    return await import(pathToFileURL(require_.resolve('@understand-anything/core')).href)
  } catch {
    const uaCorePath = join(
      process.cwd(),
      '..',
      'Understand-Anything',
      'understand-anything-plugin',
      'packages',
      'core',
      'dist',
      'index.js',
    )
    return await import(pathToFileURL(uaCorePath).href)
  }
}

export async function loadSearchEngineClass(): Promise<SearchEngineCtor | null> {
  if (SearchEngineClass) return SearchEngineClass
  if (loadFailed) return null
  try {
    const core = await resolveCoreModule()
    SearchEngineClass = core.SearchEngine
    return SearchEngineClass
  } catch {
    loadFailed = true
    return null
  }
}

/** True when the UA semantic SearchEngine loaded successfully. */
export async function isSemanticSearchAvailable(): Promise<boolean> {
  return (await loadSearchEngineClass()) !== null
}

/**
 * Normalize FG graph nodes for fuzzy search (name/summary/tags at top level).
 *
 * Lives here (not in agent/context-packer) so the search subsystem and the
 * evaluation harness can use it without pulling in the agent → db → native
 * better-sqlite3 import chain.
 */
export function toSearchableNodes(nodes: Array<{
  id: string
  type?: string
  name?: string
  label?: string
  filePath?: string
  lineRange?: [number, number]
  summary?: string
  tags?: string[]
  complexity?: string
  metadata?: Record<string, unknown>
}>): SearchableNode[] {
  return nodes.map((n): SearchableNode => {
    const summary = String(
      n.metadata?.summary
      || (typeof n.summary === 'string' ? n.summary : '')
      || '',
    )
    const tags = (n.metadata?.tags as string[] | undefined)
      || (Array.isArray(n.tags) ? (n.tags as string[]) : [])
      || []
    const complexity = (n.metadata?.complexity as SearchableNode['complexity'] | undefined)
      || (n.complexity as SearchableNode['complexity'] | undefined)
      || 'moderate'
    return {
      id: n.id,
      type: n.type || 'file',
      name: String(n.name || n.label || n.id),
      filePath: n.filePath,
      lineRange: n.lineRange,
      summary,
      tags,
      complexity,
      languageNotes: typeof n.metadata?.languageNotes === 'string'
        ? n.metadata.languageNotes
        : undefined,
    }
  })
}

/** Deterministic substring/token matcher used when UA core is unavailable. */
export function substringSearch(
  nodes: SearchableNode[],
  query: string,
  limit: number,
): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const tokens = q.split(/\s+/).filter(Boolean)

  // Rank: exact name match > name prefix > label/summary/tags hit.
  const scored: Array<{ hit: SearchHit; rank: number }> = []
  for (const n of nodes) {
    const name = n.name.toLowerCase()
    const hay = `${n.name} ${n.summary} ${n.tags.join(' ')} ${n.filePath || ''}`.toLowerCase()
    if (!tokens.some((t) => hay.includes(t))) continue
    let rank = 0.3
    if (name === q) rank = 1
    else if (name.startsWith(q)) rank = 0.8
    else if (name.includes(q)) rank = 0.6
    scored.push({ hit: { nodeId: n.id, score: rank }, rank })
  }

  scored.sort((a, b) => b.rank - a.rank || a.hit.nodeId.localeCompare(b.hit.nodeId))
  return scored.slice(0, limit).map((s) => s.hit)
}

/**
 * Cached lexical index for the node set a caller is searching.
 *
 * The graph is re-read and re-mapped on every `graph:search` IPC call, so caching
 * on the array identity would never hit. The key is a cheap fingerprint — size plus
 * first/last node id — which changes whenever the graph is re-indexed, and building
 * the index is O(total tokens) rather than per keystroke.
 */
let lexicalKey = ''
let lexicalCache: LexicalIndex | null = null

export function lexicalIndexFor(nodes: SearchableNode[]): LexicalIndex {
  const key = `${nodes.length}:${nodes[0]?.id ?? ''}:${nodes[nodes.length - 1]?.id ?? ''}`
  if (key !== lexicalKey || !lexicalCache) {
    lexicalCache = buildLexicalIndex(nodes)
    lexicalKey = key
  }
  return lexicalCache
}

/** Drop the cached lexical index (used by tests and after a graph rewrite). */
export function invalidateLexicalIndex(): void {
  lexicalKey = ''
  lexicalCache = null
}

/**
 * Ranking from the **semantic engine alone** — no lexical channel, no fusion.
 *
 * Kept separate so the benchmark can measure each channel on its own: if the
 * product helper were the only entry point, "semantic" would silently mean
 * "hybrid" and the ablation would compare a thing with itself.
 */
export async function semanticSearchOnly(
  nodes: SearchableNode[],
  query: string,
  limit = 12,
): Promise<DetailedSearchResult> {
  const trimmed = query.trim()
  if (!trimmed) return { hits: [], backend: 'substring' }

  const Ctor = await loadSearchEngineClass()
  if (Ctor) {
    try {
      const engine = new Ctor(nodes)
      const hits = engine.search(trimmed, { limit })
      if (Array.isArray(hits)) {
        return {
          hits: hits
            .filter((h) => h && typeof h.nodeId === 'string')
            .slice(0, limit)
            .map((h) => ({ nodeId: h.nodeId, score: 1 / (hits.indexOf(h) + 1) })),
          backend: 'ua',
        }
      }
    } catch {
      /* fall through to the deterministic matcher */
    }
  }

  return { hits: substringSearch(nodes, trimmed, limit), backend: 'substring' }
}

/**
 * The product retrieval path: semantic ⊕ lexical, fused by RRF.
 *
 * RRF scores are rank-derived (`1/(i+1)` after fusion) and are **not** comparable
 * with either channel's own score scale — they exist for ordering and debugging.
 */
export async function hybridSearch(
  nodes: SearchableNode[],
  query: string,
  limit = 12,
): Promise<DetailedSearchResult> {
  const trimmed = query.trim()
  if (!trimmed) return { hits: [], backend: 'substring' }

  const channelLimit = Math.max(limit, 8)
  const lexical = lexicalSearch(lexicalIndexFor(nodes), trimmed, channelLimit, { expand: true }).map(
    (h) => h.nodeId,
  )
  const semantic = await semanticSearchOnly(nodes, trimmed, channelLimit)

  // No semantic channel (engine missing, or it found nothing): lexical carries it.
  if (semantic.backend !== 'ua') {
    return {
      hits: lexical.slice(0, limit).map((nodeId, i) => ({ nodeId, score: 1 / (i + 1) })),
      backend: 'lexical',
    }
  }

  const fused = rrfFuse([semantic.hits.map((h) => h.nodeId), lexical]).slice(0, limit)
  return { hits: fused.map((nodeId, i) => ({ nodeId, score: 1 / (i + 1) })), backend: 'hybrid' }
}

/**
 * The retrieval entry point used by the shell (`graph:search`) and the coach.
 *
 * Delegates to `hybridSearch`, so the app, the agent tools and the benchmark all
 * exercise the same ranking; use `semanticSearchOnly` when a single channel has to
 * be measured in isolation.
 */
export function searchNodesDetailed(
  nodes: SearchableNode[],
  query: string,
  limit = 12,
): Promise<DetailedSearchResult> {
  return hybridSearch(nodes, query, limit)
}

/** Fuzzy search; falls back to substring match if UA core cannot load. */
export async function searchNodesFuzzy(
  nodes: SearchableNode[],
  query: string,
  limit = 12,
): Promise<SearchHit[]> {
  const { hits } = await searchNodesDetailed(nodes, query, limit)
  return hits
}
