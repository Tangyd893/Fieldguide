/**
 * CommandPalette — Ctrl+K 命令面板 (ui-spec v0.4 §4.5)
 *
 * Commands: 切换项目, 重新索引, 打开设置, 切换主题, 跳转文件
 */
import { useState, useEffect, useRef, useCallback } from 'react'

interface Command {
  id: string
  label: string
  shortcut?: string
  action: () => void
}

interface Props {
  commands: Command[]
  onClose: () => void
  /** Optional: async file search for jump-to-file */
  searchFiles?: (query: string) => Promise<Array<{ path: string; name: string }>>
  /** Optional: async node search for jump-to-node */
  searchNodes?: (query: string) => Promise<Array<{ id: string; label: string; type: string; filePath?: string }>>
  /** Called when a file result is selected */
  onFileSelect?: (filePath: string) => void
  /** Called when a node result is selected */
  onNodeSelect?: (nodeId: string) => void
}

interface NodeResult { id: string; label: string; type: string; filePath?: string }

export default function CommandPalette({ commands, onClose, searchFiles, searchNodes, onFileSelect, onNodeSelect }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [fileResults, setFileResults] = useState<Array<{ path: string; name: string }>>([])
  const [nodeResults, setNodeResults] = useState<NodeResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced file search
  useEffect(() => {
    if (!searchFiles || query.length < 1) { setFileResults([]); return }
    const t = setTimeout(async () => {
      try { const r = await searchFiles(query); setFileResults(r.slice(0, 5)) }
      catch { setFileResults([]) }
    }, 150)
    return () => clearTimeout(t)
  }, [query, searchFiles])

  // Debounced node search
  useEffect(() => {
    if (!searchNodes || query.length < 2) { setNodeResults([]); return }
    const t = setTimeout(async () => {
      try { const r = await searchNodes(query); setNodeResults(r.slice(0, 5)) }
      catch { setNodeResults([]) }
    }, 200)
    return () => clearTimeout(t)
  }, [query, searchNodes])

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands

  // Build combined list: commands first, then file results, then node results
  const combined: Array<{ kind: 'cmd' | 'file' | 'node'; id: string; label: string; action: () => void }> = [
    ...filtered.map(c => ({ kind: 'cmd' as const, id: c.id, label: c.label, action: c.action })),
    ...fileResults.map(f => ({
      kind: 'file' as const,
      id: `file:${f.path}`,
      label: `📄 ${f.name} — ${f.path}`,
      action: () => { onFileSelect?.(f.path); onClose() },
    })),
    ...nodeResults.map(n => ({
      kind: 'node' as const,
      id: `node:${n.id}`,
      label: `🔷 ${n.label} (${n.type})${n.filePath ? ` — ${n.filePath}` : ''}`,
      action: () => { onNodeSelect?.(n.id); onClose() },
    })),
  ]

  // Keyboard nav
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, combined.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (combined[selected]) {
          combined[selected].action()
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [combined, selected, onClose],
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[560px] bg-white rounded-xl shadow-2xl z-50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
          <span className="text-gray-400">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="搜索命令、文件或节点…"
            className="flex-1 text-sm outline-none text-gray-800"
          />
          <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>
        <div className="max-h-72 overflow-auto">
          {combined.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">无匹配命令</div>
          ) : (
            combined.map((item, i) => (
              <button
                key={item.id}
                onClick={() => { item.action(); onClose() }}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                  i === selected ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex-1">{item.label}</span>
                {item.kind === 'file' && <span className="text-xs text-gray-400">跳转</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
