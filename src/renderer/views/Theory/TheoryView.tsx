/**
 * TheoryView — arXiv search + paper library + notes.
 * Phase 3: full paper management.
 */
import { useState, useEffect } from 'react'
import ConceptBridge from './ConceptBridge'
import PdfReader from './PdfReader'

interface PaperRow {
  id: string; arxiv_id: string; title: string; authors: string
  summary: string; published: string; pdf_path: string
  notes: string; tags: string; created_at: string
}

interface ArxivEntry {
  id: string
  title: string
  summary: string
  authors: string[]
  published: string
  link: string
}

interface Props {
  t: (key: string) => string
  projectId?: string
}

type ViewMode = 'search' | 'library' | 'detail'

export default function TheoryView({ t, projectId }: Props) {
  const [view, setView] = useState<ViewMode>('library')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ArxivEntry[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Paper library
  const [papers, setPapers] = useState<PaperRow[]>([])
  const [selectedPaper, setSelectedPaper] = useState<PaperRow | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [showPdfReader, setShowPdfReader] = useState(false)
  const [pdfAnchorText, setPdfAnchorText] = useState('')

  useEffect(() => { loadPapers() }, [])

  async function loadPapers() {
    try {
      const r = await window.fieldguide.paperList()
      if (r.ok && r.data) setPapers(r.data)
    } catch { /* ignore */ }
  }

  async function search() {
    if (!query.trim()) return
    setSearching(true); setError(null)

    // First, search local papers
    try {
      const localR = await window.fieldguide.paperSearch(query)
      if (localR.ok && localR.data && localR.data.length > 0) {
        const papers = localR.data as PaperRow[]
        setResults(papers.map(p => ({
          id: p.arxiv_id,
          title: p.title,
          summary: p.summary,
          authors: p.authors.split(', '),
          published: p.published,
          link: `https://arxiv.org/abs/${p.arxiv_id}`,
        })))
        setView('search')
        setSearching(false)
        return
      }
    } catch { /* fall through to arXiv */ }

    // Fallback: arXiv API
    try {
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=12&sortBy=relevance`
      const response = await fetch(url)
      const text = await response.text()
      const entries = parseArxivXML(text)
      setResults(entries)
      if (entries.length === 0) setError('未找到相关论文')
      setView('search')
    } catch (err) { setError(String(err)) }
    finally { setSearching(false) }
  }

  async function savePaper(entry: ArxivEntry) {
    setSaving(true)
    try {
      const r = await window.fieldguide.paperSave({
        arxiv_id: entry.id,
        title: entry.title,
        authors: entry.authors.join(', '),
        summary: entry.summary,
        published: entry.published,
      })
      if (r.ok) await loadPapers()
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  async function deletePaper(id: string) {
    setDeleting(id)
    try {
      await window.fieldguide.paperRemove(id)
      await loadPapers()
      if (selectedPaper?.id === id) { setSelectedPaper(null); setView('library') }
    } catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  async function saveNotes() {
    if (!selectedPaper) return
    await window.fieldguide.paperUpdate(selectedPaper.id, { notes })
    await loadPapers()
  }

  function openPaper(paper: PaperRow) {
    setSelectedPaper(paper)
    setNotes(paper.notes || '')
    setPdfPath(paper.pdf_path || null)
    setView('detail')
  }

  async function downloadPdf() {
    if (!selectedPaper) return
    setDownloading(true)
    try {
      const r = await window.fieldguide.paperDownloadPdf(selectedPaper.id)
      if (r.ok && r.data) {
        const d = r.data as { pdf_path: string }
        setPdfPath(d.pdf_path)
      }
    } catch { /* ignore */ }
    finally { setDownloading(false) }
  }

  async function openPdfInApp() {
    if (!selectedPaper) return
    let path = pdfPath
    if (!path) {
      setDownloading(true)
      try {
        const r = await window.fieldguide.paperDownloadPdf(selectedPaper.id)
        if (r.ok && r.data) {
          const d = r.data as { pdf_path: string }
          path = d.pdf_path
          setPdfPath(d.pdf_path)
        }
      } catch { /* ignore */ }
      finally { setDownloading(false) }
    }
    if (path) {
      setShowPdfReader(true)
    }
  }

  function handlePdfTextSelected(text: string) {
    setPdfAnchorText(text)
    setShowPdfReader(false)
  }

  async function openPdf() {
    if (!selectedPaper) return
    let path = pdfPath
    if (!path) {
      setDownloading(true)
      try {
        const r = await window.fieldguide.paperDownloadPdf(selectedPaper.id)
        if (r.ok && r.data) {
          const d = r.data as { pdf_path: string }
          path = d.pdf_path
          setPdfPath(d.pdf_path)
        }
      } catch { /* ignore */ }
      finally { setDownloading(false) }
    }
    if (path) {
      await window.fieldguide.openFile(path)
    }
  }

  const isSaved = (arxivId: string) => papers.some(p => p.arxiv_id === arxivId)

  return (
    <div className="h-full flex flex-col bg-[var(--fg-bg)]">
      {/* Search bar */}
      <div className="flex gap-2 p-3 border-b border-[var(--fg-border)] bg-[var(--fg-card)]">
        <button
          onClick={() => { setView('library'); setSelectedPaper(null) }}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${view === 'library' && !selectedPaper ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >📚 我的论文</button>
        <button
          onClick={() => setView('search')}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${view === 'search' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >🔍 搜索</button>
        <div className="flex-1" />
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="搜索 arXiv… (RAG, transformer, code generation)"
          className="w-80 px-3 py-1.5 border border-[var(--fg-border)] rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={search} disabled={searching}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
        >{searching ? '…' : '搜索'}</button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Search results */}
        {view === 'search' && (
          <div className="max-w-3xl mx-auto p-4">
            {error && <div className="text-center text-red-500 text-sm py-8">{error}</div>}
            {searching && <div className="text-center text-gray-400 py-8 text-sm">搜索中…</div>}
            <div className="space-y-3">
              {results.map((entry) => (
                <div key={entry.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <a href={entry.link} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-700 hover:text-blue-900 line-clamp-2">{entry.title}</a>
                      <p className="text-xs text-gray-500 mt-1">
                        {entry.authors.slice(0, 3).join(', ')}{entry.authors.length > 3 && ' et al.'}
                        {' · '}{entry.published.slice(0, 10)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{entry.summary}</p>
                    </div>
                    <button
                      onClick={() => savePaper(entry)}
                      disabled={isSaved(entry.id) || saving}
                      className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
                        isSaved(entry.id) ? 'bg-green-50 text-green-600 cursor-default' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >{isSaved(entry.id) ? '已收藏' : '收藏'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paper library */}
        {view === 'library' && (
          <div className="max-w-3xl mx-auto p-4">
            {papers.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <div className="text-4xl mb-4">📚</div>
                <p className="text-lg font-medium mb-2">论文库为空</p>
                <p className="text-sm">搜索 arXiv 并收藏感兴趣的论文</p>
              </div>
            ) : (
              <div className="space-y-2">
                {papers.map((p) => (
                  <div key={p.id}
                    onClick={() => openPaper(p)}
                    className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 cursor-pointer group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">{p.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.authors.split(', ').slice(0, 2).join(', ')}
                        {p.published ? ` · ${p.published.slice(0, 10)}` : ''}
                        {p.notes ? ' · 📝 有笔记' : ''}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePaper(p.id) }}
                      disabled={deleting === p.id}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-sm px-1 transition-opacity"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Paper detail */}
        {view === 'detail' && selectedPaper && (
          <div className="max-w-3xl mx-auto p-4 space-y-4">
            <button onClick={() => { setView('library'); setSelectedPaper(null) }}
              className="text-xs text-gray-400 hover:text-gray-600">← 返回论文库</button>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 leading-snug">{selectedPaper.title}</h2>
                  <p className="text-sm text-gray-500 mt-2">{selectedPaper.authors}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    arXiv: {selectedPaper.arxiv_id}
                    {selectedPaper.published ? ` · ${selectedPaper.published.slice(0, 10)}` : ''}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {pdfPath ? (
                    <button onClick={openPdfInApp}
                      className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 border border-green-200">
                      📖 阅读 PDF
                    </button>
                  ) : (
                    <button onClick={downloadPdf} disabled={downloading}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 border border-blue-200 disabled:opacity-50">
                      {downloading ? '下载中…' : '📥 下载 PDF'}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-4 leading-relaxed">{selectedPaper.summary}</p>
            </div>

            {/* Notes */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">📝 笔记</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="记录你的想法、与代码的关联…"
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-between items-center mt-3">
                <p className="text-xs text-gray-400">笔记自动保存到此论文</p>
                <button onClick={saveNotes}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                >保存笔记</button>
              </div>
            </div>

            {/* Concept Bridge */}
            {projectId && (
              <ConceptBridge paperId={selectedPaper.id} projectId={projectId} t={t} initialAnchorText={pdfAnchorText} />
            )}

            {/* Delete */}
            <div className="text-right">
              <button
                onClick={() => deletePaper(selectedPaper.id)}
                className="text-xs text-red-400 hover:text-red-600 underline"
              >删除此论文</button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Reader overlay */}
      {showPdfReader && pdfPath && selectedPaper && projectId && (
        <PdfReader
          pdfPath={pdfPath}
          paperId={selectedPaper.id}
          projectId={projectId}
          onClose={() => setShowPdfReader(false)}
          onSelectText={handlePdfTextSelected}
        />
      )}
    </div>
  )
}

/** Simple arXiv Atom XML parser */
function parseArxivXML(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1]
    const id = extractTag(block, 'id')?.split('/abs/').pop() || ''
    const title = stripHtml(extractTag(block, 'title') || '')
    const summary = stripHtml(extractTag(block, 'summary') || '')
    const authors: string[] = []
    const authorRegex = /<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g
    let am
    while ((am = authorRegex.exec(block)) !== null) authors.push(am[1].trim())
    const published = extractTag(block, 'published') || ''
    const link = extractAttr(block, 'link', 'href') || `https://arxiv.org/abs/${id}`
    entries.push({ id, title, summary, authors, published, link })
  }
  return entries
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*\\/?>`, 'i')
  const m = xml.match(re)
  return m ? m[1] : null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}
