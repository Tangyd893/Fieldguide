/**
 * KnowledgePanel — in-app knowledge cards extracted from the project.
 */
import { useEffect, useState } from 'react'
import type { KnowledgeNode } from '../../../shared/understand'
import { postToDashboard } from './GraphPanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  t: (key: string, opts?: Record<string, unknown>) => string
  onOpenNode?: (nodeId: string) => void
}

export default function KnowledgePanel({ projectId, t, onOpenNode }: Props) {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await window.fieldguide.understandListKnowledge(projectId)
      if (r.ok && Array.isArray(r.data)) {
        const list = r.data as KnowledgeNode[]
        setNodes(list)
        if (list.length && !selectedId) setSelectedId(list[0].id)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [projectId])

  async function regenerate() {
    setRunning(true)
    try {
      await window.fieldguide.understandRun(projectId, ['architecture', 'knowledge'])
      await load()
    } finally {
      setRunning(false)
    }
  }

  const selected = nodes.find(n => n.id === selectedId) || nodes[0]

  if (loading) {
    return <div className="p-3 text-xs text-[var(--fg-text-tertiary)]">{t('codeMap.loading')}</div>
  }

  if (nodes.length === 0) {
    return (
      <div className="p-4 text-xs space-y-3">
        <p className="font-medium text-[var(--fg-text-secondary)]">{t('knowledge.empty')}</p>
        <p className="text-[var(--fg-text-tertiary)]">{t('knowledge.emptyHint')}</p>
        <Button size="sm" disabled={running} onClick={regenerate}>
          {running ? t('knowledge.generating') : t('knowledge.generate')}
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fg-border)]">
        <h3 className="text-sm font-semibold text-[var(--fg-text-primary)]">{t('knowledge.title')}</h3>
        <Button variant="ghost" size="sm" disabled={running} onClick={regenerate}>
          {running ? t('knowledge.generating') : t('knowledge.refresh')}
        </Button>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div className="w-[38%] border-r border-[var(--fg-border)] overflow-auto">
          {nodes.map(n => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelectedId(n.id)}
              className={cn(
                'w-full text-left px-3 py-2 border-b border-[var(--fg-border)] hover:bg-[var(--fg-tree-hover)]',
                selected?.id === n.id && 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]',
              )}
            >
              {n.concept}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {selected && (
            <>
              <h4 className="text-sm font-semibold text-[var(--fg-text-primary)]">{selected.concept}</h4>
              <section>
                <div className="text-[10px] uppercase tracking-wide text-[var(--fg-text-tertiary)] mb-1">{t('knowledge.principle')}</div>
                <p className="text-[var(--fg-text-secondary)] whitespace-pre-wrap">{selected.principle || '—'}</p>
              </section>
              <section>
                <div className="text-[10px] uppercase tracking-wide text-[var(--fg-text-tertiary)] mb-1">{t('knowledge.tradeoffs')}</div>
                <p className="text-[var(--fg-text-secondary)] whitespace-pre-wrap">{selected.tradeoffs || '—'}</p>
              </section>
              <section>
                <div className="text-[10px] uppercase tracking-wide text-[var(--fg-text-tertiary)] mb-1">{t('knowledge.examples')}</div>
                <p className="text-[var(--fg-text-secondary)] whitespace-pre-wrap">{selected.examples || '—'}</p>
              </section>
              {selected.relatedNodeIds.length > 0 && (
                <button
                  type="button"
                  className="text-[11px] text-[var(--fg-accent-text)] hover:underline"
                  onClick={() => {
                    const id = selected.relatedNodeIds[0]
                    postToDashboard({ type: 'focusNode', nodeId: id })
                    onOpenNode?.(id)
                  }}
                >
                  {t('knowledge.jumpGraph')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
