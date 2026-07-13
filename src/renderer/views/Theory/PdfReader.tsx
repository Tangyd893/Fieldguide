/**
 * PdfReader — 应用内 PDF 阅读器 (Phase 3.4)
 *
 * 使用 react-pdf 渲染分页 PDF，支持文本选择高亮。
 * 选中的文本可作为 concept_link 的 anchor_text 来源。
 */
import { useState, useCallback, useRef } from 'react'
import { BookOpen, Link2 } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/src/Page/AnnotationLayer.css'
import 'react-pdf/src/Page/TextLayer.css'

// Set pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

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
  const containerRef = useRef<HTMLDivElement>(null)

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
    if (text.length < 5) { // ignore very short selections
      setSelectedText('')
      setSelectionPos(null)
      return
    }

    // Get position near the selection
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
    if (onSelectText && selectedText) {
      onSelectText(selectedText)
    }
    setSelectedText('')
    setSelectionPos(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-[var(--fg-modal-scrim)] backdrop-blur-[2px]" onMouseUp={handleMouseUp}>
      {/* Sidebar: controls */}
      <div className="w-48 bg-[var(--fg-card)] border-r border-[var(--fg-border)] flex flex-col shrink-0">
        <div className="p-3 border-b border-[var(--fg-border)]">
          <h3 className="text-sm font-semibold text-[var(--fg-text-primary)] inline-flex items-center gap-1.5"><BookOpen size={14} />{t('pdf.title')}</h3>
          {numPages > 0 && (
            <p className="text-xs text-[var(--fg-text-tertiary)] mt-1">
              {t('pdf.pageOf', { current: pageNumber, total: numPages })}
            </p>
          )}
        </div>

        {/* Page navigation */}
        <div className="p-3 border-b border-[var(--fg-border)]">
          <div className="flex gap-1">
            <button
              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="flex-1 py-1 text-xs border border-[var(--fg-input-border)] rounded hover:bg-[var(--fg-tree-hover)] disabled:opacity-30"
            >{t('pdf.prevPage')}</button>
            <button
              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="flex-1 py-1 text-xs border border-[var(--fg-input-border)] rounded hover:bg-[var(--fg-tree-hover)] disabled:opacity-30"
            >{t('pdf.nextPage')}</button>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (n >= 1 && n <= numPages) setPageNumber(n)
              }}
              className="w-12 px-1.5 py-0.5 border border-[var(--fg-input-border)] rounded text-xs text-center"
            />
            <span className="text-xs text-[var(--fg-text-tertiary)]">/ {numPages}</span>
            <button
              onClick={() => setPageNumber(Number((document.querySelector('input[type=number]') as HTMLInputElement)?.value) || pageNumber)}
              className="text-xs text-[var(--fg-accent-text)] hover:text-[var(--fg-accent)]"
            >{t('pdf.goTo')}</button>
          </div>
        </div>

        {/* Selection info */}
        {selectedText && (
          <div className="p-3 border-b border-[var(--fg-border)]">
            <p className="text-xs text-[var(--fg-text-secondary)] font-medium mb-1">{t('pdf.selectedText')}</p>
            <p className="text-[10px] text-[var(--fg-text-tertiary)] line-clamp-3 mb-2">{selectedText}</p>
            {onSelectText && (
              <button
                onClick={useSelection}
                className="w-full inline-flex items-center justify-center gap-1 py-1 text-xs bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] border border-[var(--fg-border)] rounded hover:opacity-90"
              >
                <Link2 size={11} />{t('pdf.bridgeAsText')}
              </button>
            )}
            <button
              onClick={() => { setSelectedText(''); setSelectionPos(null); window.getSelection()?.removeAllRanges() }}
              className="w-full py-1 text-xs text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-secondary)] mt-1"
            >
              {t('pdf.cancelSelection')}
            </button>
          </div>
        )}

        <div className="flex-1" />
        <div className="p-3 border-t border-[var(--fg-border)]">
          <button
            onClick={onClose}
            className="w-full py-1.5 text-xs text-[var(--fg-text-secondary)] border border-[var(--fg-input-border)] rounded hover:bg-[var(--fg-tree-hover)]"
          >
            {t('pdf.closeReader')}
          </button>
        </div>
      </div>

      {/* Main PDF view */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-[var(--fg-bg)] flex justify-center p-4">
        <Document
          file={`file://${pdfPath.replace(/\\/g, '/')}`}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="text-[var(--fg-text-tertiary)] text-sm py-8">{t('pdf.loading')}</div>}
          error={<div className="text-[var(--fg-status-error)] text-sm py-8">{t('pdf.loadFailed')}</div>}
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg"
          />
        </Document>
      </div>

      {/* Floating "use as anchor" tooltip */}
      {selectionPos && (
        <div
          className="fixed z-50"
          style={{ left: selectionPos.x, top: selectionPos.y, transform: 'translateX(-50%)' }}
        >
          <div className="bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg shadow-lg px-2 py-1 flex items-center gap-1">
            <span className="text-[10px] text-[var(--fg-text-secondary)]">"{selectedText.slice(0, 20)}{selectedText.length > 20 ? '…' : ''}"</span>
            {onSelectText && (
              <button
                onClick={useSelection}
                className="inline-flex items-center gap-1 text-[10px] bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] px-1.5 py-0.5 rounded hover:opacity-90"
              >
                <Link2 size={10} />{t('pdf.bridge')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
