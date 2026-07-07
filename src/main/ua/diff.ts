/**
 * Diff analysis module — maps changed files to graph nodes and identifies
 * affected components via the UA buildDiffContext function.
 *
 * Used by: IPC handler `diff:analyze`, which writes diff-overlay.json
 * and pushes results to the dashboard via postMessage.
 */
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { execSync } from 'node:child_process'
import { loadGraph } from './graph-reader'
import type { ProjectRow } from '../db'

// ─── Diff overlay types ───

export interface DiffOverlay {
  version: string
  generatedAt: string
  changedFiles: string[]
  changedNodeIds: string[]
  affectedNodeIds: string[]
}

export interface DiffAnalysisResult {
  /** Total changed files detected */
  changedFileCount: number
  /** Files not present in the knowledge graph */
  unmappedFileCount: number
  /** Graph nodes directly matching changed files */
  changedNodeCount: number
  /** Graph nodes affected via 1-hop edges */
  affectedNodeCount: number
  /** IDs of changed nodes (for dashboard highlighting) */
  changedNodeIds: string[]
  /** IDs of affected nodes (for dashboard highlighting) */
  affectedNodeIds: string[]
  /** Formatted markdown summary for the user */
  summary: string
}

// ─── File change detection ───

/**
 * Detect changed files since the last graph analysis.
 * Prefers git diff when available; falls back to mtime comparison.
 */
function detectChangedFiles(projectRoot: string, analyzedAt: string): string[] {
  // Try git diff first (more accurate)
  try {
    const gitDir = join(projectRoot, '.git')
    if (existsSync(gitDir)) {
      // Get the commit hash from the graph metadata, or fall back
      // to files changed since the graph was generated
      const since = new Date(analyzedAt)
      const output = execSync(
        `git log --since="${since.toISOString()}" --name-only --pretty=format: --diff-filter=AM -- "*.go" "*.ts" "*.tsx" "*.js" "*.py" "*.rs" "*.java"`,
        { cwd: projectRoot, timeout: 10_000, encoding: 'utf-8' },
      )
      return output
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
    }
  } catch {
    // git not available or not a repo — fall through to mtime
  }

  // Fallback: walk filesystem and compare mtime with analyzedAt
  const since = new Date(analyzedAt).getTime()
  if (isNaN(since)) return []

  const changedFiles: string[] = []

  const IGNORE_DIRS = new Set([
    '.git', 'node_modules', '.understand-anything', 'vendor',
    '__pycache__', '.venv', 'dist', 'build', 'out', '.next',
    'target', '.turbo', '.cache', '.idea', '.vscode',
  ])

  function walk(dir: string): void {
    let entries: Dirent[]
    try { entries = readdirSync(dir, { withFileTypes: true }) }
    catch { return }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue
      if (IGNORE_DIRS.has(entry.name)) continue

      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile()) {
        try {
          const st = statSync(fullPath)
          if (st.mtimeMs > since) {
            changedFiles.push(fullPath.replace(projectRoot + '/', '').replace(/\\/g, '/'))
          }
        } catch { /* skip */ }
      }
    }
  }

  walk(projectRoot)
  return changedFiles
}

// ─── Main analysis ───

/**
 * Analyze which graph nodes are affected by file changes since the last index.
 *
 * 1. Detects changed files (git diff or mtime)
 * 2. Maps changed files → graph nodes
 * 3. Finds affected nodes via 1-hop edge traversal
 * 4. Writes diff-overlay.json for dashboard auto-load
 * 5. Returns a structured summary
 */
export function analyzeProjectDiff(project: ProjectRow): DiffAnalysisResult | null {
  const graphPath = join(project.root_path, '.understand-anything', 'knowledge-graph.json')
  if (!existsSync(graphPath)) return null

  const graph = loadGraph(project.root_path)
  if (!graph) return null

  const analyzedAt = graph.project?.analyzedAt
  if (!analyzedAt) return null

  // 1. Detect changed files
  const changedFiles = detectChangedFiles(project.root_path, analyzedAt)
  if (changedFiles.length === 0) {
    return null // No changes
  }

  // 2. Build diff context (inline to avoid ESM import complexity)
  const nodes = graph.nodes || []
  const edges = graph.edges || []

  // Map changed files → node IDs (match by filePath)
  const changedNodeIds = new Set<string>()
  const unmappedFiles: string[] = []

  for (const file of changedFiles) {
    let mapped = false
    for (const node of nodes) {
      if (node.filePath === file) {
        changedNodeIds.add(node.id)
        mapped = true
      }
    }
    if (!mapped) unmappedFiles.push(file)
  }

  // Also include "contains" children of changed file nodes
  for (const edge of edges) {
    if (edge.type === 'contains' && changedNodeIds.has(edge.source)) {
      changedNodeIds.add(edge.target)
    }
  }

  // 3. Find affected nodes: 1-hop neighbors
  const affectedNodeIds = new Set<string>()
  for (const edge of edges) {
    const sourceChanged = changedNodeIds.has(edge.source)
    const targetChanged = changedNodeIds.has(edge.target)
    if (sourceChanged || targetChanged) {
      if (sourceChanged && !changedNodeIds.has(edge.target)) {
        affectedNodeIds.add(edge.target)
      }
      if (targetChanged && !changedNodeIds.has(edge.source)) {
        affectedNodeIds.add(edge.source)
      }
    }
  }

  // 4. Write diff-overlay.json
  const overlay: DiffOverlay = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    changedFiles,
    changedNodeIds: Array.from(changedNodeIds),
    affectedNodeIds: Array.from(affectedNodeIds),
  }

  const overlayPath = join(project.root_path, '.understand-anything', 'diff-overlay.json')
  writeFileSync(overlayPath, JSON.stringify(overlay, null, 2), 'utf-8')

  // 5. Build summary
  const changedNames = nodes
    .filter(n => changedNodeIds.has(n.id))
    .map(n => `- **${n.label || n.id}** (${n.type})`)
  const affectedNames = nodes
    .filter(n => affectedNodeIds.has(n.id))
    .map(n => `- **${n.label || n.id}** (${n.type})`)

  const summaryLines = [
    `## 变更影响分析: ${project.name}`,
    '',
    `**${changedFiles.length}** 个文件发生变更，**${changedNodeIds.size}** 个节点直接变化，**${affectedNodeIds.size}** 个节点可能受影响。`,
    '',
    '### 直接变更',
    ...(changedNames.length > 0 ? changedNames : ['- (无映射节点)']),
    '',
  ]

  if (affectedNames.length > 0) {
    summaryLines.push('### 可能受影响', ...affectedNames, '')
  }

  if (unmappedFiles.length > 0) {
    summaryLines.push(
      `### 未映射文件 (${unmappedFiles.length})`,
      ...unmappedFiles.map(f => `- \`${f}\``),
      '',
      '> 这些文件不在知识图谱中，可能新增或之前未被索引。建议运行增量索引。',
      '',
    )
  }

  return {
    changedFileCount: changedFiles.length,
    unmappedFileCount: unmappedFiles.length,
    changedNodeCount: changedNodeIds.size,
    affectedNodeCount: affectedNodeIds.size,
    changedNodeIds: Array.from(changedNodeIds),
    affectedNodeIds: Array.from(affectedNodeIds),
    summary: summaryLines.join('\n'),
  }
}

/**
 * Push diff overlay to the dashboard via postMessage.
 */
export function buildDiffPostMessage(result: DiffAnalysisResult & { changedNodeIds: string[]; affectedNodeIds: string[] }): {
  type: string
  changed: string[]
  affected: string[]
} {
  return {
    type: 'setDiffOverlay',
    changed: result.changedNodeIds,
    affected: result.affectedNodeIds,
  }
}
