/**
 * PdfReader — 应用内 PDF 阅读器 (Phase 3.4)
 *
 * 使用 react-pdf 渲染分页 PDF，支持文本选择高亮。
 * 选中的文本可作为 concept_link 的 anchor_text 来源。
 */
import { useState, useCallback, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface Props {
  pdfPath: string
  paperId: string
  projectId: string
  onClose: () => void
  onSelectText?: (text: string) => void
}

export default function PdfReader({ pdfPath, paperId, projectId, onClose, onSelectText }: Props) {
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
    <div className="fixed inset-0 bg-black/40 z-50 flex" onMouseUp={handleMouseUp}>
      {/* Sidebar: controls */}
      <div className="w-48 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">📖 PDF 阅读器</h3>
          {numPages > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              第 {pageNumber} / {numPages} 页
            </p>
          )}
        </div>

        {/* Page navigation */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex gap-1">
            <button
              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="flex-1 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30"
            >◀ 上一页</button>
            <button
              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="flex-1 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30"
            >下一页 ▶</button>
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
              className="w-12 px-1.5 py-0.5 border border-gray-300 rounded text-xs text-center"
            />
            <span className="text-xs text-gray-400">/ {numPages}</span>
            <button
              onClick={() => setPageNumber(Number((document.querySelector('input[type=number]') as HTMLInputElement)?.value) || pageNumber)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >跳转</button>
          </div>
        </div>

        {/* Selection info */}
        {selectedText && (
          <div className="p-3 border-b border-gray-200">
            <p className="text-xs text-gray-500 font-medium mb-1">已选中文本:</p>
            <p className="text-[10px] text-gray-400 line-clamp-3 mb-2">{selectedText}</p>
            {onSelectText && (
              <button
                onClick={useSelection}
                className="w-full py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100"
              >
                🔗 作为桥接文本
              </button>
            )}
            <button
              onClick={() => { setSelectedText(''); setSelectionPos(null); window.getSelection()?.removeAllRanges() }}
              className="w-full py-1 text-xs text-gray-400 hover:text-gray-600 mt-1"
            >
              取消选择
            </button>
          </div>
        )}

        <div className="flex-1" />
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            关闭阅读器
          </button>
        </div>
      </div>

      {/* Main PDF view */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 flex justify-center p-4">
        <Document
          file={`file://${pdfPath.replace(/\\/g, '/')}`}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="text-gray-400 text-sm py-8">加载 PDF…</div>}
          error={<div className="text-red-500 text-sm py-8">PDF 加载失败</div>}
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
          <div className="bg-white border border-gray-300 rounded-lg shadow-lg px-2 py-1 flex items-center gap-1">
            <span className="text-[10px] text-gray-500">"{selectedText.slice(0, 20)}{selectedText.length > 20 ? '…' : ''}"</span>
            {onSelectText && (
              <button
                onClick={useSelection}
                className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded hover:bg-purple-100"
              >
                🔗 桥接
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
