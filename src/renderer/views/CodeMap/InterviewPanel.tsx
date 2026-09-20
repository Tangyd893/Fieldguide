/**
 * InterviewPanel — project-grounded interview drill.
 */
import { useCallback, useEffect, useState } from 'react'
import type { InterviewQuestion, AnalysisStage } from '../../../shared/understand'
import { postToDashboard } from './GraphPanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  t: (key: string, opts?: Record<string, unknown>) => string
  onOpenNode?: (nodeId: string) => void
}

export default function InterviewPanel({ projectId, t, onOpenNode }: Props) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await window.fieldguide.understandListQuestions(projectId)
      if (r.ok && Array.isArray(r.data)) {
        setQuestions(r.data as InterviewQuestion[])
        setIndex(0)
        setShowAnswer(false)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  async function regenerate() {
    setRunning(true)
    try {
      await window.fieldguide.understandRun(
        projectId,
        ['architecture', 'knowledge', 'interview'] satisfies AnalysisStage[],
      )
      await load()
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return <div className="p-3 text-xs text-[var(--fg-text-tertiary)]">{t('codeMap.loading')}</div>
  }

  if (questions.length === 0) {
    return (
      <div className="p-4 text-xs space-y-3">
        <p className="font-medium text-[var(--fg-text-secondary)]">{t('interview.empty')}</p>
        <p className="text-[var(--fg-text-tertiary)]">{t('interview.emptyHint')}</p>
        <Button size="sm" disabled={running} onClick={regenerate}>
          {running ? t('interview.generating') : t('interview.generate')}
        </Button>
      </div>
    )
  }

  const q = questions[Math.min(index, questions.length - 1)]

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fg-border)]">
        <h3 className="text-sm font-semibold text-[var(--fg-text-primary)]">
          {t('interview.title')}
          <span className="ml-2 font-normal text-[var(--fg-text-tertiary)]">
            {index + 1}/{questions.length}
          </span>
        </h3>
        <Button variant="ghost" size="sm" disabled={running} onClick={regenerate}>
          {running ? t('interview.generating') : t('interview.refresh')}
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--fg-text-tertiary)] mb-1">{t('interview.problem')}</div>
          <p className="text-sm text-[var(--fg-text-primary)] font-medium whitespace-pre-wrap">{q.problem}</p>
        </div>
        {q.context && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--fg-text-tertiary)] mb-1">{t('interview.context')}</div>
            <p className="text-[var(--fg-text-secondary)] whitespace-pre-wrap">{q.context}</p>
          </div>
        )}
        {q.relatedConcepts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {q.relatedConcepts.map(c => (
              <span key={c} className="px-2 py-0.5 rounded bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowAnswer(v => !v)}>
            {showAnswer ? t('interview.hideAnswer') : t('interview.showAnswer')}
          </Button>
          {q.relatedNodeIds[0] && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                postToDashboard({ type: 'focusNode', nodeId: q.relatedNodeIds[0] })
                onOpenNode?.(q.relatedNodeIds[0])
              }}
            >
              {t('interview.jumpGraph')}
            </Button>
          )}
        </div>

        {showAnswer && (
          <div className={cn('rounded border border-[var(--fg-border)] p-3 bg-[var(--fg-card)]')}>
            <div className="text-[10px] uppercase tracking-wide text-[var(--fg-text-tertiary)] mb-1">{t('interview.answer')}</div>
            <p className="text-[var(--fg-text-secondary)] whitespace-pre-wrap">{q.answer || '—'}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--fg-border)]">
        <Button
          size="sm"
          variant="ghost"
          disabled={index <= 0}
          onClick={() => { setIndex(i => Math.max(0, i - 1)); setShowAnswer(false) }}
        >
          {t('interview.prev')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={index >= questions.length - 1}
          onClick={() => { setIndex(i => Math.min(questions.length - 1, i + 1)); setShowAnswer(false) }}
        >
          {t('interview.next')}
        </Button>
      </div>
    </div>
  )
}
