/**
 * Serve project source files for UA Dashboard CodeViewer (`/file-content.json`).
 * Mirrors Understand-Anything dashboard vite middleware security checks.
 */
import { normalize, resolve, relative, dirname, extname, sep } from 'node:path'
import { existsSync, readFileSync, statSync } from 'node:fs'

const MAX_SOURCE_FILE_BYTES = 1_500_000

export interface FileContentPayload {
  path: string
  language: string
  content: string
  sizeBytes: number
  lineCount: number
}

export interface FileContentResult {
  statusCode: number
  payload: FileContentPayload | { error: string }
}

export function detectSourceLanguage(filePath: string): string {
  const ext = extname(filePath).slice(1).toLowerCase()
  const byExt: Record<string, string> = {
    bash: 'bash',
    c: 'c',
    cc: 'cpp',
    cpp: 'cpp',
    cs: 'csharp',
    css: 'css',
    go: 'go',
    h: 'c',
    hpp: 'cpp',
    html: 'markup',
    java: 'java',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    md: 'markdown',
    mjs: 'javascript',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    sh: 'bash',
    ts: 'typescript',
    tsx: 'tsx',
    txt: 'text',
    yaml: 'yaml',
    yml: 'yaml',
  }
  return byExt[ext] ?? 'text'
}

/** Collect relative file paths referenced by the knowledge graph. */
export function graphFilePathSet(graphFile: string, projectRoot: string): Set<string> {
  const set = new Set<string>()
  try {
    const graph = JSON.parse(readFileSync(graphFile, 'utf-8')) as {
      nodes?: Array<{ filePath?: string }>
    }
    for (const n of graph.nodes || []) {
      if (!n.filePath) continue
      const rel = n.filePath.replace(/\\/g, '/')
      set.add(rel)
    }
  } catch {
    /* empty */
  }
  // Always allow common docs at root even if path casing differs
  void projectRoot
  return set
}

/**
 * Resolve and read a source file for Dashboard preview.
 * @param requestedPath relative path from query string (e.g. README.md)
 * @param projectRoot absolute project root
 * @param graphFile optional knowledge-graph.json — when set, path must appear in graph
 */
export function readProjectSourceFile(
  requestedPath: string,
  projectRoot: string,
  graphFile?: string | null,
): FileContentResult {
  if (!requestedPath) {
    return { statusCode: 400, payload: { error: 'Missing path' } }
  }
  if (requestedPath.includes('\0')) {
    return { statusCode: 400, payload: { error: 'Invalid path' } }
  }
  // Reject absolute paths (Windows + POSIX)
  if (
    requestedPath.startsWith('/')
    || requestedPath.startsWith('\\')
    || /^[a-zA-Z]:[\\/]/.test(requestedPath)
  ) {
    return { statusCode: 400, payload: { error: 'Absolute paths are not allowed' } }
  }

  const normalizedPath = normalize(requestedPath)
  if (
    normalizedPath === '.'
    || normalizedPath === '..'
    || normalizedPath.startsWith(`..${sep}`)
  ) {
    return { statusCode: 400, payload: { error: 'Path must stay inside the project' } }
  }

  const absoluteFile = resolve(projectRoot, normalizedPath)
  const relativeToRoot = relative(projectRoot, absoluteFile)
  if (
    !relativeToRoot
    || relativeToRoot === '..'
    || relativeToRoot.startsWith(`..${sep}`)
  ) {
    return { statusCode: 400, payload: { error: 'Path must stay inside the project' } }
  }

  const safeRelativePath = relativeToRoot.split(sep).join('/')

  if (graphFile && existsSync(graphFile)) {
    const allowed = graphFilePathSet(graphFile, projectRoot)
    if (allowed.size > 0 && !allowed.has(safeRelativePath)) {
      // Case-insensitive fallback (Windows graphs sometimes vary)
      const lower = safeRelativePath.toLowerCase()
      const hit = [...allowed].find((p) => p.toLowerCase() === lower)
      if (!hit) {
        return { statusCode: 404, payload: { error: 'File is not in the knowledge graph' } }
      }
    }
  }

  if (!existsSync(absoluteFile)) {
    return { statusCode: 404, payload: { error: 'File not found' } }
  }

  let size = 0
  try {
    const st = statSync(absoluteFile)
    if (!st.isFile()) {
      return { statusCode: 400, payload: { error: 'Path is not a file' } }
    }
    size = st.size
  } catch {
    return { statusCode: 404, payload: { error: 'File not found' } }
  }

  if (size > MAX_SOURCE_FILE_BYTES) {
    return { statusCode: 413, payload: { error: 'File is too large to preview' } }
  }

  let buffer: Buffer
  try {
    buffer = readFileSync(absoluteFile)
  } catch {
    return { statusCode: 404, payload: { error: 'File not found' } }
  }

  if (buffer.includes(0)) {
    return { statusCode: 415, payload: { error: 'Binary files cannot be previewed' } }
  }

  const content = buffer.toString('utf8')
  return {
    statusCode: 200,
    payload: {
      path: safeRelativePath,
      language: detectSourceLanguage(safeRelativePath),
      content,
      sizeBytes: buffer.byteLength,
      lineCount: content.length === 0 ? 0 : content.split(/\r\n|\n|\r/).length,
    },
  }
}

/** Derive project root from .../.understand-anything/knowledge-graph.json */
export function projectRootFromGraphFile(graphFile: string): string {
  return dirname(dirname(graphFile))
}
