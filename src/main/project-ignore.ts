/**
 * Shared project ignore rules for file-tree and UA scanner.
 *
 * UA core uses `isIgnored()`; Fieldguide historically used `ignores()`.
 * All filters are normalized to ProjectIgnoreFilter with `.ignores()`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { pathToFileURL } from 'node:url'

export const IGNORE_DIRS = new Set([
  '.git', 'node_modules', '.understand-anything', 'vendor',
  '__pycache__', '.venv', 'dist', 'build', 'out', '.next',
  'target', '.turbo', '.cache', '.idea', '.vscode',
])

export const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.exe', '.dll', '.so', '.dylib',
  '.zip', '.tar', '.gz', '.7z',
  '.pdf', '.doc', '.docx',
])

export interface ProjectIgnoreFilter {
  ignores: (relPath: string) => boolean
}

/** Accept UA `isIgnored` or Fieldguide `ignores`, or a bare predicate. */
export type IgnoreFilterLike =
  | ProjectIgnoreFilter
  | { isIgnored: (relPath: string) => boolean }
  | ((relPath: string) => boolean)
  | null
  | undefined

const filterCache = new Map<string, ProjectIgnoreFilter>()

let uaCreateIgnoreFilter: ((root: string) => IgnoreFilterLike) | null = null

export function normalizeIgnoreFilter(raw: IgnoreFilterLike): ProjectIgnoreFilter {
  if (!raw) return { ignores: () => false }
  if (typeof raw === 'function') return { ignores: (p) => Boolean(raw(p)) }
  if (typeof (raw as ProjectIgnoreFilter).ignores === 'function') {
    return raw as ProjectIgnoreFilter
  }
  if (typeof (raw as { isIgnored: (p: string) => boolean }).isIgnored === 'function') {
    const f = raw as { isIgnored: (p: string) => boolean }
    return { ignores: (p) => Boolean(f.isIgnored(p)) }
  }
  return { ignores: () => false }
}

async function loadUAIgnoreFilter(): Promise<typeof uaCreateIgnoreFilter> {
  if (uaCreateIgnoreFilter) return uaCreateIgnoreFilter

  const { createRequire } = await import('node:module')
  const appRoot = app.isPackaged ? app.getAppPath() : process.cwd()
  const require_ = createRequire(join(appRoot, 'package.json'))

  let core: { createIgnoreFilter?: (root: string) => IgnoreFilterLike }
  try {
    core = await import(pathToFileURL(require_.resolve('@understand-anything/core')).href)
  } catch {
    if (app.isPackaged) return null
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
    try {
      core = await import(pathToFileURL(uaCorePath).href)
    } catch {
      return null
    }
  }

  uaCreateIgnoreFilter = core.createIgnoreFilter ?? null
  return uaCreateIgnoreFilter
}

/** Basic root .gitignore reader when UA core is unavailable. */
export function createBasicGitignoreFilter(rootPath: string): ProjectIgnoreFilter {
  const patterns: string[] = []
  const gitignorePath = join(rootPath, '.gitignore')
  if (existsSync(gitignorePath)) {
    try {
      for (const line of readFileSync(gitignorePath, 'utf-8').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        patterns.push(trimmed)
      }
    } catch { /* ignore */ }
  }

  function matchPattern(pattern: string, relPath: string): boolean {
    const normalized = pattern.replace(/^\//, '')
    if (normalized.endsWith('/')) {
      const dir = normalized.slice(0, -1)
      return relPath === dir || relPath.startsWith(`${dir}/`)
    }
    if (normalized.includes('*')) {
      const escaped = normalized
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '<<<GLOBSTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<GLOBSTAR>>>/g, '.*')
      const re = new RegExp(`^${escaped}$`)
      const base = relPath.split('/').pop() ?? relPath
      return re.test(relPath) || re.test(base)
    }
    return relPath === normalized
      || relPath.endsWith(`/${normalized}`)
      || relPath.startsWith(`${normalized}/`)
  }

  return {
    ignores(relPath: string) {
      return patterns.some((p) => matchPattern(p, relPath))
    },
  }
}

/** Cached ignore filter aligned with UA indexer when possible. */
export async function getProjectIgnoreFilter(rootPath: string): Promise<ProjectIgnoreFilter> {
  const cached = filterCache.get(rootPath)
  if (cached) return cached

  let filter: ProjectIgnoreFilter
  try {
    const create = await loadUAIgnoreFilter()
    filter = create
      ? normalizeIgnoreFilter(create(rootPath))
      : createBasicGitignoreFilter(rootPath)
  } catch {
    filter = createBasicGitignoreFilter(rootPath)
  }

  filterCache.set(rootPath, filter)
  return filter
}

export function clearProjectIgnoreCache(): void {
  filterCache.clear()
}
