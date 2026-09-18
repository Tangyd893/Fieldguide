/**
 * TutorPanel — Socratic coaching (B4) and learning paths (B6).
 *
 * The chat panel answers questions; this one asks them. Both sections are driven
 * by the current focus (graph node / open file), so the coach can only quiz you on
 * something it can actually see in the project.
 */
import { useState, useEffect, useCallback } from 'react'
import { GraduationCap, Route, Lightbulb, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  focusedNodeId?: string | null
  activeFilePath?: string | null
  t: (key: string, opts?: Record<string, unknown>) => string
  onOpenFile?: (path: string, line?: number) => void
  onOpenNode?: (nodeId: string) => void
}

type Section = 'tutor' | 'path'

interface PathRow {
  id: string
  goal: string
  source: string
  created_at: string
  steps: LearningStep[]
}

export default function TutorPanel({ projectId, focusedNodeId, activeFilePath, t, onOpenFile, onOpenNode }: Props) {
  const [section, setSection] = useState<Section>('tutor')

  // B4 state
  const [question, setQuestion] = useState<TutorQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [evaluation, setEvaluation] = useState<TutorEvaluation | null>(null)
  const [asking, setAsking] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [tutorError, setTutorError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  // B6 state
  const [goal, setGoal] = useState('')
  const [paths, setPaths] = useState<PathRow[]>([])
  const [generating, setGenerating] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)

  const loadPaths = useCallback(async () => {
    if (!projectId) return
    try {
      const r = await window.fieldguide.pathList(projectId)
      if (r.ok && r.data) setPaths(r.data as PathRow[])
    } catch { /* ignore */ }
  }, [projectId])

  useEffect(() => { void loadPaths() }, [loadPaths])

  async function askQuestion() {
    setAsking(true)
    setTutorError(null)
    setEvaluation(null)
    setAnswer('')
    setRevealed(false)
    try {
      const r = await window.fieldguide.tutorQuestion(projectId, {
        focusedNodeId: focusedNodeId ?? null,
        filePath: activeFilePath ?? null,
      })
      if (r.ok && r.data) setQuestion(r.data)
      else setTutorError(r.error?.message ?? t('tutor.failed'))
    } catch (err) {
      setTutorError(String(err))
    } finally {
      setAsking(false)
    }
  }

  async function evaluate() {
    if (!question || !answer.trim()) return
    setEvaluating(true)
    setTutorError(null)
    try {
      const r = await window.fieldguide.tutorEvaluate(projectId, {
        question: question.question,
        answer,
        hints: question.hints,
        focusedNodeId: focusedNodeId ?? null,
      })
      if (r.ok && r.data) setEvaluation(r.data)
      else setTutorError(r.error?.message ?? t('tutor.failed'))
    } catch (err) {
      setTutorError(String(err))
    } finally {
      setEvaluating(false)
    }
  }

  async function generatePath() {
    if (!goal.trim()) return
    setGenerating(true)
    setPathError(null)
    try {
      const r = await window.fieldguide.pathGenerate(projectId, goal.trim())
      if (r.ok) {
        setGoal('')
        await loadPaths()
      } else {
        setPathError(r.error?.message ?? t('tutor.pathFailed'))
      }
    } catch (err) {
      setPathError(String(err))
    } finally {
      setGenerating(false)
    }
  }

  async function clearPaths() {
    await window.fieldguide.pathClear(projectId)
    await loadPaths()
  }

  const verdictStyle = (verdict: TutorEvaluation['verdict']) =>
    verdict === 'strong' ? 'text-[var(--fg-status-success)]'
      : verdict === 'ok' ? 'text-[var(--fg-status-warning)]'
        : 'text-[var(--fg-status-error)]'

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--fg-border)] shrink-0">
        {(['tutor', 'path'] as Section[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={section === s}
            onClick={() => setSection(s)}
            className={cn(
              'px-2.5 py-1 rounded text-[11px] font-medium transition-colors inline-flex items-center gap-1',
              section === s
                ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]'
                : 'text-[var(--fg-text-tertiary)] hover:bg-[var(--fg-tree-hover)]',
            )}
          >
            {s === 'tutor' ? <GraduationCap size={11} /> : <Route size={11} />}
            {t(s === 'tutor' ? 'tutor.tabTutor' : 'tutor.tabPath')}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {section === 'tutor' && (
          <>
            <section className="rounded border border-[var(--fg-border)] p-2">
              <p className="text-[10px] text-[var(--fg-text-tertiary)] mb-1">{t('tutor.context')}</p>
              <p className="font-mono text-[10px] text-[var(--fg-text-secondary)] truncate">
                {focusedNodeId ?? t('tutor.noFocus')}
              </p>
              {activeFilePath && (
                <p className="font-mono text-[10px] text-[var(--fg-text-tertiary)] truncate mt-0.5">{activeFilePath}</p>
              )}
              <Button size="sm" className="mt-2" disabled={asking} onClick={askQuestion}>
                {asking
                  ? <><RefreshCw size={11} className="animate-spin" />{t('tutor.asking')}</>
                  : t(question ? 'tutor.askAnother' : 'tutor.ask')}
              </Button>
            </section>

            {tutorError && (
              <p className="text-[10px] text-[var(--fg-status-error)] inline-flex items-start gap-1">
                <AlertCircle size={11} className="mt-0.5 shrink-0" />{tutorError}
              </p>
            )}

            {question && (
              <>
                <section className="rounded-lg border border-[var(--fg-border)] bg-[var(--fg-card)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--fg-text-tertiary)] mb-1.5">
                    {t('tutor.question')} · {t(question.source === 'llm' ? 'tutor.sourceLlm' : 'tutor.sourceHeuristic')}
                  </p>
                  <p className="text-[12px] text-[var(--fg-text-primary)] font-medium whitespace-pre-wrap">
                    {question.question}
                  </p>
                  {question.nodeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {question.nodeIds.slice(0, 4).map((id) => (
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
                </section>

                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={t('tutor.answerPlaceholder')}
                  aria-label={t('tutor.answerPlaceholder')}
                  className="w-full h-28 px-2 py-1.5 text-[11px] rounded border border-[var(--fg-border)] bg-[var(--fg-bg)] resize-y"
                />

                <div className="flex items-center gap-2">
                  <Button size="sm" disabled={evaluating || !answer.trim()} onClick={evaluate}>
                    {evaluating
                      ? <><RefreshCw size={11} className="animate-spin" />{t('tutor.evaluating')}</>
                      : t('tutor.evaluate')}
                  </Button>
                  <button
                    onClick={() => setRevealed((v) => !v)}
                    className="text-[10px] text-[var(--fg-accent)] inline-flex items-center gap-1 hover:underline"
                  >
                    <Lightbulb size={10} />{revealed ? t('tutor.hidePoints') : t('tutor.showPoints')}
                  </button>
                </div>

                {revealed && question.hints.length > 0 && (
                  <ul className="space-y-1 pl-1">
                    {question.hints.map((hint, i) => (
                      <li key={i} className="text-[11px] text-[var(--fg-text-secondary)] flex items-start gap-1">
                        <span className="text-[var(--fg-text-tertiary)]">·</span>{hint}
                      </li>
                    ))}
                  </ul>
                )}

                {evaluation && (
                  <section className="rounded border border-[var(--fg-border)] p-2 space-y-1.5">
                    <p className={cn('text-[11px] font-medium inline-flex items-center gap-1', verdictStyle(evaluation.verdict))}>
                      <CheckCircle2 size={11} />
                      {t('tutor.score', { score: evaluation.score })}
                      {' · '}
                      {t(`tutor.verdict.${evaluation.verdict}`)}
                    </p>
                    {evaluation.feedback && (
                      <p className="text-[11px] text-[var(--fg-text-secondary)]">{evaluation.feedback}</p>
                    )}
                    {evaluation.missed.length > 0 && (
                      <div>
                        <p className="text-[10px] text-[var(--fg-text-tertiary)]">{t('tutor.missed')}</p>
                        <ul className="space-y-0.5">
                          {evaluation.missed.map((m, i) => (
                            <li key={i} className="text-[10px] text-[var(--fg-status-warning)]">· {m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {!question && !asking && (
              <p className="text-[10px] text-[var(--fg-text-tertiary)]">{t('tutor.hint')}</p>
            )}
          </>
        )}

        {section === 'path' && (
          <>
            <section className="space-y-1.5">
              <p className="text-[10px] text-[var(--fg-text-tertiary)]">{t('tutor.goalHint')}</p>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void generatePath() }}
                placeholder={t('tutor.goalPlaceholder')}
                aria-label={t('tutor.goalPlaceholder')}
                className="w-full px-2 py-1.5 text-[11px] rounded border border-[var(--fg-border)] bg-[var(--fg-bg)]"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={generating || !goal.trim()} onClick={generatePath}>
                  {generating
                    ? <><RefreshCw size={11} className="animate-spin" />{t('tutor.generatingPath')}</>
                    : t('tutor.generatePath')}
                </Button>
                {paths.length > 0 && (
                  <button onClick={clearPaths} className="text-[10px] text-[var(--fg-text-tertiary)] inline-flex items-center gap-1 hover:text-[var(--fg-status-error)]">
                    <Trash2 size={10} />{t('tutor.clearPaths')}
                  </button>
                )}
              </div>
            </section>

            {pathError && <p className="text-[10px] text-[var(--fg-status-error)]">{pathError}</p>}

            {paths.length === 0 ? (
              <p className="text-[10px] text-[var(--fg-text-tertiary)]">{t('tutor.noPaths')}</p>
            ) : (
              paths.map((path) => (
                <section key={path.id} className="rounded border border-[var(--fg-border)] p-2.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--fg-text-primary)] truncate">{path.goal}</p>
                      <p className="text-[10px] text-[var(--fg-text-tertiary)]">
                        {t(path.source === 'llm' ? 'tutor.sourceLlm' : 'tutor.sourceHeuristic')}
                        {' · '}{new Date(path.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <ol className="space-y-2">
                    {path.steps.map((step) => (
                      <li key={step.order} className="flex gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] text-[10px] flex items-center justify-center tabular-nums">
                          {step.order}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] text-[var(--fg-text-primary)]">{step.title}</p>
                          {step.why && <p className="text-[10px] text-[var(--fg-text-tertiary)]">{step.why}</p>}
                          {(step.files ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(step.files ?? []).slice(0, 4).map((file) => (
                                <button
                                  key={file}
                                  onClick={() => onOpenFile?.(file)}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--fg-tree-hover)] text-[var(--fg-text-secondary)] font-mono truncate max-w-[200px] hover:text-[var(--fg-accent)]"
                                >
                                  {file}
                                </button>
                              ))}
                            </div>
                          )}
                          {(step.nodeIds ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(step.nodeIds ?? []).slice(0, 4).map((id) => (
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
                      </li>
                    ))}
                  </ol>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
