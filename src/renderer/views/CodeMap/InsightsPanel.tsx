/**
 * InsightsPanel — graph exploration (A2) and tech-debt scan (A7).
 *
 * Two questions a reader asks right after the first overview:
 *   - "how is this connected?" → neighbours of the focused node, graph stats,
 *     and the shortest path between two nodes (graph:neighbors / graph:stats,
 *     which had no UI before, plus the new findPath on the IPC surface).
 *   - "what is risky here?" → TODO/FIXME markers, oversized files and high
 *     fan-in nodes.
 */
import { useState, useEffect, useCallback } from 'react'
import { Network, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react'
import { postToDashboard } from './GraphPanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  focusedNodeId?: string | null
  t: (key: string, opts?: Record<string, unknown>) => string
  onOpenNode?: (nodeId: string) => void
  /** Open a file (and optionally a line) in the active panel. */
  onOpenFile?: (path: string, line?: number) => void
}

interface GraphNodeLite {
  id: string
  label?: string
  name?: string
  type?: string
  filePath?: string
  lineRange?: [number, number]
  metadata?: { summary?: string }
}

interface Stats {
  nodeCount: number
  edgeCount: number
  byType?: Record<string, number>
}

interface DebtItem {
  kind: 'todo' | 'large-file' | 'high-fan-in' | 'no-summary'
  detail: string
  path?: string
  line?: number
  nodeId?: string
  weight: number
}

interface DebtResult {
  items: DebtItem[]
  counts: Record<string, number>
  filesScanned: number
}

type Section = 'explore' | 'debt' | 'evolution' | 'clusters'

export default function InsightsPanel({ projectId, focusedNodeId, t, onOpenNode, onOpenFile }: Props) {
  const [section, setSection] = useState<Section>('explore')

  const [stats, setStats] = useState<Stats | null>(null)
  const [neighbors, setNeighbors] = useState<GraphNodeLite[]>([])
  const [depth, setDepth] = useState(1)
  const [loadingNeighbors, setLoadingNeighbors] = useState(false)

  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [pathResult, setPathResult] = useState<{ found: boolean; hops: number; nodes: GraphNodeLite[]; truncated?: boolean } | null>(null)
  const [pathLoading, setPathLoading] = useState(false)

  const [debt, setDebt] = useState<DebtResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [debtError, setDebtError] = useState<string | null>(null)

  // B5: AI review findings
  const [findings, setFindings] = useState<ReviewFinding[]>([])
  const [auditing, setAuditing] = useState(false)
  const [auditMsg, setAuditMsg] = useState<string | null>(null)

  // B7: evolution timeline
  const [evolution, setEvolution] = useState<EvolutionResult | null>(null)
  const [loadingEvolution, setLoadingEvolution] = useState(false)

  // B8: communities
  const [clusterResult, setClusterResult] = useState<CommunityResult | null>(null)
  const [loadingClusters, setLoadingClusters] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const r = await window.fieldguide.graphStats(projectId)
      if (r.ok && r.data) setStats(r.data as Stats)
    } catch { /* ignore */ }
  }, [projectId])

  const loadNeighbors = useCallback(async () => {
    if (!projectId || !focusedNodeId) { setNeighbors([]); return }
    setLoadingNeighbors(true)
    try {
      const r = await window.fieldguide.graphNeighbors(projectId, focusedNodeId, depth)
      if (r.ok && r.data) {
        const payload = r.data as { nodes?: GraphNodeLite[] }
        setNeighbors((payload.nodes ?? []).filter((n) => n.id !== focusedNodeId))
      }
    } catch { /* ignore */ }
    finally { setLoadingNeighbors(false) }
  }, [projectId, focusedNodeId, depth])

  // Declared after the loaders: a dependency array is evaluated during render, so a
  // later `const` would be a TDZ error.
  useEffect(() => {
    if (!projectId) return
    void loadStats()
    void loadNeighbors()
  }, [projectId, focusedNodeId, depth, loadStats, loadNeighbors])

  async function findPath() {
    if (!projectId || !fromId.trim() || !toId.trim()) return
    setPathLoading(true)
    setPathResult(null)
    try {
      // The path search reuses the graph search channel to resolve ids, then
      // walks the neighbourhood: the shell has no dedicated path IPC, so we ask
      // the coach-facing graph tools through graph:neighbors is not enough —
      // instead compute client-side over the full graph (bounded, cached).
      const r = await window.fieldguide.graphGet(projectId)
      if (!r.ok || !r.data) return
      const g = r.data as { nodes?: GraphNodeLite[]; edges?: Array<{ source: string; target: string; type?: string }> }
      const result = breadthFirstPath(g.nodes ?? [], g.edges ?? [], fromId.trim(), toId.trim(), 12)
      setPathResult(result)
    } catch { /* ignore */ }
    finally { setPathLoading(false) }
  }

  async function runDebtScan() {
    setScanning(true)
    setDebtError(null)
    try {
      const r = await window.fieldguide.insightsDebtScan(projectId)
      if (r.ok && r.data) setDebt(r.data as DebtResult)
      else setDebtError(r.error?.message ?? t('insights.scanFailed'))
    } catch (err) {
      setDebtError(String(err))
    } finally {
      setScanning(false)
    }
  }

  /** B5: LLM (or heuristic) review of the most load-bearing files. */
  async function runAudit() {
    setAuditing(true)
    setAuditMsg(null)
    try {
      const r = await window.fieldguide.reviewAudit(projectId, { maxFiles: 6 })
      if (r.ok && r.data) {
        setFindings(r.data.findings)
        setAuditMsg(t('insights.auditDone', {
          count: r.data.findings.length,
          files: r.data.filesReviewed.length,
          source: t(r.data.source === 'llm' ? 'tutor.sourceLlm' : 'tutor.sourceHeuristic'),
        }))
      } else {
        setAuditMsg(r.error?.message ?? t('insights.auditFailed'))
      }
    } catch (err) {
      setAuditMsg(String(err))
    } finally {
      setAuditing(false)
    }
  }

  const loadFindings = useCallback(async () => {
    try {
      const r = await window.fieldguide.reviewFindings(projectId)
      if (r.ok && r.data) setFindings(r.data)
    } catch { /* ignore */ }
  }, [projectId])

  /** B7: git history × graph. */
  const loadEvolution = useCallback(async () => {
    setLoadingEvolution(true)
    try {
      const r = await window.fieldguide.insightsEvolution(projectId, 300)
      if (r.ok && r.data) setEvolution(r.data as EvolutionResult)
    } catch { /* ignore */ }
    finally { setLoadingEvolution(false) }
  }, [projectId])

  /** B8: modularity communities. */
  const loadClusters = useCallback(async () => {
    setLoadingClusters(true)
    try {
      const r = await window.fieldguide.insightsCommunities(projectId)
      if (r.ok && r.data) setClusterResult(r.data as CommunityResult)
    } catch { /* ignore */ }
    finally { setLoadingClusters(false) }
  }, [projectId])

  // Load stored findings with the panel; timeline/clusters run on demand.
  useEffect(() => { void loadFindings() }, [loadFindings])

  function focusNode(id: string) {
    postToDashboard({ type: 'focusNode', nodeId: id })
    onOpenNode?.(id)
  }

  const typeEntries = Object.entries(stats?.byType ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--fg-border)] shrink-0 overflow-x-auto">
        {(['explore', 'debt', 'evolution', 'clusters'] as Section[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={section === s}
            onClick={() => {
              setSection(s)
              if (s === 'evolution' && !evolution) void loadEvolution()
              if (s === 'clusters' && !clusterResult) void loadClusters()
            }}
            className={cn(
              'px-2.5 py-1 rounded text-[11px] font-medium transition-colors shrink-0',
              section === s
                ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]'
                : 'text-[var(--fg-text-tertiary)] hover:bg-[var(--fg-tree-hover)]',
            )}
          >
            {t(`insights.tab.${s}`)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {section === 'explore' && (
          <>
            {/* Graph stats */}
            <section>
              <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)] mb-1.5 inline-flex items-center gap-1">
                <Network size={12} />{t('insights.stats')}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-[var(--fg-border)] p-2 text-center">
                  <p className="text-lg font-semibold text-[var(--fg-text-primary)] tabular-nums">{stats?.nodeCount ?? '—'}</p>
                  <p className="text-[10px] text-[var(--fg-text-tertiary)]">{t('insights.nodes')}</p>
                </div>
                <div className="rounded border border-[var(--fg-border)] p-2 text-center">
                  <p className="text-lg font-semibold text-[var(--fg-text-primary)] tabular-nums">{stats?.edgeCount ?? '—'}</p>
                  <p className="text-[10px] text-[var(--fg-text-tertiary)]">{t('insights.edges')}</p>
                </div>
              </div>
              {typeEntries.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  <p className="text-[10px] text-[var(--fg-text-tertiary)]">{t('insights.types')}</p>
                  {typeEntries.map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2 text-[11px]">
                      <span className="w-20 truncate text-[var(--fg-text-secondary)]">{type}</span>
                      <div className="flex-1 h-1.5 rounded bg-[var(--fg-tree-hover)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--fg-accent)]"
                          style={{ width: `${Math.round((count / (stats?.nodeCount || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-[var(--fg-text-tertiary)] w-10 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Neighbours */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)]">{t('insights.neighbors')}</h4>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--fg-text-tertiary)]">{t('insights.depth')}</span>
                  {[1, 2].map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={depth === d}
                      onClick={() => setDepth(d)}
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px]',
                        depth === d
                          ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]'
                          : 'text-[var(--fg-text-tertiary)] hover:bg-[var(--fg-tree-hover)]',
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {!focusedNodeId ? (
                <p className="text-[var(--fg-text-tertiary)]">{t('insights.neighborsHint')}</p>
              ) : loadingNeighbors ? (
                <p className="text-[var(--fg-text-tertiary)]">{t('codeMap.loading')}</p>
              ) : neighbors.length === 0 ? (
                <p className="text-[var(--fg-text-tertiary)]">—</p>
              ) : (
                <div className="space-y-0.5">
                  {neighbors.slice(0, 60).map((n) => (
                    <div key={n.id} className="flex items-center gap-1 group">
                      <button
                        onClick={() => focusNode(n.id)}
                        className="flex-1 min-w-0 text-left px-1.5 py-1 rounded hover:bg-[var(--fg-tree-hover)]"
                      >
                        <span className="font-mono text-[var(--fg-accent-text)] truncate block">
                          {n.label || n.name || n.id}
                        </span>
                        <span className="text-[10px] text-[var(--fg-text-tertiary)] truncate block">
                          {n.type}{n.filePath ? ` · ${n.filePath}` : ''}
                        </span>
                      </button>
                      {n.filePath && onOpenFile && (
                        <button
                          onClick={() => onOpenFile(n.filePath!, n.lineRange?.[0])}
                          className="shrink-0 px-1.5 py-0.5 rounded text-[10px] text-[var(--fg-text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-[var(--fg-accent)] focus-visible:opacity-100"
                        >
                          {t('insights.openFile')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Path finder */}
            <section>
              <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)] mb-1.5">{t('insights.path')}</h4>
              <div className="space-y-1.5">
                <input
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                  placeholder={t('insights.pathFrom')}
                  aria-label={t('insights.pathFrom')}
                  className="w-full px-2 py-1 rounded border border-[var(--fg-border)] bg-[var(--fg-bg)] font-mono text-[11px]"
                />
                <input
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  placeholder={t('insights.pathTo')}
                  aria-label={t('insights.pathTo')}
                  className="w-full px-2 py-1 rounded border border-[var(--fg-border)] bg-[var(--fg-bg)] font-mono text-[11px]"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" disabled={pathLoading || !fromId.trim() || !toId.trim()} onClick={findPath}>
                    {pathLoading ? t('codeMap.loading') : t('insights.pathFind')}
                  </Button>
                  {focusedNodeId && (
                    <button
                      onClick={() => setFromId(focusedNodeId)}
                      className="text-[10px] text-[var(--fg-accent)] hover:underline"
                    >
                      {t('insights.pathUseFocus')}
                    </button>
                  )}
                </div>
              </div>

              {pathResult && (
                <div className="mt-2">
                  {pathResult.found ? (
                    <>
                      <p className="text-[10px] text-[var(--fg-status-success)] mb-1">
                        {t('insights.pathFound', { hops: pathResult.hops })}
                      </p>
                      <ol className="space-y-0.5">
                        {pathResult.nodes.map((n, i) => (
                          <li key={n.id} className="flex items-start gap-1">
                            <span className="text-[10px] text-[var(--fg-text-tertiary)] w-4 text-right shrink-0">{i + 1}</span>
                            <button
                              onClick={() => focusNode(n.id)}
                              className="text-left font-mono text-[11px] text-[var(--fg-accent-text)] hover:underline truncate"
                            >
                              {n.label || n.name || n.id}
                            </button>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <p className="text-[10px] text-[var(--fg-status-warning)]">
                      {pathResult.truncated
                        ? t('insights.pathTruncated', { depth: 12 })
                        : t('insights.pathNotFound')}
                    </p>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {section === 'debt' && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)] inline-flex items-center gap-1">
                <AlertTriangle size={12} />{t('insights.debt')}
              </h4>
              <Button size="sm" variant="ghost" disabled={scanning} onClick={runDebtScan}>
                {scanning
                  ? <><RefreshCw size={11} className="animate-spin" />{t('insights.scanning')}</>
                  : t('insights.scan')}
              </Button>
            </div>

            {debtError && <p className="text-[var(--fg-status-error)] mb-2">{debtError}</p>}

            {!debt && !scanning && (
              <p className="text-[var(--fg-text-tertiary)]">{t('insights.noDebt')}</p>
            )}

            {debt && (
              <>
                <div className="flex flex-wrap gap-1.5 mb-2 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-[var(--fg-status-warning-bg)] text-[var(--fg-status-warning)]">
                    {t('insights.todo')} {debt.counts.todo ?? 0}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--fg-tree-hover)] text-[var(--fg-text-secondary)]">
                    {t('insights.largeFile')} {debt.counts['large-file'] ?? 0}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--fg-tree-hover)] text-[var(--fg-text-secondary)]">
                    {t('insights.highFanIn')} {debt.counts['high-fan-in'] ?? 0}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--fg-text-tertiary)] mb-2">
                  {t('insights.filesScanned', { count: debt.filesScanned })}
                </p>

                <div className="space-y-0.5">
                  {debt.items.map((item, i) => (
                    <button
                      key={`${item.kind}-${item.path}-${item.line}-${i}`}
                      onClick={() => {
                        if (item.nodeId) focusNode(item.nodeId)
                        else if (item.path && onOpenFile) onOpenFile(item.path, item.line)
                      }}
                      className="w-full text-left px-1.5 py-1 rounded hover:bg-[var(--fg-tree-hover)]"
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'shrink-0 px-1 rounded text-[9px] uppercase',
                            item.kind === 'todo'
                              ? 'bg-[var(--fg-status-warning-bg)] text-[var(--fg-status-warning)]'
                              : 'bg-[var(--fg-tree-hover)] text-[var(--fg-text-tertiary)]',
                          )}
                        >
                          {item.kind === 'todo' ? 'TODO' : item.kind === 'large-file' ? 'SIZE' : 'FAN-IN'}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--fg-accent-text)] truncate">
                          {item.path}{item.line ? `:${item.line}` : ''}
                        </span>
                        <ArrowRight size={9} className="shrink-0 text-[var(--fg-text-tertiary)]" />
                      </span>
                      <span className="block text-[10px] text-[var(--fg-text-secondary)] truncate mt-0.5">{item.detail}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* B5: AI code/architecture review on top of the heuristic scan */}
            <div className="mt-4 pt-3 border-t border-[var(--fg-border)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)]">{t('insights.audit')}</h4>
                <Button size="sm" variant="ghost" disabled={auditing} onClick={runAudit}>
                  {auditing
                    ? <><RefreshCw size={11} className="animate-spin" />{t('insights.auditing')}</>
                    : t('insights.runAudit')}
                </Button>
              </div>

              <p className="text-[10px] text-[var(--fg-text-tertiary)] mb-2">{t('insights.auditHint')}</p>
              {auditMsg && <p className="text-[10px] text-[var(--fg-text-secondary)] mb-2">{auditMsg}</p>}

              {findings.length === 0 ? (
                <p className="text-[10px] text-[var(--fg-text-tertiary)]">{t('insights.noFindings')}</p>
              ) : (
                <div className="space-y-1">
                  {findings.map((finding) => (
                    <button
                      key={finding.id}
                      onClick={() => {
                        if (finding.file_path && onOpenFile) onOpenFile(finding.file_path, finding.line ?? undefined)
                        else if (finding.node_id) focusNode(finding.node_id)
                      }}
                      className="w-full text-left px-1.5 py-1 rounded hover:bg-[var(--fg-tree-hover)]"
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'shrink-0 px-1 rounded text-[9px] uppercase',
                            finding.severity === 'high'
                              ? 'bg-[var(--fg-status-error-bg)] text-[var(--fg-status-error)]'
                              : finding.severity === 'medium'
                                ? 'bg-[var(--fg-status-warning-bg)] text-[var(--fg-status-warning)]'
                                : 'bg-[var(--fg-tree-hover)] text-[var(--fg-text-tertiary)]',
                          )}
                        >
                          {finding.severity}
                        </span>
                        <span className="text-[10px] text-[var(--fg-text-tertiary)] shrink-0">{finding.kind}</span>
                        <span className="text-[11px] text-[var(--fg-text-primary)] truncate flex-1">{finding.title}</span>
                      </span>
                      {finding.detail && (
                        <span className="block text-[10px] text-[var(--fg-text-secondary)] mt-0.5 line-clamp-2">{finding.detail}</span>
                      )}
                      {finding.file_path && (
                        <span className="block font-mono text-[10px] text-[var(--fg-accent-text)] truncate">
                          {finding.file_path}{finding.line ? `:${finding.line}` : ''}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
        {section === 'evolution' && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)]">{t('insights.evolution')}</h4>
              <Button size="sm" variant="ghost" disabled={loadingEvolution} onClick={loadEvolution}>
                {loadingEvolution
                  ? <><RefreshCw size={11} className="animate-spin" />{t('insights.scanning')}</>
                  : t('insights.scan')}
              </Button>
            </div>

            {loadingEvolution && !evolution && <p className="text-[var(--fg-text-tertiary)]">{t('codeMap.loading')}</p>}

            {evolution && !evolution.isRepo && (
              <p className="text-[var(--fg-text-tertiary)]">{t('insights.notARepo')}</p>
            )}

            {evolution?.isRepo && (
              <>
                <p className="text-[10px] text-[var(--fg-text-tertiary)] mb-2">
                  {t('insights.evolutionSummary', {
                    commits: evolution.commitsScanned,
                    since: evolution.since ? evolution.since.slice(0, 10) : '—',
                  })}
                </p>

                {evolution.buckets.length > 0 && (
                  <div className="flex items-end gap-0.5 h-16 mb-3" role="img" aria-label={t('insights.evolution')}>
                    {evolution.buckets.map((bucket) => {
                      const max = Math.max(...evolution.buckets.map((b) => b.commits), 1)
                      return (
                        <div
                          key={bucket.month}
                          title={`${bucket.month}: ${bucket.commits}`}
                          className="flex-1 bg-[var(--fg-accent)]/70 rounded-t min-h-[2px]"
                          style={{ height: `${Math.max(4, (bucket.commits / max) * 100)}%` }}
                        />
                      )
                    })}
                  </div>
                )}

                <p className="text-[10px] text-[var(--fg-text-tertiary)] mb-1">{t('insights.hotspots')}</p>
                <div className="space-y-0.5">
                  {evolution.hotspots.map((spot) => (
                    <button
                      key={spot.path}
                      onClick={() => onOpenFile?.(spot.path)}
                      className="w-full text-left px-1.5 py-1 rounded hover:bg-[var(--fg-tree-hover)]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[var(--fg-accent-text)] truncate flex-1">{spot.path}</span>
                        <span className="text-[10px] text-[var(--fg-text-tertiary)] tabular-nums shrink-0">
                          {t('insights.commits', { count: spot.commits })}
                        </span>
                      </span>
                      <span className="text-[10px] text-[var(--fg-text-tertiary)]">
                        {t('insights.lastChanged', { date: spot.lastChanged.slice(0, 10) })}
                        {spot.nodeCount > 0 ? ` · ${t('insights.nodeCount', { count: spot.nodeCount })}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {section === 'clusters' && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)]">{t('insights.clusters')}</h4>
              <Button size="sm" variant="ghost" disabled={loadingClusters} onClick={loadClusters}>
                {loadingClusters
                  ? <><RefreshCw size={11} className="animate-spin" />{t('insights.scanning')}</>
                  : t('insights.scan')}
              </Button>
            </div>

            {loadingClusters && !clusterResult && <p className="text-[var(--fg-text-tertiary)]">{t('codeMap.loading')}</p>}

            {clusterResult && (
              <>
                <p className="text-[10px] text-[var(--fg-text-tertiary)] mb-2">
                  {t('insights.clusterSummary', {
                    count: clusterResult.communities.length,
                    cohesion: Math.round(clusterResult.cohesion * 100),
                  })}
                </p>
                <div className="space-y-2">
                  {clusterResult.communities.map((community) => (
                    <div key={community.id} className="rounded border border-[var(--fg-border)] p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] text-[var(--fg-accent-text)] truncate flex-1" title={community.dominantPath}>
                          {community.dominantPath}
                        </span>
                        <span className="text-[10px] text-[var(--fg-text-tertiary)] tabular-nums shrink-0">
                          {t('insights.clusterSize', { count: community.nodeIds.length })}
                        </span>
                      </div>
                      <div className="h-1 rounded bg-[var(--fg-tree-hover)] overflow-hidden mb-1.5">
                        <div className="h-full bg-[var(--fg-accent)]" style={{ width: `${Math.round(community.weight * 100)}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {community.nodeIds.slice(0, 8).map((id) => (
                          <button
                            key={id}
                            onClick={() => focusNode(id)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--fg-tree-hover)] text-[var(--fg-text-secondary)] font-mono truncate max-w-[150px] hover:text-[var(--fg-accent)]"
                            title={id}
                          >
                            {id.split(':').pop()?.split('/').pop() || id}
                          </button>
                        ))}
                        {community.nodeIds.length > 8 && (
                          <span className="text-[10px] text-[var(--fg-text-tertiary)] self-center">
                            +{community.nodeIds.length - 8}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

/**
 * Breadth-first shortest path, mirroring `graph-reader.findPath` for the
 * renderer side (which only has the serialized graph via `graph:get`).
 * Edges are treated as undirected; `maxDepth` bounds the work on big graphs.
 */
function breadthFirstPath(
  nodes: GraphNodeLite[],
  edges: Array<{ source: string; target: string }>,
  fromId: string,
  toId: string,
  maxDepth: number,
): { found: boolean; hops: number; nodes: GraphNodeLite[]; truncated?: boolean } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  if (!byId.has(fromId) || !byId.has(toId)) return { found: false, hops: 0, nodes: [] }
  if (fromId === toId) return { found: true, hops: 0, nodes: [byId.get(fromId)!] }

  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, [])
    adjacency.get(edge.source)!.push(edge.target)
    adjacency.get(edge.target)!.push(edge.source)
  }

  const cameFrom = new Map<string, string>()
  const visited = new Set<string>([fromId])
  let frontier = [fromId]
  let depth = 0

  while (frontier.length > 0) {
    if (depth >= maxDepth) return { found: false, hops: 0, nodes: [], truncated: true }
    const next: string[] = []
    for (const current of frontier) {
      for (const neighbour of adjacency.get(current) ?? []) {
        if (visited.has(neighbour)) continue
        visited.add(neighbour)
        cameFrom.set(neighbour, current)
        if (neighbour === toId) {
          const chain: string[] = [toId]
          let cursor = toId
          while (cursor !== fromId) {
            cursor = cameFrom.get(cursor)!
            chain.unshift(cursor)
          }
          return {
            found: true,
            hops: chain.length - 1,
            nodes: chain.map((id) => byId.get(id)!).filter(Boolean),
          }
        }
        next.push(neighbour)
      }
    }
    frontier = next
    depth++
  }

  return { found: false, hops: 0, nodes: [] }
}
