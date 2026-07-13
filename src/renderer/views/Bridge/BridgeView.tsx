/**
 * BridgeView — 顶栏「桥接」Tab (Phase 3)
 */
import { useState, useEffect } from 'react'
import { Link2, FileText, Loader2, Sparkles } from 'lucide-react'
import ConceptBridge from '../Theory/ConceptBridge'
import { Dialog, DialogContent, DialogTitle, DialogCloseButton, DialogBody } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  t: (key: string, opts?: Record<string, unknown>) => string
  projectId?: string
}

interface PaperRow {
  id: string; arxiv_id: string; title: string; authors: string
  summary: string; published: string; pdf_path: string
  notes: string; tags: string; created_at: string
}

interface LinkRow {
  id: string; paper_id: string; project_id: string
  node_id: string; anchor_text: string; note: string; created_at: string
}

export default function BridgeView({ t, projectId }: Props) {
  const [papers, setPapers] = useState<PaperRow[]>([])
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null)
  const [allLinks, setAllLinks] = useState<LinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingTour, setGeneratingTour] = useState(false)
  const [tourResult, setTourResult] = useState<{ stepCount: number; summary: string } | null>(null)

  useEffect(() => { loadPapers() }, [])
  useEffect(() => { if (projectId) loadAllLinks() }, [projectId])

  async function loadPapers() {
    try {
      const r = await window.fieldguide.paperList()
      if (r.ok && r.data) setPapers(r.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function loadAllLinks() {
    try {
      const r = await window.fieldguide.conceptList(projectId)
      if (r.ok && r.data) setAllLinks(r.data)
    } catch { /* ignore */ }
  }

  async function handleGenerateTour() {
    if (!projectId) return
    setGeneratingTour(true)
    setTourResult(null)
    try {
      const r = await window.fieldguide.bridgeGenerateTour(projectId)
      if (r.ok && r.data) {
        const d = r.data as { stepCount?: number; summary?: string; noLinks?: boolean; message?: string }
        if (d.noLinks) {
          setTourResult({ stepCount: 0, summary: d.message ?? t('bridge.noLinksFound') })
        } else {
          setTourResult({ stepCount: d.stepCount ?? 0, summary: d.summary ?? t('bridge.tourGenerated') })
        }
      } else {
        setTourResult({ stepCount: 0, summary: r.error?.message ?? t('bridge.generateFailed') })
      }
    } catch (err) {
      setTourResult({ stepCount: 0, summary: String(err) })
    } finally {
      setGeneratingTour(false)
    }
  }

  const paperLinkCounts = new Map<string, number>()
  for (const link of allLinks) {
    paperLinkCounts.set(link.paper_id, (paperLinkCounts.get(link.paper_id) || 0) + 1)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--fg-text-tertiary)] text-sm">
        {t('codeMap.loading')}
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="border-2 border-dashed border-[var(--fg-border)] rounded-lg p-12 text-center text-[var(--fg-text-tertiary)]">
          <Link2 size={32} className="mx-auto mb-3 text-[var(--fg-text-tertiary)]" />
          <p className="text-lg mb-2 text-[var(--fg-text-secondary)]">{t('bridge.noProject')}</p>
          <p className="text-sm">{t('bridge.noProjectHint')}</p>
        </div>
      </div>
    )
  }

  if (papers.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="border-2 border-dashed border-[var(--fg-border)] rounded-lg p-12 text-center text-[var(--fg-text-tertiary)]">
          <FileText size={32} className="mx-auto mb-3 text-[var(--fg-text-tertiary)]" />
          <p className="text-lg mb-2 text-[var(--fg-text-secondary)]">{t('bridge.noPapers')}</p>
          <p className="text-sm">{t('bridge.noPapersHint')}</p>
        </div>
      </div>
    )
  }

  const selectedPaper = papers.find(p => p.id === selectedPaperId)

  return (
    <div className="h-full flex">
      <div className="w-64 border-r border-[var(--fg-border)] bg-[var(--fg-card)] overflow-auto shrink-0">
        <div className="px-3 py-3 border-b border-[var(--fg-border)]">
          <h3 className="text-xs font-semibold text-[var(--fg-text-tertiary)] uppercase tracking-wider">{t('bridge.paperList')}</h3>
          <p className="text-[10px] text-[var(--fg-text-tertiary)] mt-0.5">
            {t('bridge.linksSummary', { links: allLinks.length, papers: papers.length })}
          </p>
          {allLinks.length > 0 && (
            <button
              onClick={handleGenerateTour}
              disabled={generatingTour}
              className="mt-2 w-full inline-flex items-center justify-center gap-1 text-[10px] py-1 px-2 bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] border border-[var(--fg-accent-muted)] rounded hover:opacity-90 disabled:opacity-40 transition-colors"
              title={allLinks.length < 3 ? t('bridge.generateTourHint') : t('bridge.generateTourTitle')}
            >
              {generatingTour ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              {generatingTour ? t('bridge.generating') : t('bridge.generateTour')}
            </button>
          )}
        </div>
        {papers.map((paper) => {
          const linkCount = paperLinkCounts.get(paper.id) || 0
          const isSelected = paper.id === selectedPaperId
          return (
            <button
              key={paper.id}
              onClick={() => setSelectedPaperId(paper.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-[var(--fg-border)] transition-colors ${
                isSelected ? 'bg-[var(--fg-accent-muted)] border-l-2 border-l-[var(--fg-accent)]' : 'hover:bg-[var(--fg-tree-hover)]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-[var(--fg-text-primary)] line-clamp-1 flex-1">
                  {paper.title}
                </span>
                {linkCount > 0 && (
                  <span className="text-[10px] bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] px-1.5 py-0.5 rounded-full shrink-0">
                    {linkCount}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[var(--fg-text-tertiary)] mt-0.5">
                {paper.authors?.split(',').slice(0, 2).join(', ') || t('bridge.unknownAuthor')}
              </p>
              {paper.arxiv_id && (
                <p className="text-[10px] text-[var(--fg-text-tertiary)] font-mono mt-0.5">{paper.arxiv_id}</p>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {selectedPaper ? (
          <ConceptBridge paperId={selectedPaper.id} projectId={projectId} t={t} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-[var(--fg-text-tertiary)]">
              <Link2 size={40} className="mx-auto mb-4 text-[var(--fg-text-tertiary)]" />
              <p className="text-lg mb-2 text-[var(--fg-text-secondary)]">{t('bridge.selectPaperTitle')}</p>
              <p className="text-sm">{t('bridge.selectPaperHint')}</p>
            </div>
          </div>
        )}
      </div>

      <TourResultDialog open={!!tourResult} result={tourResult} onClose={() => setTourResult(null)} t={t} />
    </div>
  )
}

function TourResultDialog({ open, result, onClose, t }: { open: boolean; result: { stepCount: number; summary: string } | null; onClose: () => void; t: (key: string, opts?: Record<string, unknown>) => string }) {
  if (!result) return null
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="flex flex-col w-[520px] max-w-[95vw] max-h-[80vh] p-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--fg-border)] shrink-0 bg-[var(--fg-card)]">
          <DialogTitle>
            {result.stepCount > 0 ? t('bridge.tourResultSteps', { count: result.stepCount }) : t('bridge.tourResult')}
          </DialogTitle>
          <DialogCloseButton />
        </div>
        <DialogBody className="px-6 py-4">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg-text-secondary)]">
            {result.summary}
          </div>
          {result.stepCount > 0 && (
            <p className="mt-3 text-xs text-[var(--fg-text-tertiary)]">{t('bridge.tourResultHint')}</p>
          )}
        </DialogBody>
        <div className="flex justify-end px-6 py-4 border-t border-[var(--fg-border)] shrink-0 bg-[var(--fg-card)]">
          <Button variant="ghost" onClick={onClose}>{t('bridge.close')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
