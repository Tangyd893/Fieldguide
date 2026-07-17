/**
 * Lazily load UA SearchEngine via dynamic import (ESM-only package).
 * Mirrors src/main/ua/client.ts loadCore() — never static-require @understand-anything/core.
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

export interface GraphSearchEngine {
  search(query: string, options?: { limit?: number }): SearchHit[]
}

type SearchEngineCtor = new (nodes: SearchableNode[]) => GraphSearchEngine

let SearchEngineClass: SearchEngineCtor | null = null
let loadFailed = false

function getAppRoot(): string {
  try {
    // Lazy require so vitest / plain node can still use substring fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

/** Fuzzy search; falls back to substring match if UA core cannot load. */
export async function searchNodesFuzzy(
  nodes: SearchableNode[],
  query: string,
  limit = 12,
): Promise<SearchHit[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const Ctor = await loadSearchEngineClass()
  if (Ctor) {
    try {
      const engine = new Ctor(nodes)
      return engine.search(trimmed, { limit })
    } catch {
      /* fall through */
    }
  }

  const q = trimmed.toLowerCase()
  const tokens = q.split(/\s+/).filter(Boolean)
  const scored: SearchHit[] = []
  for (const n of nodes) {
    const hay = `${n.name} ${n.summary} ${n.tags.join(' ')} ${n.filePath || ''}`.toLowerCase()
    if (!tokens.some((t) => hay.includes(t))) continue
    scored.push({ nodeId: n.id, score: 0.5 })
    if (scored.length >= limit) break
  }
  return scored
}
