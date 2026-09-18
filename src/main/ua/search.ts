/**
 * UA-backed node search — lazily loads UA `SearchEngine` via dynamic import
 * (ESM-only package) and degrades to a deterministic substring matcher.
 *
 * Mirrors src/main/ua/client.ts loadCore() — never static-require @understand-anything/core.
 *
 * Lives in the UA integration layer because it is a graph-query capability shared by
 * the coach agent (agent/tools.ts) and the shell IPC surface (graph:search).
 */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

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

/** Which matcher actually produced a result set. */
export type SearchBackend = 'ua' | 'substring'

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
 * Search with backend reporting. Uses UA `SearchEngine` when it loads,
 * otherwise the substring matcher — callers can surface the degradation.
 */
export async function searchNodesDetailed(
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
            .slice(0, limit),
          backend: 'ua',
        }
      }
    } catch {
      /* fall through to substring */
    }
  }

  return { hits: substringSearch(nodes, trimmed, limit), backend: 'substring' }
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
