/**
 * Ensure knowledge graphs have architecture layers.
 *
 * UA Dashboard overview mode requires `graph.layers.length > 0`. Structure-only
 * indexes (no LLM) leave layers empty → blank canvas forever while the shell
 * still reports thousands of nodes. Heuristic `detectLayers` from UA core
 * fixes this without an API key.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { app } from 'electron'

type Layer = { id: string; name: string; description?: string; nodeIds: string[] }
type GraphLike = {
  nodes?: Array<{ id: string; type?: string; filePath?: string }>
  layers?: Layer[]
  [k: string]: unknown
}

let detectLayersFn: ((graph: GraphLike) => Layer[]) | null = null

function tryLoadDetectLayersSync(): ((graph: GraphLike) => Layer[]) | null {
  if (detectLayersFn) return detectLayersFn
  try {
    const appRoot = app.isPackaged ? app.getAppPath() : process.cwd()
    const require_ = createRequire(join(appRoot, 'package.json'))
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core = require_('@understand-anything/core') as { detectLayers: (g: GraphLike) => Layer[] }
    detectLayersFn = core.detectLayers
    return detectLayersFn
  } catch {
    try {
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
      const require_ = createRequire(uaCorePath)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const core = require_(uaCorePath) as { detectLayers: (g: GraphLike) => Layer[] }
      detectLayersFn = core.detectLayers
      return detectLayersFn
    } catch {
      return null
    }
  }
}

/** Sync fallback when core is already loaded via client.ts loadCore. */
export function setDetectLayersImpl(fn: (graph: GraphLike) => Layer[]): void {
  detectLayersFn = fn
}

function fallbackAllFilesLayer(graph: GraphLike): Layer[] {
  const fileIds = (graph.nodes ?? []).filter((n) => n.type === 'file').map((n) => n.id)
  if (fileIds.length === 0) return []
  return [
    {
      id: 'layer:all-files',
      name: 'All Files',
      description:
        'Heuristic layer for structure-only indexes. Re-index with LLM for richer architecture layers.',
      nodeIds: fileIds,
    },
  ]
}

/**
 * Mutates graph in place: if layers empty, assign heuristic directory layers.
 * Returns true if layers were added.
 */
export function ensureGraphLayersSync(graph: GraphLike): boolean {
  if (!graph?.nodes?.length) return false
  if (Array.isArray(graph.layers) && graph.layers.length > 0) return false

  const detect = tryLoadDetectLayersSync()
  if (detect) {
    try {
      graph.layers = detect(graph)
      if (graph.layers?.length) return true
    } catch (err) {
      console.warn('[ensure-layers] detectLayers threw:', err)
    }
  }

  graph.layers = fallbackAllFilesLayer(graph)
  return (graph.layers?.length ?? 0) > 0
}

/**
 * Load project graph, inject heuristic layers if missing, and persist once.
 * Call when opening a project so Dashboard + IPC both see layers.
 */
export function ensureProjectGraphLayers(projectRoot: string): boolean {
  const p = join(projectRoot, '.understand-anything', 'knowledge-graph.json')
  if (!existsSync(p)) return false
  let graph: GraphLike
  try {
    graph = JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return false
  }
  const added = ensureGraphLayersSync(graph)
  if (added) {
    try {
      writeFileSync(p, JSON.stringify(graph, null, 2), 'utf-8')
      console.log(`[ensure-layers] wrote heuristic layers → ${p} (${graph.layers?.length ?? 0} layers)`)
    } catch (err) {
      console.warn('[ensure-layers] persist failed:', err)
    }
  }
  return added
}

/** Parse graph JSON buffer/string, ensure layers, return JSON string for Dashboard. */
export function ensureLayersInGraphJson(raw: string | Buffer): string {
  try {
    const graph = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8')) as GraphLike
    ensureGraphLayersSync(graph)
    return JSON.stringify(graph)
  } catch {
    return typeof raw === 'string' ? raw : raw.toString('utf-8')
  }
}
