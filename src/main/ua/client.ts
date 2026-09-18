/**
 * UA Integration Layer — Phase 2
 *
 * Wraps @understand-anything/core to provide an index pipeline:
 *   1. Scan project directory (list files, classify by language)
 *   2. Extract structure via Tree-sitter (PluginRegistry)
 *   3. Build KnowledgeGraph via GraphBuilder
 *   4. LLM enrichment: per-file summaries, architecture layers, tour generation
 *   5. Persist via saveGraph → {projectRoot}/.understand-anything/knowledge-graph.json
 *
 * LLM phases are conditional on an API key being configured.
 * Without a key, the pipeline produces a structure-only graph.
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join, relative, extname, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import { BINARY_EXTS, IGNORE_DIRS, getProjectIgnoreFilter, normalizeIgnoreFilter } from '../project-ignore'
import { invalidateGraphCache } from './graph-reader'
import { setDetectLayersImpl } from './ensure-layers'
import { atomicWriteJson, isJsonReadable } from '../fs-atomic'

let indexAbortController: AbortController | null = null
let indexRunning = false

export function beginIndex(): AbortSignal {
  indexAbortController?.abort()
  indexAbortController = new AbortController()
  indexRunning = true
  return indexAbortController.signal
}

/** Mark the current index as finished (success, failure or cancellation). */
export function endIndex(): void {
  indexRunning = false
}

/**
 * True while an index is actually executing in this process.
 *
 * The DB `status` column is not enough to decide whether indexing may start:
 * a crash leaves it at 'indexing' forever (see resetStaleIndexingStatus), so the
 * IPC handler checks this live flag instead.
 */
export function isIndexRunning(): boolean {
  return indexRunning
}

export function cancelIndex(): boolean {
  if (!indexAbortController) return false
  indexAbortController.abort()
  indexRunning = false
  return true
}

export function isIndexCancelled(): boolean {
  return indexAbortController?.signal.aborted ?? false
}

// UA Core imports — loaded dynamically to handle ESM
let TreeSitterPlugin: any
let PluginRegistry: any
let builtinLanguageConfigs: any
let registerAllParsers: any
let GraphBuilder: any
let saveGraph: any
let createIgnoreFilter: any

// LLM enrichment imports (Phase 2)
let buildFileAnalysisPrompt: any
let parseFileAnalysisResponse: any
let buildLayerDetectionPrompt: any
let parseLayerDetectionResponse: any
let applyLLMLayers: any
let buildTourGenerationPrompt: any
let parseTourGenerationResponse: any
let generateHeuristicTour: any
let detectLayers: any

async function loadCore(): Promise<void> {
  if (TreeSitterPlugin) return // already loaded

  // Try npm resolve first, fall back to direct path
  const { createRequire } = await import('node:module')
  const appRoot = app.isPackaged ? app.getAppPath() : process.cwd()
  const require_ = createRequire(join(appRoot, 'package.json'))

  let core: any
  try {
    core = await import(pathToFileURL(require_.resolve('@understand-anything/core')).href)
  } catch {
    if (app.isPackaged) {
      throw new Error('打包环境未找到 @understand-anything/core，请检查 node_modules 是否打入安装包')
    }
    // Dev fallback: direct path to UA plugin sibling repo
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
    core = await import(pathToFileURL(uaCorePath).href)
  }

  TreeSitterPlugin = core.TreeSitterPlugin
  PluginRegistry = core.PluginRegistry
  builtinLanguageConfigs = core.builtinLanguageConfigs
  registerAllParsers = core.registerAllParsers
  GraphBuilder = core.GraphBuilder
  saveGraph = core.saveGraph
  createIgnoreFilter = core.createIgnoreFilter

  // Phase 2: LLM enrichment functions
  buildFileAnalysisPrompt = core.buildFileAnalysisPrompt
  parseFileAnalysisResponse = core.parseFileAnalysisResponse
  buildLayerDetectionPrompt = core.buildLayerDetectionPrompt
  parseLayerDetectionResponse = core.parseLayerDetectionResponse
  applyLLMLayers = core.applyLLMLayers
  buildTourGenerationPrompt = core.buildTourGenerationPrompt
  parseTourGenerationResponse = core.parseTourGenerationResponse
  generateHeuristicTour = core.generateHeuristicTour
  detectLayers = core.detectLayers

  // Share with ensure-layers (sync path for graph-reader / dashboard)
  setDetectLayersImpl(detectLayers)
}

// ─── Language detection (subset of UA's scan-project table) ───

const EXT_TO_LANG: Record<string, string> = {
  '.go': 'go',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.dart': 'dart',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.swift': 'swift',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.proto': 'protobuf',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.css': 'css',
  '.html': 'html',
  '.sh': 'shell',
  '.tf': 'terraform',
}

const FILENAME_TO_LANG: Record<string, string> = {
  'Dockerfile': 'dockerfile',
  'Makefile': 'makefile',
  'Jenkinsfile': 'jenkinsfile',
}

function detectLanguage(filePath: string): string {
  const name = basename(filePath)
  if (FILENAME_TO_LANG[name]) return FILENAME_TO_LANG[name]
  const ext = extname(filePath).toLowerCase()
  return EXT_TO_LANG[ext] || 'unknown'
}

// ─── File scanner ───

interface ScannedFile {
  path: string
  language: string
  category: 'code' | 'config' | 'doc' | 'other'
}

export interface ScanResult {
  files: ScannedFile[]
  totalFiles: number
  scannedAt: string
  /**
   * Every indexable path currently on disk, regardless of mtime.
   *
   * Incremental scans only return *changed* files, so without this list a file
   * deleted since the last index could never be detected and its nodes would
   * stay in the graph forever.
   */
  presentPaths: string[]
}

export async function scanProject(rootPath: string, changedAfter?: string): Promise<ScanResult> {
  await loadCore()
  const files: ScannedFile[] = []
  const presentPaths: string[] = []
  const uaFilter = createIgnoreFilter?.(rootPath)
  const ignoreFilter = normalizeIgnoreFilter(uaFilter ?? await getProjectIgnoreFilter(rootPath))

  walk(rootPath, rootPath, files, presentPaths, ignoreFilter, changedAfter ? new Date(changedAfter) : undefined)

  return {
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    totalFiles: files.length,
    scannedAt: new Date().toISOString(),
    presentPaths,
  }
}

function walk(
  rootPath: string,
  currentDir: string,
  files: ScannedFile[],
  presentPaths: string[],
  ignoreFilter: { ignores: (p: string) => boolean },
  since?: Date,
): void {
  let entries: string[]
  try {
    entries = readdirSync(currentDir)
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = join(currentDir, entry)
    const relPath = relative(rootPath, fullPath).replace(/\\/g, '/')

    // Skip hidden files/dirs and common ignores
    if (entry.startsWith('.')) continue
    if (IGNORE_DIRS.has(entry)) continue

    // Apply UA ignore filter
    if (ignoreFilter.ignores(relPath)) continue

    let st: ReturnType<typeof statSync>
    try {
      st = statSync(fullPath)
    } catch {
      continue
    }

    if (st.isDirectory()) {
      walk(rootPath, fullPath, files, presentPaths, ignoreFilter, since)
    } else if (st.isFile()) {
      const ext = extname(entry).toLowerCase()
      if (BINARY_EXTS.has(ext)) continue

      // Record presence for *every* indexable file: this is what lets an
      // incremental index notice deletions.
      presentPaths.push(relPath)

      // Incremental: only re-parse files newer than `since`
      if (since && st.mtime <= since) continue

      const language = detectLanguage(relPath)
      const category = classifyCategory(language, relPath)

      files.push({ path: relPath, language, category })
    }
  }
}

function classifyCategory(language: string, _path: string): ScannedFile['category'] {
  if (language === 'unknown') return 'other'
  // Config-type languages
  if (['json', 'yaml', 'toml', 'xml', 'dockerfile', 'makefile', 'terraform', 'jenkinsfile', 'shell'].includes(language)) {
    return 'config'
  }
  if (['markdown'].includes(language)) return 'doc'
  return 'code'
}

// ─── Structure Extraction ───

export interface ExtractResult {
  filesAnalyzed: number
  filesSkipped: string[]
  results: Array<{
    path: string
    language: string
    functions: Array<{ name: string; startLine: number; endLine: number; params: string[] }>
    classes: Array<{ name: string; startLine: number; endLine: number; methods: string[]; properties: string[] }>
    imports: Array<{ source: string; specifiers: string[]; lineNumber: number }>
    exports: Array<{ name: string; lineNumber: number; isDefault?: boolean }>
    metrics: Record<string, number>
  }>
}

export async function extractStructure(
  rootPath: string,
  files: ScannedFile[],
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ExtractResult> {
  await loadCore()

  // Init Tree-sitter
  const tsConfigs = builtinLanguageConfigs.filter((c: any) => c.treeSitter)
  const tsPlugin = new TreeSitterPlugin(tsConfigs)
  await tsPlugin.init()

  const registry = new PluginRegistry()
  registry.register(tsPlugin)
  registerAllParsers?.(registry)

  const results: ExtractResult['results'] = []
  const skipped: string[] = []
  const codeFiles = files.filter(f => f.category === 'code')
  let analyzed = 0

  for (const file of codeFiles) {
    if (signal?.aborted) throw new Error('INDEX_CANCELLED')
    const fullPath = join(rootPath, file.path)
    let content: string
    try {
      content = readFileSync(fullPath, 'utf-8')
    } catch {
      skipped.push(file.path)
      continue
    }

    try {
      const analysis = registry.analyzeFile?.(file.path, content)
      if (analysis) {
        results.push({
          path: file.path,
          language: file.language,
          functions: (analysis.functions || []).map((f: any) => ({
            name: f.name,
            startLine: f.lineRange?.[0] ?? 0,
            endLine: f.lineRange?.[1] ?? 0,
            params: f.params || [],
          })),
          classes: (analysis.classes || []).map((c: any) => ({
            name: c.name,
            startLine: c.lineRange?.[0] ?? 0,
            endLine: c.lineRange?.[1] ?? 0,
            methods: c.methods || [],
            properties: c.properties || [],
          })),
          imports: (analysis.imports || []).map((i: any) => ({
            source: i.source,
            specifiers: i.specifiers || [],
            lineNumber: i.lineNumber || 0,
          })),
          exports: (analysis.exports || []).map((e: any) => ({
            name: e.name,
            lineNumber: e.lineNumber || 0,
            isDefault: e.isDefault,
          })),
          metrics: {
            importCount: (analysis.imports || []).length,
            exportCount: (analysis.exports || []).length,
            functionCount: (analysis.functions || []).length,
            classCount: (analysis.classes || []).length,
          },
        })
      }
    } catch {
      skipped.push(file.path)
    }

    analyzed++
    onProgress?.(analyzed, codeFiles.length)
  }

  return {
    filesAnalyzed: results.length,
    filesSkipped: skipped,
    results,
  }
}

// ─── Full Pipeline ───

export interface IndexResult {
  success: boolean
  graphPath: string
  nodeCount: number
  edgeCount: number
  error?: string
  llmEnriched?: boolean
}

export interface LLMEnrichConfig {
  baseUrl: string
  apiKey: string
  chatModel: string
}

import { joinLlmUrl } from '../../shared/llm-url'

/**
 * Call the configured LLM with a prompt and return the response text.
 */
async function callLLM(prompt: string, config: LLMEnrichConfig, language?: string): Promise<string> {
  const url = joinLlmUrl(config.baseUrl, '/v1/chat/completions')

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.chatModel,
      messages: [
        { role: 'system', content: language === 'en'
          ? 'You are a code analysis assistant. Respond with valid JSON only. Do not include markdown fences or extra commentary.'
          : '你是一个代码分析助手。只回复合法的 JSON，不要包含 markdown 代码块或额外解释。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`LLM API error (${resp.status}): ${text.slice(0, 300)}`)
  }

  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM returned empty response')
  return content
}

/**
 * Phase 4: LLM enrichment — per-file summaries, architecture layers, tour generation.
 *
 * Mutates the graph in-place. Controlled by the presence of llmConfig.
 */
async function enrichWithLLM(
  graph: any,
  scanResult: ScanResult,
  extractResult: ExtractResult,
  rootPath: string,
  projectName: string,
  llmConfig: LLMEnrichConfig,
  language?: string,
  onPhase?: (phase: string) => void,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const codeFiles = scanResult.files.filter(f => f.category === 'code')
  const totalFiles = codeFiles.length
  let processed = 0

  // Build a lookup: file path → nodes (for summary injection)
  const nodesByFile = new Map<string, any[]>()
  for (const node of graph.nodes || []) {
    const fp = node.filePath || ''
    if (!nodesByFile.has(fp)) nodesByFile.set(fp, [])
    nodesByFile.get(fp)!.push(node)
  }

  // ─── 4a: Per-file summaries ───
  onPhase?.('analyze')

  // Process files in batches of 3 to respect rate limits
  const BATCH_SIZE = 3
  for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
    const batch = codeFiles.slice(i, i + BATCH_SIZE)
    const batchPromises = batch.map(async (file) => {
      const analysis = extractResult.results.find(r => r.path === file.path)
      if (!analysis) return

      let content: string
      try {
        content = readFileSync(join(rootPath, file.path), 'utf-8')
      } catch {
        return // skip unreadable files
      }

      // Limit content size per file to avoid token overflow
      const maxContentLen = 15_000
      const truncated = content.length > maxContentLen
        ? content.slice(0, maxContentLen) + '\n... (truncated)'
        : content

      try {
        const prompt = buildFileAnalysisPrompt(file.path, truncated, `Project: ${projectName}`)
        const response = await callLLM(prompt, llmConfig, language)
        const parsed = parseFileAnalysisResponse(response)

        if (parsed) {
          // Update file-level node
          const fileNodes = nodesByFile.get(file.path) || []
          for (const node of fileNodes) {
            if (node.type === 'file') {
              if (!node.metadata) node.metadata = {}
              node.metadata.summary = parsed.fileSummary || node.metadata.summary
              node.metadata.tags = parsed.tags || node.metadata.tags
              node.metadata.complexity = parsed.complexity || node.metadata.complexity
            }
            // Update function/class child nodes with per-symbol summaries
            if (node.type === 'function' && parsed.functionSummaries?.[node.label]) {
              if (!node.metadata) node.metadata = {}
              node.metadata.summary = parsed.functionSummaries[node.label]
            }
            if (node.type === 'class' && parsed.classSummaries?.[node.label]) {
              if (!node.metadata) node.metadata = {}
              node.metadata.summary = parsed.classSummaries[node.label]
            }
          }
        }
      } catch (err) {
        // Per-file failures are non-fatal; continue with remaining files
        console.warn(`[ua/client] LLM summary failed for ${file.path}: ${String(err)}`)
      }
    })

    await Promise.all(batchPromises)

    processed += batch.length
    onProgress?.(processed, totalFiles)
  }

  // ─── 4b: Architecture layer detection ───
  onPhase?.('review-layers')
  try {
    const layerPrompt = buildLayerDetectionPrompt(graph)
    const layerResponse = await callLLM(layerPrompt, llmConfig)
    const llmLayers = parseLayerDetectionResponse(layerResponse)
    if (llmLayers && llmLayers.length > 0) {
      graph.layers = applyLLMLayers(graph, llmLayers)
    }
  } catch (err) {
    console.warn(`[ua/client] LLM layer detection failed: ${String(err)}`)
  }

  // ─── 4c: Tour generation ───
  onPhase?.('review-tour')
  try {
    const tourPrompt = buildTourGenerationPrompt(graph)
    const tourResponse = await callLLM(tourPrompt, llmConfig)
    const tourSteps = parseTourGenerationResponse(tourResponse)
    if (tourSteps && tourSteps.length > 0) {
      graph.tour = tourSteps
    } else {
      // Fallback to heuristic tour
      graph.tour = generateHeuristicTour(graph)
    }
  } catch (err) {
    console.warn(`[ua/client] LLM tour generation failed, using heuristic: ${String(err)}`)
    try {
      graph.tour = generateHeuristicTour(graph)
    } catch {
      // No tour at all is acceptable
    }
  }
}

/**
 * Merge an incremental (partial) graph into the existing full graph on disk.
 *
 * The `partialGraph` only contains nodes and edges for files that changed.
 * This function loads the existing graph from disk, removes old nodes/edges
 * for the changed files, and inserts the new ones.  The partial graph is
 * mutated in-place.
 *
 * If the existing graph is missing or corrupt, the partial graph is kept as-is
 * (treated as a full index).
 */
export function mergeIncrementalGraph(
  rootPath: string,
  partialGraph: { nodes: any[]; edges: any[]; layers?: any[]; tour?: any[] },
  changedFiles: { path: string }[],
  presentPaths?: string[],
): { removedNodes: number; deletedFiles: string[] } {
  const graphPath = join(rootPath, '.understand-anything', 'knowledge-graph.json')
  if (!existsSync(graphPath)) return { removedNodes: 0, deletedFiles: [] } // no existing graph — partial is the full graph

  let existingGraph: any
  try {
    existingGraph = JSON.parse(readFileSync(graphPath, 'utf-8'))
  } catch {
    return { removedNodes: 0, deletedFiles: [] } // corrupt — treat partial as full
  }

  if (!existingGraph?.nodes) return { removedNodes: 0, deletedFiles: [] }

  // Files that were indexed before but are gone from disk now. Without this,
  // `git rm` / branch switches leave orphan nodes in the graph forever.
  const deletedPaths = new Set<string>()
  if (presentPaths) {
    const present = new Set(presentPaths)
    for (const node of existingGraph.nodes) {
      const fp = node?.filePath
      if (typeof fp === 'string' && fp && !present.has(fp)) deletedPaths.add(fp)
    }
  }

  const stalePaths = new Set([...changedFiles.map(f => f.path), ...deletedPaths])

  // Remove old nodes whose filePath is changed or deleted
  const removedIds = new Set<string>()
  const keptNodes = existingGraph.nodes.filter((n: any) => {
    if (n.filePath && stalePaths.has(n.filePath)) {
      removedIds.add(n.id)
      return false
    }
    return true
  })

  // Remove edges that reference removed nodes
  const keptEdges = (existingGraph.edges || []).filter(
    (e: any) => !removedIds.has(e.source) && !removedIds.has(e.target),
  )

  // Merge: kept nodes/edges + new nodes/edges from changed files
  partialGraph.nodes = [...keptNodes, ...partialGraph.nodes]
  partialGraph.edges = [...keptEdges, ...partialGraph.edges]

  // Preserve existing layers and tours unless the new build
  // produced its own (LLM enrichment may regenerate them)
  if (!partialGraph.layers?.length && existingGraph.layers?.length) {
    partialGraph.layers = existingGraph.layers
  }
  if (!partialGraph.tour?.length && existingGraph.tour?.length) {
    partialGraph.tour = existingGraph.tour
  }

  // Drop deleted nodes from preserved layers so the overview does not point at
  // ids that no longer exist.
  if (deletedPaths.size > 0) {
    for (const layer of partialGraph.layers ?? []) {
      if (Array.isArray(layer?.nodeIds)) {
        layer.nodeIds = layer.nodeIds.filter((id: string) => !removedIds.has(id))
      }
    }
  }

  return { removedNodes: removedIds.size, deletedFiles: [...deletedPaths] }
}

async function runIndexProject(
  rootPath: string,
  projectName: string,
  onPhase?: (phase: string) => void,
  onProgress?: (current: number, total: number) => void,
  incremental?: boolean,
  llmConfig?: LLMEnrichConfig,
  signal?: AbortSignal,
  language?: string,
): Promise<IndexResult> {
  try {
    if (signal?.aborted) {
      return { success: false, graphPath: '', nodeCount: 0, edgeCount: 0, error: 'INDEX_CANCELLED' }
    }
    // Determine changedAfter for incremental mode
    let changedAfter: string | undefined
    if (incremental) {
      const graphPath = join(rootPath, '.understand-anything', 'knowledge-graph.json')
      if (existsSync(graphPath)) {
        try {
          const existing = JSON.parse(readFileSync(graphPath, 'utf-8'))
          changedAfter = existing?.project?.analyzedAt
        } catch { /* if graph is corrupt, do full index */ }
      }
    }

    // Phase 1: Scan
    onPhase?.('scan')
    const scanResult = await scanProject(rootPath, changedAfter)
    if (scanResult.files.length === 0) {
      if (incremental) {
        // Zero changes: return the actual node/edge count from the existing graph.
        // Do NOT report nodeCount: 0 when the graph is still valid.
        const graphPath = join(rootPath, '.understand-anything', 'knowledge-graph.json')
        let nodeCount = 0
        let edgeCount = 0
        if (existsSync(graphPath)) {
          try {
            const existing = JSON.parse(readFileSync(graphPath, 'utf-8'))
            nodeCount = existing?.nodes?.length || 0
            edgeCount = existing?.edges?.length || 0
          } catch { /* corrupt graph — return 0 counts */ }
        }
        return { success: true, graphPath, nodeCount, edgeCount }
      }
      return { success: false, graphPath: '', nodeCount: 0, edgeCount: 0, error: '未发现可解析的文件' }
    }

    // Phase 2: Extract structure
    onPhase?.('parse')
    const extractResult = await extractStructure(rootPath, scanResult.files, onProgress, signal)
    if (signal?.aborted) {
      return { success: false, graphPath: '', nodeCount: 0, edgeCount: 0, error: 'INDEX_CANCELLED' }
    }

    // Phase 3: Build graph
    onPhase?.('build')
    await loadCore()
    const builder = new GraphBuilder(projectName, '', undefined)

    for (const file of scanResult.files) {
      const analysis = extractResult.results.find(r => r.path === file.path)

      if (file.category === 'code' && analysis) {
        builder.addFileWithAnalysis(file.path, {
          functions: analysis.functions.map(f => ({
            name: f.name,
            lineRange: [f.startLine, f.endLine] as [number, number],
            params: f.params,
          })),
          classes: analysis.classes.map(c => ({
            name: c.name,
            lineRange: [c.startLine, c.endLine] as [number, number],
            methods: c.methods,
            properties: c.properties,
          })),
          imports: analysis.imports,
          exports: analysis.exports,
        }, {
          summary: '',
          tags: [],
          complexity: 'moderate',
          summaries: {},
          fileSummary: '',
        })
      } else if (file.category === 'config') {
        builder.addNonCodeFile(file.path, {
          nodeType: 'config',
          summary: '',
          tags: [],
          complexity: 'simple',
        })
      } else if (file.language !== 'unknown') {
        builder.addFile(file.path, {
          summary: '',
          tags: [],
          complexity: 'simple',
        })
      }
    }

    // Add import edges
    for (const file of scanResult.files) {
      const analysis = extractResult.results.find(r => r.path === file.path)
      if (!analysis) continue

      for (const imp of analysis.imports) {
        const resolved = resolveImport(imp.source, file.path, scanResult.files)
        if (resolved) {
          try {
            builder.addImportEdge(file.path, resolved)
          } catch { /* edge may already exist */ }
        }
      }
    }

    const graph = builder.build()

    // ── Incremental merge ──────────────────────────────────────────
    // When indexing incrementally, the builder only contains the changed
    // files.  saveGraph() overwrites the entire file, so we must merge
    // the new partial graph into the existing one to preserve unchanged
    // nodes and edges.
    if (incremental) {
      const merge = mergeIncrementalGraph(rootPath, graph, scanResult.files, scanResult.presentPaths)
      if (merge.deletedFiles.length > 0) {
        console.log(
          `[ua/client] incremental index dropped ${merge.deletedFiles.length} deleted file(s): `
          + merge.deletedFiles.slice(0, 5).join(', ')
          + (merge.deletedFiles.length > 5 ? ' …' : ''),
        )
      }
    }

    // Phase 4: LLM enrichment (conditional on API key)
    let llmEnriched = false
    const hasLLM = llmConfig && llmConfig.apiKey && llmConfig.baseUrl && llmConfig.chatModel
    if (hasLLM) {
      try {
        await enrichWithLLM(
          graph,
          scanResult,
          extractResult,
          rootPath,
          projectName,
          llmConfig!,
          language,
          onPhase,
          (current, total) => {
            // Map enrichment progress to overall progress (70% → 95%)
            onProgress?.(Math.round(70 + (current / total) * 25), 100)
          },
        )
        llmEnriched = true
      } catch (err) {
        // LLM enrichment failure is non-fatal — graph still has structure
        console.error(`[ua/client] LLM enrichment failed: ${String(err)}`)
      }
    }

    // Structure-only (or LLM without layers): UA Dashboard overview requires layers
    if (!graph.layers?.length && detectLayers) {
      try {
        graph.layers = detectLayers(graph)
      } catch (err) {
        console.warn(`[ua/client] detectLayers failed: ${String(err)}`)
      }
    }

    // Phase 5: Save
    onPhase?.('save')
    const graphFilePath = join(rootPath, '.understand-anything', 'knowledge-graph.json')
    saveGraph(rootPath, graph)

    // UA's saveGraph writes in place; if that write was interrupted the graph
    // would stay corrupt and every later read would fail. The full graph is
    // still in memory here, so verify and repair atomically.
    if (!isJsonReadable(graphFilePath)) {
      console.warn('[ua/client] graph file unreadable after save — rewriting atomically')
      atomicWriteJson(graphFilePath, graph)
      if (!isJsonReadable(graphFilePath)) {
        return {
          success: false,
          graphPath: graphFilePath,
          nodeCount: 0,
          edgeCount: 0,
          error: 'GRAPH_WRITE_FAILED',
        }
      }
    }

    // The graph file changed: drop any cached parse so the next read is fresh
    // even if the write landed in the same millisecond with the same size.
    invalidateGraphCache(rootPath)

    return {
      success: true,
      graphPath: graphFilePath,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      llmEnriched,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'INDEX_CANCELLED') {
      return { success: false, graphPath: '', nodeCount: 0, edgeCount: 0, error: 'INDEX_CANCELLED' }
    }
    return {
      success: false,
      graphPath: '',
      nodeCount: 0,
      edgeCount: 0,
      error: msg,
    }
  }
}

/**
 * Index a project. Wraps runIndexProject so the in-process "is an index running"
 * flag is cleared on every exit path (success, failure, cancellation, throw) —
 * a leaked flag would block all future indexing until restart.
 */
export async function indexProject(
  rootPath: string,
  projectName: string,
  onPhase?: (phase: string) => void,
  onProgress?: (current: number, total: number) => void,
  incremental?: boolean,
  llmConfig?: LLMEnrichConfig,
  signal?: AbortSignal,
  language?: string,
): Promise<IndexResult> {
  try {
    return await runIndexProject(
      rootPath, projectName, onPhase, onProgress, incremental, llmConfig, signal, language,
    )
  } finally {
    endIndex()
  }
}

/**
 * Resolve an import target to a file path in the scanned files.
 *
 * Two shapes are handled:
 *   - relative: "./handler" → "internal/service/handler.go"
 *   - package / absolute: "github.com/acme/proj/internal/store" → "internal/store/store.go"
 *     (also Python dotted form "internal.store" → internal/store)
 *
 * The second case matters for Go, Java and Python projects, where imports are
 * module paths rather than file paths — without it those graphs contain no
 * inter-file edges at all, which breaks "how does A reach B" questions and
 * community clustering. Resolution is suffix-based: the longest suffix of the
 * import path that matches a directory in the repo wins, so third-party imports
 * ("net/http") resolve to nothing instead of guessing.
 */
function resolveImport(
  importSource: string,
  fromFile: string,
  files: ScannedFile[],
): string | null {
  const source = importSource.trim()

  if (source.startsWith('.')) {
    const fromDir = fromFile.split('/').slice(0, -1).join('/')
    const resolved = join(fromDir, source).replace(/\\/g, '/')

    // Try exact match first
    const exact = files.find(f => {
      const base = f.path.replace(/\.[^.]+$/, '')
      return base === resolved || f.path === resolved
    })
    if (exact) return exact.path

    // Try with common extensions
    for (const ext of ['.go', '.ts', '.js', '.py', '.rs', '.java']) {
      const withExt = files.find(f => f.path === resolved + ext)
      if (withExt) return withExt.path
    }
    // Directory import (e.g. "./service" → internal/service/*)
    return pickFromDirectory(`${resolved}/`, source.split('/').pop() ?? '', files)
  }

  if (!source || source.startsWith('/') || source.startsWith('@types')) return null
  // Bare npm-style specifiers ("react", "lodash/fp") are packages, not repo paths.
  if (!source.includes('/') && !source.includes('.')) return null

  // Python dotted module → path-ish
  const asPath = !source.includes('/') && source.includes('.')
    ? source.replace(/\./g, '/')
    : source

  const segments = asPath.split('/').filter(Boolean)
  // Longest suffix first, but never match on a single generic segment unless the
  // repo root actually has such a directory (handled by the same lookup).
  for (let take = segments.length; take >= 1; take--) {
    const suffix = segments.slice(-take).join('/')
    const hit = pickFromDirectory(`${suffix}/`, segments[segments.length - 1], files)
    if (hit) return hit
  }

  return null
}

/** Pick a representative file inside a directory prefix (package → file). */
function pickFromDirectory(
  dirPrefix: string,
  packageName: string,
  files: ScannedFile[],
): string | null {
  const candidates = files.filter(f => f.path.startsWith(dirPrefix))
  if (candidates.length === 0) return null

  const normalizedPkg = packageName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
  // A package import points at its implementation, not at its tests.
  const isTest = (path: string) => /(_test|\.test|\.spec)\.[^.]+$/.test(path) || /(^|\/)test_[^/]+$/.test(path)
  const preferred = candidates.filter(f => !isTest(f.path))
  const pool = preferred.length > 0 ? preferred : candidates

  // 1. a file named after the package: store → store.go
  const named = pool.find(
    f => f.path.slice(dirPrefix.length).replace(/\.[^.]+$/, '').toLowerCase() === normalizedPkg,
  )
  if (named) return named.path

  // 2. an index-style entry point
  const entry = pool.find(f => /(^|\/)(index|main|mod)\.[^.]+$/.test(f.path.slice(dirPrefix.length)))
  if (entry) return entry.path

  // 3. deterministic fallback — plain code-unit ordering, NOT localeCompare:
  //    locale collation ranks "pool_test.go" before "pool.go", which silently
  //    made package imports resolve to test files.
  return pool.slice().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))[0].path
}
