/**
 * CommandPalette — Ctrl+K 命令面板 (ui-spec v0.4 §4.5)
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, FileText, Hexagon } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  shortcut?: string
  action: () => void
}

interface Props {
  commands: Command[]
  open: boolean
  onClose: () => void
  t: (key: string) => string
  searchFiles?: (query: string) => Promise<Array<{ path: string; name: string }>>
  searchNodes?: (query: string) => Promise<Array<{ id: string; label: string; type: string; filePath?: string }>>
  onFileSelect?: (filePath: string) => void
  onNodeSelect?: (nodeId: string) => void
}

interface NodeResult { id: string; label: string; type: string; filePath?: string }

export default function CommandPalette({ commands, open, onClose, t, searchFiles, searchNodes, onFileSelect, onNodeSelect }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [fileResults, setFileResults] = useState<Array<{ path: string; name: string }>>([])
  const [nodeResults, setNodeResults] = useState<NodeResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelected(0)
      return
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!searchFiles || query.length < 1) { setFileResults([]); return }
    const timer = setTimeout(async () => {
      try { const r = await searchFiles(query); setFileResults(r.slice(0, 5)) }
      catch { setFileResults([]) }
    }, 150)
    return () => clearTimeout(timer)
  }, [query, searchFiles])

  useEffect(() => {
    if (!searchNodes || query.length < 2) { setNodeResults([]); return }
    const timer = setTimeout(async () => {
      try { const r = await searchNodes(query); setNodeResults(r.slice(0, 5)) }
      catch { setNodeResults([]) }
    }, 200)
    return () => clearTimeout(timer)
  }, [query, searchNodes])

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands

  const combined: Array<{ kind: 'cmd' | 'file' | 'node'; id: string; label: string; action: () => void }> = [
    ...filtered.map(c => ({ kind: 'cmd' as const, id: c.id, label: c.label, action: c.action })),
    ...fileResults.map(f => ({
      kind: 'file' as const,
      id: `file:${f.path}`,
      label: `${f.name} — ${f.path}`,
      action: () => { onFileSelect?.(f.path); onClose() },
    })),
    ...nodeResults.map(n => ({
      kind: 'node' as const,
      id: `node:${n.id}`,
      label: `${n.label} (${n.type})${n.filePath ? ` — ${n.filePath}` : ''}`,
      action: () => { onNodeSelect?.(n.id); onClose() },
    })),
  ]

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
        if (combined[selected]) combined[selected].action()
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [combined, selected, onClose],
  )

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="top-[20%] translate-y-0 max-w-[560px] gap-0 p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--fg-border)]">
          <Search size={16} className="text-[var(--fg-text-tertiary)] shrink-0" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={t('commandPalette.placeholder')}
            className="border-0 shadow-none focus-visible:ring-0 h-8 px-0"
          />
          <kbd className="text-xs text-[var(--fg-text-tertiary)] bg-[var(--fg-tree-hover)] px-1.5 py-0.5 rounded">Esc</kbd>
        </div>
        <div className="max-h-72 overflow-auto">
          {combined.length === 0 ? (
            <div className="px-4 py-8 text-center text-[var(--fg-text-tertiary)] text-sm">{t('commandPalette.noMatch')}</div>
          ) : (
            combined.map((item, i) => (
              <button
                key={item.id}
                onClick={() => { item.action(); onClose() }}
                className={cn(
                  'w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors duration-150',
                  i === selected
                    ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]'
                    : 'text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]',
                )}
              >
                {item.kind === 'file' && <FileText size={14} className="shrink-0 opacity-60" />}
                {item.kind === 'node' && <Hexagon size={14} className="shrink-0 opacity-60" />}
                <span className="flex-1 truncate">{item.label}</span>
                {item.kind === 'file' && <span className="text-xs text-[var(--fg-text-tertiary)]">{t('commandPalette.jump')}</span>}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
