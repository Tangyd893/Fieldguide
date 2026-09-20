/**
 * CostDialog — LLM 分析成本确认 (ui-spec §3.6, roadmap 2.8)
 */
import { useState, useEffect, useCallback } from 'react'
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
  const [totalBytes, setTotalBytes] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
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
        let files = 0
        let bytes = 0
        const walk = (entries: unknown[]) => {
          for (const e of entries) {
            const entry = e as Record<string, unknown>
            if (entry.isDirectory && Array.isArray(entry.children)) walk(entry.children as unknown[])
            else if (!entry.isDirectory) {
              files++
              bytes += Number(entry.size) || 0
            }
          }
        }
        walk(treeResult.data as unknown[])
        setFileCount(files)
        setTotalBytes(bytes > 0 ? bytes : null)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (!open) return
    void loadStats()
  }, [open, loadStats])

  /**
   * Token estimate.
   *
   * The old version guessed `files × 500` regardless of file size and printed a
   * hardcoded ¥3/1M cost. This derives tokens from the actual byte count of the
   * sources (≈4 chars/token for code+ASCII, and the summariser truncates each
   * file at 15KB), so the number tracks the project instead of the file count.
   * The price is intentionally NOT shown: it depends on the provider and model
   * the user configured, and inventing one is worse than omitting it.
   */
  const PER_FILE_CHAR_CAP = 15_000
  const estimatedChars = totalBytes !== null && fileCount !== null
    ? Math.min(totalBytes, fileCount * PER_FILE_CHAR_CAP)
    : null
  const estLLMTokens = estimatedChars !== null ? Math.ceil(estimatedChars / 4) : null
  const estStructureTokens = fileCount ? fileCount * 200 : null

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
              {estLLMTokens !== null && (
                <p className="text-xs text-[var(--fg-status-warning)] mt-2">
                  {t('cost.estTokens', { tokens: estLLMTokens.toLocaleString() })}
                </p>
              )}
              <p className="text-[10px] text-[var(--fg-status-warning)] mt-1 opacity-80">
                {t('cost.estDisclaimer')}
              </p>
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
