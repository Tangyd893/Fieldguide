/**
 * ContentSearch — find in files (Ctrl+Shift+F).
 *
 * Separate from the command palette on purpose: the palette searches names and
 * commands, this searches file *contents* (backed by the bounded `file:grep` IPC)
 * and opens a hit at its line.
 */
import { useState, useEffect, useRef } from 'react'
import { Search, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  t: (key: string, opts?: Record<string, unknown>) => string
  projectId: string
  onClose: () => void
  onOpenHit: (path: string, line: number) => void
}

/** Mirrors the `file:grep` payload (env.d.ts is module-scoped, so views redeclare). */
interface Hit {
  path: string
  line: number
  text: string
}

interface Result {
  query: string
  matches: Hit[]
  filesScanned: number
  filesWithMatches: number
  truncated: boolean
}

export default function ContentSearch({ t, projectId, onClose, onOpenHit }: Props) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestSeq = useRef(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      requestSeq.current += 1
      setResult(null)
      setError(null)
      return
    }

    const seq = ++requestSeq.current
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const r = await window.fieldguide.fileGrep(projectId, trimmed, { caseSensitive })
        if (seq !== requestSeq.current) return // stale
        if (r.ok && r.data) {
          setResult(r.data)
          setError(null)
          setActiveIndex(0)
        } else {
          setError(r.error?.message ?? t('searchContent.failed'))
        }
      } catch (err) {
        if (seq === requestSeq.current) setError(String(err))
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    }, 220)

    return () => clearTimeout(timer)
  }, [query, caseSensitive, projectId, t])

  const matches = result?.matches ?? []

  function openIndex(i: number) {
    const hit = matches[i]
    if (!hit) return
    onOpenHit(hit.path, hit.line)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-[var(--fg-modal-scrim)]" onClick={onClose}>
      <div
        className="w-[640px] max-w-[92vw] bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-xl shadow-[var(--fg-dialog-shadow)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t('searchContent.title')}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--fg-border)]">
          <Search size={14} className="text-[var(--fg-text-tertiary)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); onClose() }
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, matches.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
              if (e.key === 'Enter') { e.preventDefault(); openIndex(activeIndex) }
            }}
            placeholder={t('searchContent.placeholder')}
            aria-label={t('searchContent.placeholder')}
            className="flex-1 bg-transparent text-sm text-[var(--fg-text-primary)] focus:outline-none"
          />
          <button
            type="button"
            aria-pressed={caseSensitive}
            onClick={() => setCaseSensitive((v) => !v)}
            title={t('searchContent.caseSensitive')}
            className={cn(
              'shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border',
              caseSensitive
                ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] border-[var(--fg-accent)]'
                : 'text-[var(--fg-text-tertiary)] border-[var(--fg-border)] hover:bg-[var(--fg-tree-hover)]',
            )}
          >
            Aa
          </button>
          <button onClick={onClose} aria-label={t('common.close')} className="shrink-0 text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-primary)]">
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-auto">
          {query.trim().length < 2 && (
            <p className="px-3 py-4 text-xs text-[var(--fg-text-tertiary)]">{t('searchContent.hint')}</p>
          )}
          {loading && <p className="px-3 py-4 text-xs text-[var(--fg-text-tertiary)]">{t('searchContent.searching')}</p>}
          {error && <p className="px-3 py-4 text-xs text-[var(--fg-status-error)]">{error}</p>}
          {!loading && result && matches.length === 0 && (
            <p className="px-3 py-4 text-xs text-[var(--fg-text-tertiary)]">{t('searchContent.noMatch')}</p>
          )}

          {matches.map((hit, i) => (
            <button
              key={`${hit.path}:${hit.line}`}
              onClick={() => openIndex(i)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'w-full text-left px-3 py-1.5 flex items-start gap-2 border-b border-[var(--fg-border)] last:border-b-0',
                i === activeIndex ? 'bg-[var(--fg-accent-muted)]' : 'hover:bg-[var(--fg-tree-hover)]',
              )}
            >
              <FileText size={12} className="mt-0.5 shrink-0 text-[var(--fg-text-tertiary)]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[11px]">
                  <span className="font-mono text-[var(--fg-accent-text)] truncate">{hit.path}</span>
                  <span className="text-[var(--fg-text-tertiary)] shrink-0 tabular-nums">:{hit.line}</span>
                </span>
                <span className="block text-[11px] text-[var(--fg-text-secondary)] font-mono truncate">{hit.text}</span>
              </span>
            </button>
          ))}
        </div>

        {result && matches.length > 0 && (
          <div className="px-3 py-1.5 border-t border-[var(--fg-border)] text-[10px] text-[var(--fg-text-tertiary)] flex items-center justify-between">
            <span>{t('searchContent.summary', { matches: matches.length, files: result.filesWithMatches, scanned: result.filesScanned })}</span>
            {result.truncated && <span className="text-[var(--fg-status-warning)]">{t('searchContent.truncated')}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
