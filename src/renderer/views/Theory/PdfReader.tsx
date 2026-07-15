/**
 * PdfReader — 应用内 PDF 阅读器 (Phase 3.4)
 * 支持文本选择、持久化高亮、桥接概念。
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { BookOpen, Link2, Highlighter } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/src/Page/AnnotationLayer.css'
import 'react-pdf/src/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface Highlight {
  id: string
  paper_id: string
  page: number
  text: string
  color: string
  created_at: string
}

interface Props {
  pdfPath: string
  paperId: string
  projectId: string
  t: (key: string, opts?: Record<string, unknown>) => string
  onClose: () => void
  onSelectText?: (text: string) => void
}

export default function PdfReader({ pdfPath, paperId, projectId, t, onClose, onSelectText }: Props) {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [selectedText, setSelectedText] = useState('')
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightMsg, setHighlightMsg] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.fieldguide.paperHighlights(paperId).then((r) => {
      if (r.ok && Array.isArray(r.data)) setHighlights(r.data as Highlight[])
    }).catch(() => {})
  }, [paperId])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onDocumentLoadSuccess({ numPages: nextNumPages }: any) {
    setNumPages(nextNumPages)
    setPageNumber(1)
  }

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelectedText('')
      setSelectionPos(null)
      return
    }

    const text = sel.toString().trim()
    if (text.length < 5) {
      setSelectedText('')
      setSelectionPos(null)
      return
    }

    try {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectionPos({ x: rect.left + rect.width / 2, y: rect.top - 36 })
      setSelectedText(text)
    } catch {
      setSelectedText('')
      setSelectionPos(null)
    }
  }, [])

  function useSelection() {
    if (onSelectText && selectedText) onSelectText(selectedText)
    setSelectedText('')
    setSelectionPos(null)
    window.getSelection()?.removeAllRanges()
  }

  async function saveHighlight() {
    if (!selectedText) return
    const result = await window.fieldguide.paperAddHighlight(paperId, pageNumber, selectedText)
    if (result.ok && result.data) {
      setHighlights(prev => [...prev, result.data as Highlight])
      setHighlightMsg(t('pdf.highlightSaved'))
      setTimeout(() => setHighlightMsg(null), 2000)
    }
  }

  const pageHighlights = highlights.filter(h => h.page === pageNumber)

  return (
    <div className="fixed inset-0 z-50 flex bg-[var(--fg-modal-scrim)] backdrop-blur-[2px]" onMouseUp={handleMouseUp}>
      <div className="w-52 bg-[var(--fg-card)] border-r border-[var(--fg-border)] flex flex-col shrink-0 overflow-hidden">
        <div className="p-3 border-b border-[var(--fg-border)]">
          <h3 className="text-sm font-semibold text-[var(--fg-text-primary)] inline-flex items-center gap-1.5"><BookOpen size={14} />{t('pdf.title')}</h3>
          {numPages > 0 && (
            <p className="text-xs text-[var(--fg-text-tertiary)] mt-1">
              {t('pdf.pageOf', { current: pageNumber, total: numPages })}
            </p>
          )}
        </div>

        <div className="p-3 border-b border-[var(--fg-border)]">
          <div className="flex gap-1">
            <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}
              className="flex-1 py-1 text-xs border border-[var(--fg-input-border)] rounded hover:bg-[var(--fg-tree-hover)] disabled:opacity-30">{t('pdf.prevPage')}</button>
            <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}
              className="flex-1 py-1 text-xs border border-[var(--fg-input-border)] rounded hover:bg-[var(--fg-tree-hover)] disabled:opacity-30">{t('pdf.nextPage')}</button>
          </div>
        </div>

        {selectedText && (
          <div className="p-3 border-b border-[var(--fg-border)]">
            <p className="text-xs text-[var(--fg-text-secondary)] font-medium mb-1">{t('pdf.selectedText')}</p>
            <p className="text-[10px] text-[var(--fg-text-tertiary)] line-clamp-3 mb-2">{selectedText}</p>
            <button onClick={saveHighlight}
              className="w-full inline-flex items-center justify-center gap-1 py-1 text-xs bg-[var(--fg-status-warning-bg)] text-[var(--fg-status-warning)] border border-[var(--fg-border)] rounded hover:opacity-90 mb-1">
              <Highlighter size={11} />{t('pdf.saveHighlight')}
            </button>
            {onSelectText && (
              <button onClick={useSelection}
                className="w-full inline-flex items-center justify-center gap-1 py-1 text-xs bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] border border-[var(--fg-border)] rounded hover:opacity-90">
                <Link2 size={11} />{t('pdf.bridgeAsText')}
              </button>
            )}
          </div>
        )}

        {highlightMsg && <p className="px-3 py-1 text-[10px] text-[var(--fg-status-success)]">{highlightMsg}</p>}

        <div className="flex-1 overflow-auto p-2 border-b border-[var(--fg-border)]">
          <p className="text-[10px] font-medium text-[var(--fg-text-secondary)] mb-1">{t('pdf.savedHighlights')}</p>
          {highlights.length === 0 ? (
            <p className="text-[10px] text-[var(--fg-text-tertiary)]">—</p>
          ) : (
            <ul className="space-y-1">
              {highlights.map(h => (
                <li key={h.id}>
                  <button
                    onClick={() => setPageNumber(h.page)}
                    className="w-full text-left text-[10px] px-1.5 py-1 rounded hover:bg-[var(--fg-tree-hover)] text-[var(--fg-text-secondary)]"
                  >
                    <span className="text-[var(--fg-text-tertiary)]">p{h.page}</span> {h.text.slice(0, 40)}{h.text.length > 40 ? '…' : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-3">
          <button onClick={onClose}
            className="w-full py-1.5 text-xs text-[var(--fg-text-secondary)] border border-[var(--fg-input-border)] rounded hover:bg-[var(--fg-tree-hover)]">
            {t('pdf.closeReader')}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto bg-[var(--fg-bg)] flex justify-center p-4 relative">
        <Document
          file={`file://${pdfPath.replace(/\\/g, '/')}`}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="text-[var(--fg-text-tertiary)] text-sm py-8">{t('pdf.loading')}</div>}
          error={<div className="text-[var(--fg-status-error)] text-sm py-8">{t('pdf.loadFailed')}</div>}
        >
          <Page pageNumber={pageNumber} renderTextLayer={true} renderAnnotationLayer={true} className="shadow-lg" />
        </Document>
        {pageHighlights.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg p-2 shadow-lg text-[10px] space-y-1">
            {pageHighlights.map(h => (
              <p key={h.id} className="text-[var(--fg-text-secondary)] border-l-2 border-[var(--fg-status-warning)] pl-2">{h.text.slice(0, 120)}{h.text.length > 120 ? '…' : ''}</p>
            ))}
          </div>
        )}
      </div>

      {selectionPos && (
        <div className="fixed z-50" style={{ left: selectionPos.x, top: selectionPos.y, transform: 'translateX(-50%)' }}>
          <div className="bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg shadow-lg px-2 py-1 flex items-center gap-1">
            <span className="text-[10px] text-[var(--fg-text-secondary)]">"{selectedText.slice(0, 20)}{selectedText.length > 20 ? '…' : ''}"</span>
            <button onClick={saveHighlight} className="inline-flex items-center gap-1 text-[10px] bg-[var(--fg-status-warning-bg)] px-1.5 py-0.5 rounded">
              <Highlighter size={10} />
            </button>
            {onSelectText && (
              <button onClick={useSelection} className="inline-flex items-center gap-1 text-[10px] bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] px-1.5 py-0.5 rounded">
                <Link2 size={10} />{t('pdf.bridge')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
