/**
 * NodeSearchBar — 代码地图顶栏节点搜索 (Phase 2.5 语义搜索)
 */
import { useState, useEffect, useRef } from 'react'
import { dashboardSelectNode } from './GraphPanel'

interface Props {
  projectId: string
  onNodeSelect: (nodeId: string, filePath?: string) => void
  t: (key: string) => string
}

interface GraphNode {
  id: string; label?: string; type?: string; filePath?: string
  metadata?: { summary?: string }
}

export default function NodeSearchBar({ projectId, onNodeSelect, t: _t }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GraphNode[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load nodes on mount
  useEffect(() => {
    if (!projectId) return
    window.fieldguide.graphGet(projectId).then(r => {
      if (r.ok && r.data) {
        const g = r.data as { nodes?: GraphNode[] }
        setNodes((g.nodes || []).filter(n => n.type === 'function' || n.type === 'class' || n.type === 'file'))
      }
    })
  }, [projectId])

  // Search on input
  useEffect(() => {
    if (query.length < 1) { setResults([]); setShowDropdown(false); return }
    const q = query.toLowerCase()
    const matched = nodes
      .filter(n => (n.label || n.id).toLowerCase().includes(q))
      .slice(0, 8)
    setResults(matched)
    setShowDropdown(matched.length > 0)
  }, [query, nodes])

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

  return (
    <div ref={containerRef} className="relative px-3 py-1.5 border-b border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => query.length >= 1 && results.length > 0 && setShowDropdown(true)}
        onKeyDown={e => {
          if (e.key === 'Escape') { setShowDropdown(false); setQuery('') }
          if (e.key === 'Enter' && results.length > 0) {
            const first = results[0]
            onNodeSelect(first.id, first.filePath)
            setShowDropdown(false); setQuery('')
          }
        }}
        placeholder="搜索函数、类… (如: handler, service, main)"
        className="w-full px-2 py-1 text-xs border border-[var(--fg-border)] rounded bg-[var(--fg-bg)] text-[var(--fg-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--fg-accent)]"
      />
      {showDropdown && (
        <div className="absolute left-3 right-3 top-full mt-0.5 bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-lg shadow-lg z-20 max-h-56 overflow-auto">
          {results.map(n => (
            <button
              key={n.id}
              onClick={() => { onNodeSelect(n.id, n.filePath); dashboardSelectNode(n.id); setShowDropdown(false); setQuery('') }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--fg-accent-muted)] transition-colors flex items-center gap-2"
            >
              <span className="font-mono text-[var(--fg-accent-text)] truncate flex-1">{n.label || n.id}</span>
              <span className="text-[var(--fg-text-tertiary)] shrink-0">{n.type}</span>
              {n.filePath && <span className="text-[var(--fg-text-tertiary)] truncate shrink-0 max-w-[120px]">{n.filePath.split('/').pop()}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
