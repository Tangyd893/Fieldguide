/**
 * OverviewPanel — Architecture Mapping summary (layers, modules, flows, stack).
 */
import { useCallback, useEffect, useState } from 'react'
import type { ArchitectureSummary } from '../../../shared/understand'
import { postToDashboard } from './GraphPanel'
import { Button } from '@/components/ui/button'

interface Props {
  projectId: string
  t: (key: string, opts?: Record<string, unknown>) => string
  onOpenNode?: (nodeId: string) => void
}

export default function OverviewPanel({ projectId, t, onOpenNode }: Props) {
  const [summary, setSummary] = useState<ArchitectureSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await window.fieldguide.understandGetArchitecture(projectId)
      if (r.ok) setSummary((r.data as ArchitectureSummary | null) ?? null)
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
      await window.fieldguide.understandRun(projectId, ['architecture'])
      await load()
    } finally {
      setRunning(false)
    }
  }

  function focusNode(nodeId: string) {
    postToDashboard({ type: 'focusNode', nodeId })
    onOpenNode?.(nodeId)
  }

  if (loading) {
    return <div className="p-3 text-xs text-[var(--fg-text-tertiary)]">{t('codeMap.loading')}</div>
  }

  if (!summary) {
    return (
      <div className="p-4 text-xs space-y-3">
        <p className="font-medium text-[var(--fg-text-secondary)]">{t('overview.empty')}</p>
        <p className="text-[var(--fg-text-tertiary)]">{t('overview.emptyHint')}</p>
        <Button size="sm" disabled={running} onClick={regenerate}>
          {running ? t('overview.generating') : t('overview.generate')}
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-3 space-y-4 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--fg-text-primary)]">{t('overview.title')}</h3>
          <p className="text-[10px] text-[var(--fg-text-tertiary)] mt-0.5">
            {t('overview.source', { source: summary.source })} · {new Date(summary.generatedAt).toLocaleString()}
          </p>
        </div>
        <Button variant="ghost" size="sm" disabled={running} onClick={regenerate}>
          {running ? t('overview.generating') : t('overview.refresh')}
        </Button>
      </div>

      {summary.stack.length > 0 && (
        <section>
          <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)] mb-1.5">{t('overview.stack')}</h4>
          <div className="flex flex-wrap gap-1">
            {summary.stack.map(s => (
              <span key={s} className="px-2 py-0.5 rounded bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {summary.entryPoints && summary.entryPoints.length > 0 && (
        <section>
          <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)] mb-1.5">{t('overview.entryPoints')}</h4>
          <ul className="space-y-1 text-[var(--fg-text-primary)]">
            {summary.entryPoints.map(e => (
              <li key={e} className="font-mono text-[11px] truncate">{e}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)] mb-1.5">{t('overview.layers')}</h4>
        <div className="space-y-2">
          {summary.layers.map((l, i) => (
            <div key={`${l.name}-${i}`} className="border-l-2 border-[var(--fg-accent)] pl-2">
              <div className="font-medium text-[var(--fg-text-primary)]">{l.name}</div>
              {l.description && <p className="text-[var(--fg-text-tertiary)] mt-0.5">{l.description}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)] mb-1.5">{t('overview.modules')}</h4>
        <div className="space-y-2">
          {summary.modules.map((m, i) => (
            <div key={`${m.name}-${i}`} className="rounded border border-[var(--fg-border)] p-2">
              <div className="font-medium text-[var(--fg-text-primary)]">{m.name}</div>
              {m.description && <p className="text-[var(--fg-text-tertiary)] mt-0.5">{m.description}</p>}
              {m.nodeIds && m.nodeIds.length > 0 && (
                <button
                  type="button"
                  className="mt-1 text-[10px] text-[var(--fg-accent-text)] hover:underline"
                  onClick={() => focusNode(m.nodeIds![0])}
                >
                  {t('overview.jumpGraph')}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)] mb-1.5">{t('overview.flows')}</h4>
        <div className="space-y-2">
          {summary.keyFlows.map((f, i) => (
            <div key={`${f.name}-${i}`}>
              <div className="font-medium text-[var(--fg-text-primary)]">{f.name}</div>
              {f.description && <p className="text-[var(--fg-text-tertiary)]">{f.description}</p>}
              {f.steps && f.steps.length > 0 && (
                <ol className="mt-1 list-decimal list-inside text-[var(--fg-text-secondary)] space-y-0.5">
                  {f.steps.map((s, j) => <li key={j}>{s}</li>)}
                </ol>
              )}
            </div>
          ))}
        </div>
      </section>

      {summary.techChoices.length > 0 && (
        <section>
          <h4 className="text-[11px] font-medium text-[var(--fg-text-secondary)] mb-1.5">{t('overview.tech')}</h4>
          <ul className="space-y-2">
            {summary.techChoices.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <span className="font-medium text-[var(--fg-text-primary)]">{c.name}</span>
                {c.reason && <p className="text-[var(--fg-text-tertiary)]">{c.reason}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
