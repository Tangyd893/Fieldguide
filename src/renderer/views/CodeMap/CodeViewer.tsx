/**
 * CodeViewer — read-only source viewer for the code panel.
 *
 * Beyond rendering the file it now answers the two questions a reader asks right
 * after jumping in from the graph or the coach:
 *   - "which lines is this node?"  → the focused node's line range is highlighted
 *     and scrolled into view (via `graph:getNode`, whose ranges the indexer
 *     already records).
 *   - "where is X in this file?"   → in-file search with match count and
 *     next/previous navigation, plus jump-to-line.
 *
 * Still read-only by design (product-spec has no editing), but the line DOM is a
 * memoised list so typing in the search box does not re-highlight the whole file.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, ChevronUp, ChevronDown, X, Crosshair, StickyNote, Plus } from 'lucide-react'
import { detectLanguage, highlightLine } from './syntax'
import { dashboardSelectNode } from './GraphPanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  projectId?: string
  filePath?: string
  /** Node selected in the graph / cited by the coach; highlights its line range here. */
  highlightNodeId?: string | null
  /** One-shot scroll request (content search hit). `seq` distinguishes repeats. */
  jumpTarget?: { line: number; seq: number } | null
  /** B9: report the graph node covering a clicked line (code → graph direction). */
  onLineSelect?: (line: number) => void
  /** B2: called after a note is added, so the notes panel can refresh. */
  onNoteSaved?: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

const HIGHLIGHT_DEBOUNCE_MS = 160

export default function CodeViewer({ projectId, filePath, highlightNodeId, jumpTarget, onLineSelect, onNoteSaved, t }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [activeMatch, setActiveMatch] = useState(0)
  const [jumpValue, setJumpValue] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Resolved node range for the focused node, when it lives in this file.
  const [nodeRange, setNodeRange] = useState<{ label: string; start: number; end: number } | null>(null)
  /** Line highlighted by a jump request (content search hit). */
  const [activeJumpLine, setActiveJumpLine] = useState<number | null>(null)

  useEffect(() => {
    if (!projectId || !filePath) { setContent(''); setNodeRange(null); return }
    loadFile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filePath])

  // Reset per-file view state when the file changes
  useEffect(() => {
    setSearch('')
    setActiveMatch(0)
    setJumpValue('')
  }, [filePath])

  async function loadFile() {
    if (!projectId || !filePath) return
    setLoading(true); setError(null)
    try {
      const result = await window.fieldguide.fileRead(projectId, filePath)
      if (result.ok && result.data) setContent((result.data as { content: string }).content)
      else setError(result.error?.message ?? t('codeMap.readError'))
    } catch (err) { setError(String(err)) }
    finally { setLoading(false) }
  }

  // Resolve the highlighted node's range (debounced against rapid graph clicks).
  useEffect(() => {
    if (!projectId || !filePath || !highlightNodeId) { setNodeRange(null); return }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const r = await window.fieldguide.graphGetNode(projectId, highlightNodeId)
        if (cancelled || !r.ok || !r.data) return
        const node = r.data as {
          filePath?: string
          label?: string
          name?: string
          lineRange?: [number, number]
        }
        if (node.filePath !== filePath || !node.lineRange) { setNodeRange(null); return }
        setNodeRange({
          label: String(node.label || node.name || highlightNodeId),
          start: node.lineRange[0],
          end: node.lineRange[1],
        })
      } catch {
        if (!cancelled) setNodeRange(null)
      }
    }, HIGHLIGHT_DEBOUNCE_MS)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [projectId, filePath, highlightNodeId])

  const lines = useMemo(() => content.split('\n'), [content])

  // B2: notes for this file, so the gutter can mark annotated lines.
  const [notes, setNotes] = useState<CodeNoteRow[]>([])
  const [noteDraft, setNoteDraft] = useState<{ line: number; body: string } | null>(null)
  const [savingNote, setSavingNote] = useState(false)

  const loadNotes = useCallback(async () => {
    if (!projectId || !filePath) { setNotes([]); return }
    try {
      const r = await window.fieldguide.notesList(projectId, { filePath })
      if (r.ok && r.data) setNotes(r.data)
    } catch { /* ignore */ }
  }, [projectId, filePath])

  useEffect(() => { void loadNotes() }, [loadNotes])

  const linesWithNotes = useMemo(() => {
    const set = new Set<number>()
    for (const note of notes) {
      if (note.line_start == null) continue
      const end = note.line_end ?? note.line_start
      for (let l = note.line_start; l <= end; l++) set.add(l)
    }
    return set
  }, [notes])

  /** B9: clicking a line tells the shell which graph node it belongs to. */
  async function handleLineClick(lineNo: number) {
    if (!projectId || !filePath) return
    if (onLineSelect) {
      onLineSelect(lineNo)
      return
    }
    // Fallback when the shell did not supply a handler: resolve locally.
    try {
      const r = await window.fieldguide.graphNodeAtLine(projectId, filePath, lineNo)
      if (r.ok && r.data?.node) {
        dashboardSelectNode(r.data.node.id)
      }
    } catch { /* ignore */ }
  }

  async function saveNote() {
    if (!projectId || !filePath || !noteDraft || !noteDraft.body.trim()) return
    setSavingNote(true)
    try {
      const r = await window.fieldguide.notesAdd({
        project_id: projectId,
        node_id: highlightNodeId ?? undefined,
        file_path: filePath,
        line_start: noteDraft.line,
        line_end: noteDraft.line,
        body: noteDraft.body.trim(),
      })
      if (r.ok) {
        setNoteDraft(null)
        await loadNotes()
        onNoteSaved?.()
      }
    } finally {
      setSavingNote(false)
    }
  }

  /** Line numbers (1-based) containing the current query. */
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    const hits: number[] = []
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) hits.push(i + 1)
    }
    return hits
  }, [lines, search])

  const scrollToLine = useCallback((line: number) => {
    const container = scrollRef.current
    if (!container) return
    const el = container.querySelector<HTMLElement>(`[data-line="${line}"]`)
    el?.scrollIntoView({ block: 'center' })
  }, [])

  // Scroll the focused node's range into view once resolved.
  useEffect(() => {
    if (nodeRange) scrollToLine(nodeRange.start)
  }, [nodeRange, scrollToLine])

  // Scroll to the active search match.
  useEffect(() => {
    if (matches.length > 0) {
      const line = matches[Math.min(activeMatch, matches.length - 1)]
      if (line) scrollToLine(line)
    }
  }, [activeMatch, matches, scrollToLine])

  // One-shot jump requests (content search). `seq` marks the request as handled
  // so a re-render does not yank the viewport back.
  const handledJumpSeq = useRef<number>(-1)
  useEffect(() => {
    if (!jumpTarget || jumpTarget.line < 1) return
    if (handledJumpSeq.current === jumpTarget.seq) return
    handledJumpSeq.current = jumpTarget.seq
    // Let the freshly opened file paint before scrolling.
    const timer = setTimeout(() => {
      setActiveJumpLine(jumpTarget.line)
      scrollToLine(jumpTarget.line)
    }, 40)
    return () => clearTimeout(timer)
  }, [jumpTarget, scrollToLine, content])

  function stepMatch(delta: number) {
    if (matches.length === 0) return
    setActiveMatch((prev) => {
      const next = (prev + delta + matches.length) % matches.length
      return next
    })
  }

  function jumpToLine() {
    const n = Number(jumpValue.trim())
    if (!Number.isFinite(n) || n < 1 || n > lines.length) return
    scrollToLine(Math.floor(n))
  }

  const lang = filePath ? detectLanguage(filePath) : 'plaintext'
  const langLabel = { go: 'Go', typescript: 'TypeScript', javascript: 'JavaScript', python: 'Python', rust: 'Rust', java: 'Java', plaintext: 'Text' }[lang] ?? lang

  // Memoised line list: keyed on everything that changes what a line looks like,
  // so search typing / match stepping does not re-run syntax highlighting.
  const highlightedLines = useMemo(() => {
    const activeLine = matches.length > 0 ? matches[Math.min(activeMatch, matches.length - 1)] : null
    const query = search.trim().toLowerCase()
    return lines.map((line, i) => {
      const lineNo = i + 1
      const inRange = nodeRange ? lineNo >= nodeRange.start && lineNo <= nodeRange.end : false
      const isMatch = query.length > 0 && line.toLowerCase().includes(query)
      const isActiveMatch = activeLine === lineNo
      const isJumpLine = activeJumpLine === lineNo
      return {
        lineNo, inRange, isMatch, isActiveMatch, isJumpLine,
        hasNote: linesWithNotes.has(lineNo),
        body: highlightLine(line, lang),
      }
    })
  }, [lines, lang, nodeRange, matches, activeMatch, search, activeJumpLine, linesWithNotes])

  if (!filePath) return <div className="h-full flex items-center justify-center text-[var(--fg-text-tertiary)] text-sm">{t('codeMap.clickToOpen')}</div>
  if (loading) return <div className="h-full flex items-center justify-center text-[var(--fg-text-tertiary)] text-sm">{t('codeMap.loading')}</div>
  if (error) return <div className="h-full flex items-center justify-center text-[var(--fg-status-error)] text-sm">{error}</div>

  return (
    <div className="h-full flex flex-col bg-[var(--fg-bg)]">
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-[var(--fg-card)] border-b border-[var(--fg-border)] text-xs text-[var(--fg-text-tertiary)] font-mono">
        <span className="text-[var(--fg-text-secondary)] truncate max-w-[40%]" title={filePath}>{filePath}</span>
        <span className="px-1.5 py-0.5 rounded bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] text-[11px] font-medium shrink-0">{langLabel}</span>
        <span className="shrink-0">{t('codeMap.lines', { count: lines.length })}</span>
        <span className="flex-1" />

        {/* In-file search */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveMatch(0) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); stepMatch(e.shiftKey ? -1 : 1) }
                if (e.key === 'Escape') { setSearch('') }
              }}
              placeholder={t('codeMap.searchInFile')}
              aria-label={t('codeMap.searchInFile')}
              className="w-32 pl-5 pr-1.5 py-0.5 text-[11px] font-sans border border-[var(--fg-border)] rounded bg-[var(--fg-bg)] text-[var(--fg-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--fg-accent)]"
            />
          </div>
          {search.trim() && (
            <>
              <span className="tabular-nums text-[11px] shrink-0">
                {matches.length === 0
                  ? t('codeMap.noMatchInFile')
                  : t('codeMap.matchCount', { current: Math.min(activeMatch + 1, matches.length), total: matches.length })}
              </span>
              <button
                onClick={() => stepMatch(-1)}
                disabled={matches.length === 0}
                aria-label={t('codeMap.prevMatch')}
                title={t('codeMap.prevMatch')}
                className="p-0.5 rounded hover:bg-[var(--fg-tree-hover)] disabled:opacity-30"
              ><ChevronUp size={12} /></button>
              <button
                onClick={() => stepMatch(1)}
                disabled={matches.length === 0}
                aria-label={t('codeMap.nextMatch')}
                title={t('codeMap.nextMatch')}
                className="p-0.5 rounded hover:bg-[var(--fg-tree-hover)] disabled:opacity-30"
              ><ChevronDown size={12} /></button>
              <button
                onClick={() => setSearch('')}
                aria-label={t('codeMap.clearSearch')}
                title={t('codeMap.clearSearch')}
                className="p-0.5 rounded hover:bg-[var(--fg-tree-hover)]"
              ><X size={12} /></button>
            </>
          )}
        </div>

        {/* Jump to line */}
        <div className="flex items-center gap-1 shrink-0 font-sans">
          <input
            type="text"
            inputMode="numeric"
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); jumpToLine() } }}
            placeholder={t('codeMap.jumpToLine')}
            aria-label={t('codeMap.jumpToLine')}
            className="w-14 px-1.5 py-0.5 text-[11px] border border-[var(--fg-border)] rounded bg-[var(--fg-bg)] text-[var(--fg-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--fg-accent)]"
          />
        </div>
      </div>

      {nodeRange && (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] text-[11px] border-b border-[var(--fg-border)]">
          <Crosshair size={12} className="shrink-0" />
          <span className="truncate">
            {t('codeMap.highlightedRange', { label: nodeRange.label, start: nodeRange.start, end: nodeRange.end })}
          </span>
        </div>
      )}

      {noteDraft && (
        <div className="shrink-0 border-b border-[var(--fg-border)] bg-[var(--fg-card)] p-2 space-y-1.5">
          <p className="text-[10px] text-[var(--fg-text-tertiary)]">
            {t('notes.addAtLine', { line: noteDraft.line })}
          </p>
          <textarea
            autoFocus
            value={noteDraft.body}
            onChange={(e) => setNoteDraft({ ...noteDraft, body: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); setNoteDraft(null) }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void saveNote() }
            }}
            placeholder={t('notes.draftPlaceholder')}
            aria-label={t('notes.draftPlaceholder')}
            className="w-full h-16 px-2 py-1 text-[11px] rounded border border-[var(--fg-border)] bg-[var(--fg-bg)] resize-y"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={savingNote || !noteDraft.body.trim()} onClick={() => void saveNote()}>
              {savingNote ? t('notes.saving') : t('notes.save')}
            </Button>
            <button onClick={() => setNoteDraft(null)} className="text-[10px] text-[var(--fg-text-tertiary)] hover:underline">
              {t('common.close')}
            </button>
            <span className="text-[10px] text-[var(--fg-text-tertiary)]">{t('notes.saveHint')}</span>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={(e) => {
          // Ctrl/Cmd+F focuses the in-file search while the code pane has focus.
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault()
            searchRef.current?.focus()
            searchRef.current?.select()
          }
        }}
        className="flex-1 overflow-auto focus:outline-none"
      >
        <div
          className="font-mono leading-5"
          style={{ fontFamily: 'var(--fg-font-mono)', fontSize: 'var(--fg-mono-font-size, 13px)' }}
        >
          {highlightedLines.map(({ lineNo, inRange, isMatch, isActiveMatch, isJumpLine, hasNote, body }) => (
            <div
              key={lineNo}
              data-line={lineNo}
              className={cn(
                'flex group',
                inRange && 'bg-[var(--fg-accent-muted)]',
                !inRange && (isActiveMatch || isJumpLine) && 'bg-[var(--fg-status-warning-bg)]',
                !inRange && !isActiveMatch && !isJumpLine && isMatch && 'bg-[var(--fg-tree-hover)]',
                !inRange && !isMatch && !isJumpLine && 'hover:bg-[var(--fg-accent-muted)]/30',
              )}
            >
              <span
                className={cn(
                  'w-12 flex-shrink-0 text-right pr-3 select-none text-xs leading-5 py-px border-r',
                  inRange || isJumpLine
                    ? 'text-[var(--fg-accent-text)] border-[var(--fg-accent)]'
                    : 'text-[var(--fg-text-tertiary)] border-[var(--fg-border)]',
                )}
              >
                {lineNo}
              </span>
              <span
                role="button"
                tabIndex={-1}
                aria-label={t('codeMap.selectLine', { line: lineNo })}
                title={t('codeMap.selectLine', { line: lineNo })}
                onClick={() => void handleLineClick(lineNo)}
                className="flex-1 pl-3 whitespace-pre text-[var(--fg-text-primary)] py-px min-w-0 overflow-x-auto cursor-pointer"
              >
                {body}
              </span>
              {/* B2: note gutter — marker for existing notes, + to add one */}
              <span className="w-5 shrink-0 flex items-center justify-center">
                {hasNote && <StickyNote size={9} className="text-[var(--fg-status-warning)]" />}
                {!hasNote && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setNoteDraft({ line: lineNo, body: '' }) }}
                    aria-label={t('notes.addAtLine', { line: lineNo })}
                    title={t('notes.addAtLine', { line: lineNo })}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-[var(--fg-text-tertiary)] hover:text-[var(--fg-accent)] p-0.5"
                  >
                    <Plus size={9} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
