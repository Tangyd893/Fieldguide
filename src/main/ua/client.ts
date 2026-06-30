/**
 * UA Integration Layer — Phase 1.5
 *
 * Wraps @understand-anything/core to provide a simple index pipeline:
 *   1. Scan project directory (list files, classify by language)
 *   2. Extract structure via Tree-sitter (PluginRegistry)
 *   3. Build KnowledgeGraph via GraphBuilder
 *   4. Persist via saveGraph → {projectRoot}/.understand-anything/knowledge-graph.json
 *
 * Phase 2 will add LLM-driven phases (architecture analysis, tour generation, etc.)
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join, relative, extname, basename } from 'node:path'
import { pathToFileURL } from 'node:url'

// UA Core imports — loaded dynamically to handle ESM
let TreeSitterPlugin: any
let PluginRegistry: any
let builtinLanguageConfigs: any
let registerAllParsers: any
let GraphBuilder: any
let saveGraph: any
let createIgnoreFilter: any

async function loadCore(): Promise<void> {
  if (TreeSitterPlugin) return // already loaded

  // Try npm resolve first, fall back to direct path
  const { createRequire } = await import('node:module')
  const require_ = createRequire(join(process.cwd(), 'package.json'))

  let core: any
  try {
    core = await import(pathToFileURL(require_.resolve('@understand-anything/core')).href)
  } catch {
    // Fallback: direct path to UA plugin
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

const IGNORE_DIRS = new Set([
  '.git', 'node_modules', '.understand-anything', 'vendor',
  '__pycache__', '.venv', 'dist', 'build', 'out', '.next',
  'target', '.turbo', '.cache', '.idea', '.vscode',
])

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.exe', '.dll', '.so', '.dylib',
  '.zip', '.tar', '.gz', '.7z',
  '.pdf', '.doc', '.docx',
])

interface ScannedFile {
  path: string
  language: string
  category: 'code' | 'config' | 'doc' | 'other'
}

export interface ScanResult {
  files: ScannedFile[]
  totalFiles: number
  scannedAt: string
}

export async function scanProject(rootPath: string): Promise<ScanResult> {
  await loadCore()
  const files: ScannedFile[] = []
  const ignoreFilter = createIgnoreFilter?.(rootPath) ?? { ignores: () => false }

  walk(rootPath, rootPath, files, ignoreFilter)

  return {
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    totalFiles: files.length,
    scannedAt: new Date().toISOString(),
  }
}

function walk(
  rootPath: string,
  currentDir: string,
  files: ScannedFile[],
  ignoreFilter: { ignores: (p: string) => boolean },
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
    if (ignoreFilter.ignores?.(relPath)) continue

    let st: ReturnType<typeof statSync>
    try {
      st = statSync(fullPath)
    } catch {
      continue
    }

    if (st.isDirectory()) {
      walk(rootPath, fullPath, files, ignoreFilter)
    } else if (st.isFile()) {
      const ext = extname(entry).toLowerCase()
      if (BINARY_EXTS.has(ext)) continue

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
}

export async function indexProject(
  rootPath: string,
  projectName: string,
  onPhase?: (phase: string) => void,
  onProgress?: (current: number, total: number) => void,
): Promise<IndexResult> {
  try {
    // Phase 1: Scan
    onPhase?.('scan')
    const scanResult = await scanProject(rootPath)
    if (scanResult.files.length === 0) {
      return { success: false, graphPath: '', nodeCount: 0, edgeCount: 0, error: '未发现可解析的文件' }
    }

    // Phase 2: Extract structure
    onPhase?.('parse')
    const extractResult = await extractStructure(rootPath, scanResult.files, onProgress)

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

    // Phase 4: Save
    onPhase?.('save')
    saveGraph(rootPath, graph)

    return {
      success: true,
      graphPath: join(rootPath, '.understand-anything', 'knowledge-graph.json'),
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    }
  } catch (err) {
    return {
      success: false,
      graphPath: '',
      nodeCount: 0,
      edgeCount: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Resolve a relative import to a file path in the scanned files.
 * E.g. "./handler" → "internal/service/handler.go"
 */
function resolveImport(
  importSource: string,
  fromFile: string,
  files: ScannedFile[],
): string | null {
  if (!importSource.startsWith('.')) return null

  const fromDir = fromFile.split('/').slice(0, -1).join('/')
  const resolved = join(fromDir, importSource).replace(/\\/g, '/')

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

  return null
}
