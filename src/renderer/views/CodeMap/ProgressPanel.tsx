/**
 * ProgressPanel — learning progress (B1) and spaced-repetition review (B3).
 *
 * These two belong together: progress is what the reader has marked, review is
 * what the app asks back. The top section answers "how much of this project have
 * I actually learned?" and the second runs the review queue.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Target, CheckCircle2, Clock, RotateCw, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { renderMarkdown } from '@/lib/markdown'

interface Props {
  projectId: string
  focusedNodeId?: string | null
  t: (key: string, opts?: Record<string, unknown>) => string
  onOpenNode?: (nodeId: string) => void
  onOpenFile?: (path: string, line?: number) => void
}

type Section = 'progress' | 'review'

interface ProgressRow {
  node_id: string
  status: LearnStatus
  confidence: number
  review_count: number
  last_seen_at: string | null
}

interface CoreNode {
  id: string
  label: string
  type?: string
  filePath?: string
  fanIn: number
}

const RATING_LABELS: Array<{ rating: 0 | 1 | 2 | 3; key: string }> = [
  { rating: 0, key: 'progress.ratingForgot' },
  { rating: 1, key: 'progress.ratingHard' },
  { rating: 2, key: 'progress.ratingGood' },
  { rating: 3, key: 'progress.ratingEasy' },
]

export default function ProgressPanel({ projectId, focusedNodeId, t, onOpenNode, onOpenFile }: Props) {
  const [section, setSection] = useState<Section>('progress')

  const [rows, setRows] = useState<ProgressRow[]>([])
  const [core, setCore] = useState<CoreNode[]>([])
  const [totalNodes, setTotalNodes] = useState(0)
  const [loading, setLoading] = useState(true)

  const [cards, setCards] = useState<ReviewCard[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState<string | null>(null)

  const loadProgress = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [progressResult, graphResult] = await Promise.all([
        window.fieldguide.progressList(projectId),
        window.fieldguide.graphGet(projectId),
      ])
      if (progressResult.ok && progressResult.data) setRows(progressResult.data.rows as ProgressRow[])

      if (graphResult.ok && graphResult.data) {
        const graph = graphResult.data as {
          nodes?: Array<{ id: string; label?: string; name?: string; type?: string; filePath?: string }>
          edges?: Array<{ source: string; target: string; type?: string }>
        }
        const nodes = graph.nodes ?? []
        setTotalNodes(nodes.length)

        const fanIn = new Map<string, number>()
        for (const edge of graph.edges ?? []) {
          if (edge.type === 'contains') continue
          fanIn.set(edge.target, (fanIn.get(edge.target) ?? 0) + 1)
        }
        // "Core" = the nodes everything depends on: highest fan-in first.
        const ranked = nodes
          .map((n) => ({
            id: n.id,
            label: n.label || n.name || n.id,
            type: n.type,
            filePath: n.filePath,
            fanIn: fanIn.get(n.id) ?? 0,
          }))
          .filter((n) => n.fanIn > 0)
          .sort((a, b) => b.fanIn - a.fanIn || a.label.localeCompare(b.label))
          .slice(0, 40)
        setCore(ranked)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [projectId])

  const loadReview = useCallback(async () => {
    if (!projectId) return
    setCardsLoading(true)
    try {
      const r = await window.fieldguide.reviewList(projectId)
      if (r.ok && r.data) {
        setCards(r.data.cards)
        setStats(r.data.stats)
      }
    } catch { /* ignore */ }
    finally { setCardsLoading(false) }
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    void loadProgress()
    void loadReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const statusById = useMemo(() => {
    const map = new Map<string, ProgressRow>()
    for (const row of rows) map.set(row.node_id, row)
    return map
  }, [rows])

  const summary = useMemo(() => {
    const mastered = rows.filter((r) => r.status === 'mastered').length
    const reading = rows.filter((r) => r.status === 'reading').length
    const tracked = rows.filter((r) => r.status !== 'unseen').length
    const coreUnread = core.filter((n) => (statusById.get(n.id)?.status ?? 'unseen') === 'unseen')
    return {
      mastered,
      reading,
      tracked,
      percent: totalNodes > 0 ? Math.round((mastered / totalNodes) * 100) : 0,
      coreUnread,
    }
  }, [rows, core, statusById, totalNodes])

  async function mark(nodeId: string, status: LearnStatus) {
    await window.fieldguide.progressSet(projectId, nodeId, status)
    void loadProgress()
  }

  async function generateCards(reset = false) {
    setGenerating(true)
    try {
      const r = await window.fieldguide.reviewGenerate(projectId, reset)
      if (r.ok && r.data) {
        setGenerateMsg(t('progress.cardsGenerated', { added: r.data.added, total: r.data.total }))
        setTimeout(() => setGenerateMsg(null), 4000)
      }
      await loadReview()
    } finally {
      setGenerating(false)
    }
  }

  async function grade(rating: 0 | 1 | 2 | 3) {
    const card = dueCards[0]
    if (!card) return
    await window.fieldguide.reviewGrade(card.id, rating)
    setShowAnswer(false)
    await loadReview()
    void loadProgress()
  }

  const dueCards = useMemo(() => {
    const now = Date.now()
    return cards
      .filter((c) => Date.parse(c.due_at) <= now)
      .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))
  }, [cards])

  const currentCard = dueCards[0]

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--fg-border)] shrink-0">
        {(['progress', 'review'] as Section[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={section === s}
            onClick={() => setSection(s)}
            className={cn(
              'px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
              section === s
                ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]'
                : 'text-[var(--fg-text-tertiary)] hover:bg-[var(--fg-tree-hover)]',
            )}
          >
            {t(s === 'progress' ? 'progress.tabProgress' : 'progress.tabReview')}
            {s === 'review' && (stats?.dueNow ?? 0) > 0 && (
              <span className="ml-1 px-1 rounded-full bg-[var(--fg-accent)] text-white text-[9px]">
                {stats!.dueNow}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {section === 'progress' && (
          <>
            {/* Coverage ring */}
            <section className="flex items-center gap-4">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--fg-tree-hover)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none"
                    stroke="var(--fg-accent)" strokeWidth="3"
                    strokeDasharray={`${(summary.percent / 100) * 97.4} 97.4`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-semibold tabular-nums text-[var(--fg-text-primary)]">{summary.percent}%</span>
                  <span className="text-[9px] text-[var(--fg-text-tertiary)]">{t('progress.mastered')}</span>
                </div>
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] text-[var(--fg-text-secondary)]">
                  {t('progress.coverage', { nodes: totalNodes })}
                </p>
                <p className="text-[11px] text-[var(--fg-text-tertiary)] inline-flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-[var(--fg-status-success)]" />
                  {t('progress.masteredCount', { count: summary.mastered })}
                </p>
                <p className="text-[11px] text-[var(--fg-text-tertiary)] inline-flex items-center gap-1">
                  <Clock size={11} />{t('progress.readingCount', { count: summary.reading })}
                </p>
              </div>
            </section>

            {/* Unread core nodes */}
            <section>
              <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)] mb-1.5 inline-flex items-center gap-1">
                <Target size={12} />
                {t('progress.coreUnread', { count: summary.coreUnread.length })}
              </h4>

              {loading ? (
                <p className="text-[var(--fg-text-tertiary)]">{t('codeMap.loading')}</p>
              ) : summary.coreUnread.length === 0 ? (
                <p className="text-[var(--fg-status-success)]">{t('progress.allCoreRead')}</p>
              ) : (
                <div className="space-y-0.5">
                  {summary.coreUnread.slice(0, 25).map((node) => (
                    <div key={node.id} className="flex items-center gap-1 group">
                      <button
                        onClick={() => onOpenNode?.(node.id)}
                        className="flex-1 min-w-0 text-left px-1.5 py-1 rounded hover:bg-[var(--fg-tree-hover)]"
                        title={node.id}
                      >
                        <span className="font-mono text-[var(--fg-accent-text)] truncate block">{node.label}</span>
                        <span className="text-[10px] text-[var(--fg-text-tertiary)] truncate block">
                          {t('progress.fanIn', { count: node.fanIn })}
                          {node.filePath ? ` · ${node.filePath}` : ''}
                        </span>
                      </button>
                      <button
                        onClick={() => mark(node.id, 'mastered')}
                        aria-label={t('progress.markMastered')}
                        title={t('progress.markMastered')}
                        className="shrink-0 p-1 rounded text-[var(--fg-text-tertiary)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--fg-status-success)]"
                      >
                        <CheckCircle2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Focused node quick actions */}
            {focusedNodeId && (
              <section className="rounded border border-[var(--fg-border)] p-2">
                <p className="text-[10px] text-[var(--fg-text-tertiary)] mb-1.5">{t('progress.currentFocus')}</p>
                <p className="font-mono text-[11px] text-[var(--fg-accent-text)] truncate mb-2">{focusedNodeId}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['reading', 'mastered', 'unseen'] as LearnStatus[]).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={statusById.get(focusedNodeId)?.status === status ? 'default' : 'outline'}
                      onClick={() => mark(focusedNodeId, status)}
                    >
                      {t(`progress.status.${status}`)}
                    </Button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {section === 'review' && (
          <>
            <section className="flex items-center justify-between">
              <div className="text-[11px] text-[var(--fg-text-secondary)] space-y-0.5">
                <p>{t('progress.dueNow', { count: stats?.dueNow ?? 0 })}</p>
                <p className="text-[10px] text-[var(--fg-text-tertiary)]">
                  {t('progress.reviewStats', {
                    total: stats?.total ?? 0,
                    today: stats?.reviewedToday ?? 0,
                    streak: stats?.streakDays ?? 0,
                  })}
                </p>
                {(stats?.reviewedToday ?? 0) > 0 && (
                  <p className="text-[10px] text-[var(--fg-text-tertiary)]">
                    {t('progress.retention', { percent: Math.round((stats?.retentionToday ?? 0) * 100) })}
                  </p>
                )}
              </div>
              <Button size="sm" variant="ghost" disabled={generating} onClick={() => generateCards(false)}>
                {generating
                  ? <><RotateCw size={11} className="animate-spin" />{t('progress.generating')}</>
                  : t('progress.generateCards')}
              </Button>
            </section>

            {generateMsg && <p className="text-[10px] text-[var(--fg-status-success)]">{generateMsg}</p>}

            {cardsLoading ? (
              <p className="text-[var(--fg-text-tertiary)]">{t('codeMap.loading')}</p>
            ) : !currentCard ? (
              <p className="text-[var(--fg-text-tertiary)]">
                {cards.length === 0 ? t('progress.noCards') : t('progress.allReviewed')}
              </p>
            ) : (
              <section className="space-y-3">
                <div className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-card)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--fg-text-tertiary)] mb-1.5">
                    {t('progress.cardQuestion')} · {t(`progress.source.${currentCard.source_type}`)}
                  </p>
                  <p className="text-[12px] text-[var(--fg-text-primary)] font-medium whitespace-pre-wrap">
                    {currentCard.front}
                  </p>

                  {showAnswer ? (
                    <div className="mt-3 pt-3 border-t border-[var(--fg-border)] text-[11px] text-[var(--fg-text-secondary)]">
                      {renderMarkdown(currentCard.back)}
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowAnswer(true)}>
                      <Eye size={11} />{t('progress.showAnswer')}
                    </Button>
                  )}

                  {currentCard.nodeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {currentCard.nodeIds.slice(0, 4).map((id) => (
                        <button
                          key={id}
                          onClick={() => onOpenNode?.(id)}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] truncate max-w-[180px]"
                        >
                          {id.split('/').pop() || id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {showAnswer ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {RATING_LABELS.map(({ rating, key }) => (
                      <Button
                        key={rating}
                        size="sm"
                        variant={rating === 0 ? 'outline' : 'default'}
                        onClick={() => grade(rating)}
                        className={cn('text-[11px]', rating === 0 && 'hover:text-[var(--fg-status-error)]')}
                      >
                        {t(key)}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAnswer(true)}
                    className="text-[10px] text-[var(--fg-text-tertiary)] inline-flex items-center gap-1"
                  >
                    <EyeOff size={10} />{t('progress.answerHidden')}
                  </button>
                )}

                <div className="flex items-center justify-between text-[10px] text-[var(--fg-text-tertiary)]">
                  <span>{t('progress.remaining', { count: dueCards.length })}</span>
                  <button className="hover:underline" onClick={() => generateCards(true)}>
                    {t('progress.regenerate')}
                  </button>
                </div>
              </section>
            )}

            {cards.length > 0 && !currentCard && onOpenFile && (
              <p className="text-[10px] text-[var(--fg-text-tertiary)]">{t('progress.comeBackLater')}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
