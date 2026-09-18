/**
 * NodeSearchBar — code-map node search.
 *
 * Phase 2.5 originally did client-side `label.includes()` over a full `graph:get`
 * payload (a "fake" semantic search). It now calls `graph:search` with an explicit
 * mode: `semantic` runs the UA SearchEngine in the main process (falling back to a
 * deterministic substring matcher), `text` does exact substring matching over
 * labels/summaries. The backend actually used is surfaced in the UI.
 */
import { useState, useEffect, useRef } from 'react'
import { Sparkles, Type, Search } from 'lucide-react'
import { dashboardSelectNode } from './GraphPanel'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  onNodeSelect: (nodeId: string, filePath?: string) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

type SearchMode = 'semantic' | 'text'

interface SearchResultNode {
  id: string
  label?: string
  name?: string
  type?: string
  filePath?: string
  matchScore?: number | null
  metadata?: { summary?: string }
  summary?: string
}

const SEARCH_LIMIT = 10
const DEBOUNCE_MS = 180

export default function NodeSearchBar({ projectId, onNodeSelect, t }: Props) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('semantic')
  const [results, setResults] = useState<SearchResultNode[]>([])
  const [backend, setBackend] = useState<'ua' | 'substring' | null>(null)
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Guards against out-of-order responses when typing fast.
  const requestSeq = useRef(0)

  // Debounced server-side search
  useEffect(() => {
    const trimmed = query.trim()
    if (!projectId || trimmed.length < 1) {
      requestSeq.current += 1
      setResults([])
      setBackend(null)
      setShowDropdown(false)
      return
    }

    const seq = ++requestSeq.current
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const r = await window.fieldguide.graphSearch(projectId, trimmed, {
          mode,
          limit: SEARCH_LIMIT,
        })
        if (seq !== requestSeq.current) return // stale response
        if (r.ok && r.data) {
          const payload = r.data as { backend?: 'ua' | 'substring'; results?: SearchResultNode[] }
          setResults(payload.results ?? [])
          setBackend(payload.backend ?? null)
          setShowDropdown((payload.results ?? []).length > 0)
        } else {
          setResults([])
          setBackend(null)
        }
      } catch {
        if (seq === requestSeq.current) {
          setResults([])
          setBackend(null)
        }
      } finally {
        if (seq === requestSeq.current) setSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query, mode, projectId])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function reset() {
    setShowDropdown(false)
    setQuery('')
    setResults([])
  }

  function pick(node: SearchResultNode) {
    onNodeSelect(node.id, node.filePath)
    dashboardSelectNode(node.id)
    reset()
  }

  const scoreLabel = (n: SearchResultNode) =>
    typeof n.matchScore === 'number' ? n.matchScore.toFixed(2) : null

  return (
    <div
      ref={containerRef}
      className="relative px-3 py-1.5 border-b border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--fg-text-tertiary)] pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 1 && results.length > 0 && setShowDropdown(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') reset()
              if (e.key === 'Enter' && results.length > 0) pick(results[0])
            }}
            placeholder={t('codeMap.nodeSearchPlaceholder')}
            aria-label={t('codeMap.nodeSearchPlaceholder')}
            className="w-full pl-7 pr-2 py-1 text-xs border border-[var(--fg-border)] rounded bg-[var(--fg-bg)] text-[var(--fg-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--fg-accent)]"
          />
        </div>

        {/* Mode toggle: semantic (UA engine) vs exact text */}
        <div
          className="flex items-center rounded border border-[var(--fg-border)] overflow-hidden shrink-0"
          role="group"
          aria-label={t('codeMap.searchMode')}
        >
          {(['semantic', 'text'] as SearchMode[]).map((m) => {
            const active = mode === m
            const Icon = m === 'semantic' ? Sparkles : Type
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                title={t(m === 'semantic' ? 'codeMap.searchModeSemanticHint' : 'codeMap.searchModeTextHint')}
                onClick={() => setMode(m)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]'
                    : 'text-[var(--fg-text-tertiary)] hover:bg-[var(--fg-tree-hover)]',
                )}
              >
                <Icon size={11} />
                {t(m === 'semantic' ? 'codeMap.searchModeSemantic' : 'codeMap.searchModeText')}
              </button>
            )
          })}
        </div>

        {/* Which matcher actually ran */}
        {query.length >= 1 && backend && !searching && (
          <span
            className={cn(
              'shrink-0 text-[10px] px-1.5 py-0.5 rounded',
              backend === 'ua'
                ? 'bg-[var(--fg-status-success-bg)] text-[var(--fg-status-success)]'
                : 'bg-[var(--fg-status-warning-bg)] text-[var(--fg-status-warning)]',
            )}
          >
            {t(backend === 'ua' ? 'codeMap.searchBackendUa' : 'codeMap.searchBackendSubstring')}
          </span>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-3 right-3 top-full mt-0.5 bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg shadow-lg z-20 max-h-64 overflow-auto">
          {results.map((n) => {
            const score = scoreLabel(n)
            const summary = String(n.metadata?.summary || n.summary || '')
            return (
              <button
                key={n.id}
                onClick={() => pick(n)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--fg-accent-muted)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[var(--fg-accent-text)] truncate flex-1">
                    {n.label || n.name || n.id}
                  </span>
                  {score && (
                    <span className="text-[10px] text-[var(--fg-text-tertiary)] shrink-0 tabular-nums">
                      {score}
                    </span>
                  )}
                  <span className="text-[var(--fg-text-tertiary)] shrink-0">{n.type}</span>
                  {n.filePath && (
                    <span className="text-[var(--fg-text-tertiary)] truncate shrink-0 max-w-[120px]">
                      {n.filePath.split('/').pop()}
                    </span>
                  )}
                </div>
                {summary && (
                  <p className="text-[10px] text-[var(--fg-text-tertiary)] truncate mt-0.5">
                    {summary}
                  </p>
                )}
              </button>
            )
          })}
          {results.length === 0 && !searching && (
            <div className="px-3 py-2 text-xs text-[var(--fg-text-tertiary)]">
              {t('codeMap.noMatch')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
