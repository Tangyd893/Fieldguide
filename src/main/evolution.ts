/**
 * Architecture evolution timeline (B7): git history × knowledge graph.
 *
 * `simple-git` was already a dependency but only used for cloning; this turns the
 * same repo metadata into "which parts of this architecture are actually moving?".
 *
 * Bounded on purpose: at most `maxCommits` commits are inspected, because this
 * runs interactively on repositories with tens of thousands of commits.
 */
import { simpleGit } from 'simple-git'
import { loadGraph } from './ua/graph-reader'

export interface FileChurn {
  path: string
  commits: number
  lastChanged: string
  /** Graph nodes that live in this file. */
  nodeCount: number
}

export interface ActivityBucket {
  /** `YYYY-MM`. */
  month: string
  commits: number
}

export interface EvolutionResult {
  isRepo: boolean
  commitsScanned: number
  /** Oldest commit date seen (ISO) or null for an empty repo. */
  since: string | null
  until: string | null
  buckets: ActivityBucket[]
  hotspots: FileChurn[]
  /** Files changed most often relative to how long they have existed. */
  hottestPath: string | null
  error?: string
}

export interface EvolutionOptions {
  maxCommits?: number
  maxHotspots?: number
  /** Skip merge commits when counting churn (default true). */
  skipMerges?: boolean
}

const DEFAULT_MAX_COMMITS = 300
const DEFAULT_MAX_HOTSPOTS = 20

/**
 * Collect churn statistics for a project.
 *
 * Degrades to `{ isRepo: false }` for a non-git directory instead of throwing, so
 * the UI can explain why the timeline is empty.
 */
export async function analyzeEvolution(
  rootPath: string,
  opts: EvolutionOptions = {},
): Promise<EvolutionResult> {
  const maxCommits = opts.maxCommits ?? DEFAULT_MAX_COMMITS
  const maxHotspots = opts.maxHotspots ?? DEFAULT_MAX_HOTSPOTS
  const skipMerges = opts.skipMerges ?? true

  const empty: EvolutionResult = {
    isRepo: false, commitsScanned: 0, since: null, until: null,
    buckets: [], hotspots: [], hottestPath: null,
  }

  const git = simpleGit({ baseDir: rootPath })
  try {
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return empty
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) }
  }

  let log
  try {
    log = await git.log({
      maxCount: maxCommits,
      '--no-merges': skipMerges ? null : undefined,
    })
  } catch (err) {
    // An empty repository has no HEAD yet.
    return { ...empty, isRepo: true, error: err instanceof Error ? err.message : String(err) }
  }

  const commits = log.all ?? []
  if (commits.length === 0) return { ...empty, isRepo: true }

  // Node counts per file, from the indexed graph.
  const graph = loadGraph(rootPath)
  const nodesPerFile = new Map<string, number>()
  for (const node of graph?.nodes ?? []) {
    if (!node.filePath) continue
    nodesPerFile.set(node.filePath, (nodesPerFile.get(node.filePath) ?? 0) + 1)
  }

  const churn = new Map<string, FileChurn>()
  const buckets = new Map<string, number>()

  for (const commit of commits) {
    const date = commit.date
    const month = date.slice(0, 7)
    buckets.set(month, (buckets.get(month) ?? 0) + 1)

    // `git log` without --name-only gives no file list; use the diff summary of
    // this commit only when it is already present in the entry.
    const files = (commit as { diff?: { files?: Array<{ file: string }> } }).diff?.files ?? []
    for (const file of files) {
      const path = file.file
      const existing = churn.get(path)
      if (existing) {
        existing.commits += 1
        if (date > existing.lastChanged) existing.lastChanged = date
      } else {
        churn.set(path, {
          path,
          commits: 1,
          lastChanged: date,
          nodeCount: nodesPerFile.get(path) ?? 0,
        })
      }
    }
  }

  // `simple-git` omits file lists unless requested, so fetch them in one pass.
  if (churn.size === 0) {
    try {
      const raw = await git.raw([
        'log',
        `--max-count=${maxCommits}`,
        ...(skipMerges ? ['--no-merges'] : []),
        '--name-only',
        '--pretty=format:__COMMIT__%H|%cI',
      ])
      let currentDate = ''
      for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (trimmed.startsWith('__COMMIT__')) {
          currentDate = trimmed.split('|')[1] ?? ''
          continue
        }
        const existing = churn.get(trimmed)
        if (existing) {
          existing.commits += 1
          if (currentDate > existing.lastChanged) existing.lastChanged = currentDate
        } else {
          churn.set(trimmed, {
            path: trimmed,
            commits: 1,
            lastChanged: currentDate,
            nodeCount: nodesPerFile.get(trimmed) ?? 0,
          })
        }
      }
    } catch {
      /* keep whatever we have */
    }
  }

  const hotspots = [...churn.values()]
    .sort((a, b) => b.commits - a.commits || a.path.localeCompare(b.path))
    .slice(0, maxHotspots)

  const bucketList = [...buckets.entries()]
    .map(([month, count]) => ({ month, commits: count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    isRepo: true,
    commitsScanned: commits.length,
    since: commits[commits.length - 1]?.date ?? null,
    until: commits[0]?.date ?? null,
    buckets: bucketList,
    hotspots,
    hottestPath: hotspots[0]?.path ?? null,
  }
}
