/**
 * TheoryView — arXiv search + paper library + notes + local RAG.
 *
 * Phase 3 shipped `paper:index` / `paper:query` / `paper:indexStatus` in the main
 * process, but the renderer never called them, so the vector index was never built
 * and `query_paper` always returned nothing. This view now owns that lifecycle:
 * build/rebuild the index, report chunk counts, auto-index after a PDF download,
 * and expose in-paper semantic lookup.
 */
import { useState, useEffect, useCallback } from 'react'
import { Library, Search, BookOpen, Download, StickyNote, Sparkles, RefreshCw, CheckCircle2, AlertTriangle, MessagesSquare, ExternalLink } from 'lucide-react'
import ConceptBridge from './ConceptBridge'
import PdfReader from './PdfReader'
import { renderMarkdown } from '@/lib/markdown'

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

/** One RAG hit from `paper:query` (see env.d.ts PaperChunkHit). */
interface RagHit {
  score: number
  chunk: { id: string; paper_id: string; chunk_index: number; text: string }
}

interface Props {
  t: (key: string, opts?: Record<string, unknown>) => string
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

  // Local RAG (paper vector index)
  const [chunkMap, setChunkMap] = useState<Record<string, number>>({})
  const [indexing, setIndexing] = useState(false)
  const [ragNote, setRagNote] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)
  const [ragQuery, setRagQuery] = useState('')
  const [ragHits, setRagHits] = useState<RagHit[]>([])
  const [ragSearching, setRagSearching] = useState(false)

  // B9: paper-scoped coach conversation
  const [coachQuestion, setCoachQuestion] = useState('')
  const [coachAnswer, setCoachAnswer] = useState('')
  const [coachAsking, setCoachAsking] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)

  /** Chunk counts drive the "RAG 就绪" badges; one cheap COUNT per paper. */
  const loadChunkCounts = useCallback(async (list: PaperRow[]) => {
    if (list.length === 0) return
    const entries = await Promise.all(
      list.slice(0, 60).map(async (p) => {
        try {
          const r = await window.fieldguide.paperIndexStatus(p.id)
          const count = r.ok && r.data ? Number(r.data.chunkCount) || 0 : 0
          return [p.id, count] as const
        } catch {
          return [p.id, 0] as const
        }
      }),
    )
    setChunkMap(Object.fromEntries(entries))
  }, [])

  // Reads nothing but the IPC layer and `loadChunkCounts` (both stable), so the effect
  // below still loads the library exactly once on mount.
  const loadPapers = useCallback(async () => {
    try {
      const r = await window.fieldguide.paperList()
      if (r.ok && r.data) {
        setPapers(r.data)
        void loadChunkCounts(r.data)
      }
    } catch { /* ignore */ }
  }, [loadChunkCounts])

  useEffect(() => { void loadPapers() }, [loadPapers])

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
      if (entries.length === 0) setError(t('theory.noResults'))
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
    setRagQuery('')
    setRagHits([])
    setRagNote(null)
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
        // RAG is useless until the downloaded PDF is chunked + embedded.
        if ((chunkMap[selectedPaper.id] ?? 0) === 0) {
          await indexForRag(selectedPaper.id, { silent: true })
        }
      } else if (r.error) {
        setRagNote({ kind: 'warn', text: r.error.message })
      }
    } catch { /* ignore */ }
    finally { setDownloading(false) }
  }

  /**
   * Build (or rebuild) the paper's vector index. `silent` keeps the auto-run after
   * a PDF download from hijacking the UI, but still records the outcome.
   */
  async function indexForRag(paperId: string, opts?: { silent?: boolean }) {
    if (!opts?.silent) setIndexing(true)
    try {
      const r = await window.fieldguide.paperIndex(paperId)
      if (r.ok && r.data) {
        const count = Number(r.data.chunkCount) || 0
        setChunkMap((m) => ({ ...m, [paperId]: count }))
        setRagNote({
          kind: 'ok',
          text: t('theory.ragIndexed', { count }),
        })
      } else {
        const code = r.error?.code
        setRagNote({
          kind: 'warn',
          text: code === 'LLM_NOT_CONFIGURED' ? t('theory.ragMissingEmbed') : (r.error?.message || t('theory.ragIndexFailed')),
        })
      }
    } catch (err) {
      setRagNote({ kind: 'warn', text: String(err) })
    } finally {
      if (!opts?.silent) setIndexing(false)
    }
  }

  /** B9: ask the coach about this paper (a second entry point to the same agent). */
  async function askCoach() {
    const question = coachQuestion.trim()
    if (!projectId || !selectedPaper || !question) return
    setCoachAsking(true)
    setCoachError(null)
    try {
      const r = await window.fieldguide.chatSend(
        projectId,
        [{
          role: 'user',
          content: `关于论文《${selectedPaper.title}》(arXiv:${selectedPaper.arxiv_id})：${question}\n\n`
            + '请结合本项目代码回答；论文摘要在论文库里，必要时用 query_paper 检索原文。',
        }],
        { focusedNodeId: null, tourStepIndex: null },
      )
      if (r.ok && r.data) setCoachAnswer((r.data as { content: string }).content)
      else setCoachError(r.error?.message ?? t('chat.requestFailed'))
    } catch (err) {
      setCoachError(String(err))
    } finally {
      setCoachAsking(false)
    }
  }

  async function runRagSearch() {    if (!selectedPaper || !ragQuery.trim()) return
    setRagSearching(true)
    try {
      const r = await window.fieldguide.paperQuery(ragQuery.trim(), selectedPaper.id, 5)
      if (r.ok && Array.isArray(r.data)) {
        setRagHits(r.data)
        if (r.data.length === 0) {
          setRagNote({
            kind: 'warn',
            text: (chunkMap[selectedPaper.id] ?? 0) === 0 ? t('theory.ragNotIndexed') : t('theory.ragNoHits'),
          })
        }
      } else if (r.error) {
        setRagNote({
          kind: 'warn',
          text: r.error.code === 'LLM_NOT_CONFIGURED' ? t('theory.ragMissingEmbed') : r.error.message,
        })
      }
    } catch (err) {
      setRagNote({ kind: 'warn', text: String(err) })
    } finally {
      setRagSearching(false)
    }
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
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${view === 'library' && !selectedPaper ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]' : 'text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]'}`}
        ><Library size={13} />{t('theory.myPapers')}</button>
        <button
          onClick={() => setView('search')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${view === 'search' ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]' : 'text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]'}`}
        ><Search size={13} />{t('theory.search')}</button>
        <div className="flex-1" />
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder={t('theory.searchPlaceholder')}
          className="w-80 px-3 py-1.5 border border-[var(--fg-border)] rounded-lg text-xs fg-input focus:outline-none focus:ring-2 focus:ring-[var(--fg-accent)]"
        />
        <button onClick={search} disabled={searching}
          className="px-3 py-1.5 bg-[var(--fg-accent)] text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-40"
        >{searching ? '…' : t('theory.searchBtn')}</button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Search results */}
        {view === 'search' && (
          <div className="max-w-3xl mx-auto p-4">
            {error && <div className="text-center text-[var(--fg-status-error)] text-sm py-8">{error}</div>}
            {searching && <div className="text-center text-[var(--fg-text-tertiary)] py-8 text-sm">{t('theory.searching')}</div>}
            <div className="space-y-3">
              {results.map((entry) => (
                <div key={entry.id} className="bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg p-4 hover:border-[var(--fg-text-tertiary)]">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <a href={entry.link} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-[var(--fg-accent-text)] hover:text-[var(--fg-accent)] line-clamp-2">{entry.title}</a>
                      <p className="text-xs text-[var(--fg-text-secondary)] mt-1">
                        {entry.authors.slice(0, 3).join(', ')}{entry.authors.length > 3 && ' et al.'}
                        {' · '}{entry.published.slice(0, 10)}
                      </p>
                      <p className="text-xs text-[var(--fg-text-tertiary)] mt-1.5 line-clamp-2">{entry.summary}</p>
                    </div>
                    <button
                      onClick={() => savePaper(entry)}
                      disabled={isSaved(entry.id) || saving}
                      className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
                        isSaved(entry.id) ? 'bg-[var(--fg-status-success-bg)] text-[var(--fg-status-success)] cursor-default' : 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] hover:bg-[var(--fg-accent-muted)]/70'
                      }`}
                    >{isSaved(entry.id) ? t('theory.saved') : t('theory.save')}</button>
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
              <div className="text-center text-[var(--fg-text-tertiary)] py-16">
                <Library size={40} className="mx-auto mb-4 text-[var(--fg-text-tertiary)]" />
                <p className="text-lg font-medium mb-2">{t('theory.libraryEmpty')}</p>
                <p className="text-sm">{t('theory.libraryEmptyHint')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {papers.map((p) => (
                  <div key={p.id}
                    onClick={() => openPaper(p)}
                    className="flex items-start gap-3 bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg p-3 hover:border-[var(--fg-text-tertiary)] cursor-pointer group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--fg-text-primary)] line-clamp-1">{p.title}</p>
                      <p className="text-xs text-[var(--fg-text-tertiary)] mt-0.5">
                        {p.authors.split(', ').slice(0, 2).join(', ')}
                        {p.published ? ` · ${p.published.slice(0, 10)}` : ''}
                        {p.notes ? ` · ${t('theory.hasNotes')}` : ''}
                      </p>
                    </div>
                    {(chunkMap[p.id] ?? 0) > 0 && (
                      <span
                        className="shrink-0 self-center text-[10px] px-1.5 py-0.5 rounded bg-[var(--fg-status-success-bg)] text-[var(--fg-status-success)] whitespace-nowrap"
                        title={t('theory.ragReadyHint')}
                      >
                        {t('theory.ragBadge', { count: chunkMap[p.id] })}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePaper(p.id) }}
                      disabled={deleting === p.id}
                      className="opacity-0 group-hover:opacity-100 text-[var(--fg-text-tertiary)] hover:text-[var(--fg-status-error)] text-sm px-1 transition-opacity"
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
              className="text-xs text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-secondary)]">{t('theory.backToLibrary')}</button>

            <div className="bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-[var(--fg-text-primary)] leading-snug">{selectedPaper.title}</h2>
                  <p className="text-sm text-[var(--fg-text-secondary)] mt-2">{selectedPaper.authors}</p>
                  <p className="text-xs text-[var(--fg-text-tertiary)] mt-1">
                    arXiv: {selectedPaper.arxiv_id}
                    {selectedPaper.published ? ` · ${selectedPaper.published.slice(0, 10)}` : ''}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {pdfPath ? (
                    <>
                      <button onClick={openPdfInApp}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fg-status-success-bg)] text-[var(--fg-status-success)] rounded-lg text-xs font-medium hover:bg-[var(--fg-status-success-bg)]/70 border border-[var(--fg-status-success)]">
                        <BookOpen size={13} />{t('theory.readPdf')}
                      </button>
                      {/* The in-app reader is fine for reading + bridging; the system
                          viewer is better for printing or heavy scrolling. */}
                      <button onClick={openPdf}
                        title={t('theory.openPdfExternal')}
                        aria-label={t('theory.openPdfExternal')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--fg-border)] text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]">
                        <ExternalLink size={13} />
                      </button>
                    </>
                  ) : (
                    <button onClick={downloadPdf} disabled={downloading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] rounded-lg text-xs font-medium hover:bg-[var(--fg-accent-muted)]/70 border border-[var(--fg-accent)] disabled:opacity-50">
                      <Download size={13} />
                      {downloading ? t('theory.downloading') : t('theory.downloadPdf')}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-[var(--fg-text-secondary)] mt-4 leading-relaxed">{selectedPaper.summary}</p>
            </div>

            {/* Notes */}
            <div className="bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-[var(--fg-text-primary)] mb-3 inline-flex items-center gap-1.5"><StickyNote size={14} />{t('theory.notes')}</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('theory.notesPlaceholder')}
                className="fg-input w-full h-32 px-3 py-2 border border-[var(--fg-input-border)] rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--fg-accent)]"
              />
              <div className="flex justify-between items-center mt-3">
                <p className="text-xs text-[var(--fg-text-tertiary)]">{t('theory.notesAutoSave')}</p>
                <button onClick={saveNotes}
                  className="px-4 py-1.5 bg-[var(--fg-accent)] text-white rounded-lg text-xs font-medium hover:opacity-90"
                >{t('theory.saveNotes')}</button>
              </div>
            </div>

            {/* Local RAG: vector index + in-paper semantic lookup */}
            <div className="bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--fg-text-primary)] inline-flex items-center gap-1.5">
                    <Sparkles size={14} />{t('theory.ragTitle')}
                  </h3>
                  <p className="text-xs text-[var(--fg-text-tertiary)] mt-1">
                    {(() => {
                      const count = chunkMap[selectedPaper.id] ?? 0
                      return count > 0
                        ? t('theory.ragStatusReady', { count })
                        : t('theory.ragStatusEmpty')
                    })()}
                  </p>
                </div>
                <button
                  onClick={() => indexForRag(selectedPaper.id)}
                  disabled={indexing || !pdfPath}
                  title={!pdfPath ? t('theory.ragNeedPdf') : undefined}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] rounded-lg text-xs font-medium hover:bg-[var(--fg-accent-muted)]/70 border border-[var(--fg-accent)] disabled:opacity-40 shrink-0"
                >
                  {indexing
                    ? <><RefreshCw size={13} className="animate-spin" />{t('theory.ragIndexing')}</>
                    : <>{(chunkMap[selectedPaper.id] ?? 0) > 0 ? <RefreshCw size={13} /> : <Sparkles size={13} />}
                        {(chunkMap[selectedPaper.id] ?? 0) > 0 ? t('theory.ragReindex') : t('theory.ragIndex')}</>}
                </button>
              </div>

              {ragNote && (
                <div
                  className="mt-3 flex items-start gap-1.5 text-xs px-2.5 py-1.5 rounded"
                  style={{
                    background: ragNote.kind === 'ok' ? 'var(--fg-status-success-bg)' : 'var(--fg-status-warning-bg)',
                    color: ragNote.kind === 'ok' ? 'var(--fg-status-success)' : 'var(--fg-status-warning)',
                  }}
                >
                  {ragNote.kind === 'ok' ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
                  <span>{ragNote.text}</span>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runRagSearch()}
                  placeholder={t('theory.ragSearchPlaceholder')}
                  className="flex-1 px-3 py-1.5 border border-[var(--fg-border)] rounded-lg text-xs fg-input focus:outline-none focus:ring-2 focus:ring-[var(--fg-accent)]"
                />
                <button
                  onClick={runRagSearch}
                  disabled={ragSearching || !ragQuery.trim()}
                  className="px-3 py-1.5 bg-[var(--fg-accent)] text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-40 shrink-0"
                >
                  {ragSearching ? '…' : t('theory.ragSearchBtn')}
                </button>
              </div>

              {ragHits.length > 0 && (
                <div className="mt-3 space-y-2">
                  {ragHits.map((hit, i) => (
                    <div key={hit.chunk.id || i} className="border border-[var(--fg-border)] rounded-lg p-2.5">
                      <div className="flex items-center justify-between text-[10px] text-[var(--fg-text-tertiary)] mb-1">
                        <span>{t('theory.ragChunk', { index: hit.chunk.chunk_index + 1 })}</span>
                        <span className="tabular-nums">{hit.score.toFixed(3)}</span>
                      </div>
                      <p className="text-xs text-[var(--fg-text-secondary)] whitespace-pre-wrap line-clamp-6">
                        {hit.chunk.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* B9: second coach entry point — scoped to this paper */}
            <div className="bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-[var(--fg-text-primary)] inline-flex items-center gap-1.5">
                <MessagesSquare size={14} />{t('theory.askCoach')}
              </h3>
              <p className="text-xs text-[var(--fg-text-tertiary)] mt-1">{t('theory.askCoachHint')}</p>

              {!projectId ? (
                <p className="text-xs text-[var(--fg-text-tertiary)] mt-3">{t('theory.askCoachNeedProject')}</p>
              ) : (
                <>
                  <div className="flex gap-2 mt-3">
                    <input
                      type="text"
                      value={coachQuestion}
                      onChange={(e) => setCoachQuestion(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void askCoach() }}
                      placeholder={t('theory.askCoachPlaceholder')}
                      aria-label={t('theory.askCoachPlaceholder')}
                      className="flex-1 px-3 py-1.5 border border-[var(--fg-border)] rounded-lg text-xs fg-input focus:outline-none focus:ring-2 focus:ring-[var(--fg-accent)]"
                    />
                    <button
                      onClick={() => void askCoach()}
                      disabled={coachAsking || !coachQuestion.trim()}
                      className="px-3 py-1.5 bg-[var(--fg-accent)] text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-40 shrink-0"
                    >
                      {coachAsking ? t('theory.askCoachAsking') : t('theory.askCoachSend')}
                    </button>
                  </div>

                  {coachError && <p className="text-xs text-[var(--fg-status-error)] mt-2">{coachError}</p>}

                  {coachAnswer && (
                    <div className="mt-3 rounded border border-[var(--fg-border)] p-3 text-xs text-[var(--fg-text-secondary)]">
                      {renderMarkdown(coachAnswer)}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Concept Bridge */}
            {projectId && (
              <ConceptBridge paperId={selectedPaper.id} projectId={projectId} t={t} initialAnchorText={pdfAnchorText} />
            )}

            {/* Delete */}
            <div className="text-right">
              <button
                onClick={() => deletePaper(selectedPaper.id)}
                className="text-xs text-[var(--fg-status-error)] hover:opacity-70 underline"
              >{t('theory.deletePaper')}</button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Reader overlay */}
      {showPdfReader && pdfPath && selectedPaper && projectId && (
        <PdfReader
          pdfPath={pdfPath}
          paperId={selectedPaper.id}
          t={t}
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
