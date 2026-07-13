/**
 * CostDialog — LLM 分析成本确认 (ui-spec §3.6, roadmap 2.8)
 */
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogCloseButton } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  t: (key: string, opts?: Record<string, unknown>) => string
  projectId: string
  projectName: string
  onCancel: () => void
  onContinue: () => void
  onSkipLLM: () => void
}

export default function CostDialog({ open, t, projectId, projectName, onCancel, onContinue, onSkipLLM }: Props) {
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [nodeCount, setNodeCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    loadStats()
  }, [projectId, open])

  async function loadStats() {
    setLoading(true)
    try {
      const graphResult = await window.fieldguide.graphGet(projectId)
      if (graphResult.ok && graphResult.data) {
        const g = graphResult.data as Record<string, unknown>
        const nodes = g.nodes as Array<unknown> | undefined
        const meta = g.project as Record<string, unknown> | undefined
        setNodeCount(nodes?.length ?? null)
        setFileCount((meta?.fileCount as number) ?? null)
        setLoading(false)
        return
      }
    } catch { /* ignore */ }

    try {
      const treeResult = await window.fieldguide.fileTree(projectId)
      if (treeResult.ok && treeResult.data) {
        const countFiles = (entries: unknown[]): number => {
          let n = 0
          for (const e of entries) {
            const entry = e as Record<string, unknown>
            if (entry.isDirectory && Array.isArray(entry.children)) n += countFiles(entry.children as unknown[])
            else if (!entry.isDirectory) n++
          }
          return n
        }
        setFileCount(countFiles(treeResult.data as unknown[]))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const estStructureTokens = fileCount ? fileCount * 200 : null
  const estLLMTokens = fileCount ? fileCount * 500 : null
  const estCost = estLLMTokens ? (estLLMTokens / 1_000_000 * 3).toFixed(2) : null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent className="w-[460px] max-w-[95vw] p-6 bg-[var(--fg-card)]">
        <div className="flex items-start justify-between mb-1">
          <DialogTitle className="pr-8">{t('cost.title', { name: projectName })}</DialogTitle>
          <DialogCloseButton />
        </div>
        <p className="text-sm text-[var(--fg-text-tertiary)] mb-4">{t('cost.modeSelect')}</p>

        {loading ? (
          <div className="text-center py-4 text-[var(--fg-text-tertiary)] text-sm">{t('cost.loading')}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {fileCount !== null && (
                <div className="bg-[var(--fg-tree-hover)] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--fg-text-primary)]">{fileCount}</p>
                  <p className="text-xs text-[var(--fg-text-tertiary)]">{t('cost.sourceFiles')}</p>
                </div>
              )}
              {nodeCount !== null && (
                <div className="bg-[var(--fg-tree-hover)] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--fg-text-primary)]">{nodeCount}</p>
                  <p className="text-xs text-[var(--fg-text-tertiary)]">{t('cost.structNodes')}</p>
                </div>
              )}
            </div>

            <div className="bg-[var(--fg-status-warning-bg)] border border-[var(--fg-status-warning)] rounded-lg p-3 mb-4">
              <p className="text-sm text-[var(--fg-status-warning)]">{t('cost.llmHint')}</p>
              {estCost && estLLMTokens && (
                <p className="text-xs text-[var(--fg-status-warning)] mt-2">
                  {t('cost.estTokens', { tokens: estLLMTokens.toLocaleString(), cost: estCost })}
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-3 mb-6">
          <Button onClick={onContinue} className="w-full">
            {t('cost.fullIndex')}
          </Button>
          <Button variant="outline" onClick={onSkipLLM} className="w-full">
            {t('cost.staticOnly')}
            {estStructureTokens && <span className="text-[var(--fg-text-tertiary)] ml-1">~{estStructureTokens.toLocaleString()} tokens</span>}
          </Button>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onCancel}>{t('cost.cancel')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
