/**
 * NotesPanel — code notes and annotations (B2).
 *
 * Notes are pinned to a node and/or a file line range, so they can be reached
 * from both directions: this list, and the gutter markers in the code viewer.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { StickyNote, Trash2, ExternalLink, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  t: (key: string, opts?: Record<string, unknown>) => string
  onOpenFile?: (path: string, line?: number) => void
  onOpenNode?: (nodeId: string) => void
  /** Bumped by the code viewer after adding a note, so the list refreshes. */
  refreshToken?: number
}

export default function NotesPanel({ projectId, t, onOpenFile, onOpenNode, refreshToken }: Props) {
  const [notes, setNotes] = useState<CodeNoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState('')

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const r = await window.fieldguide.notesList(projectId)
      if (r.ok && r.data) {
        setNotes(r.data)
        setSelectedId((prev) => (prev && r.data!.some((n) => n.id === prev) ? prev : r.data![0]?.id ?? null))
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { void load() }, [load, refreshToken])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter((n) =>
      n.body.toLowerCase().includes(q)
      || n.file_path.toLowerCase().includes(q)
      || n.tags.toLowerCase().includes(q),
    )
  }, [notes, query])

  /** Group by file so the list mirrors how a reader moves through the project. */
  const grouped = useMemo(() => {
    const map = new Map<string, CodeNoteRow[]>()
    for (const note of filtered) {
      if (!map.has(note.file_path)) map.set(note.file_path, [])
      map.get(note.file_path)!.push(note)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const selected = notes.find((n) => n.id === selectedId) ?? null

  async function save() {
    if (!selected) return
    await window.fieldguide.notesUpdate(selected.id, { body: editing.trim() })
    await load()
  }

  async function remove(id: string) {
    await window.fieldguide.notesRemove(id)
    if (selectedId === id) setSelectedId(null)
    await load()
  }

  useEffect(() => {
    setEditing(selected?.body ?? '')
  }, [selected?.id, selected?.body])

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--fg-border)] shrink-0">
        <div className="relative flex-1">
          <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[var(--fg-text-tertiary)] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('notes.search')}
            aria-label={t('notes.search')}
            className="w-full pl-6 pr-2 py-1 text-[11px] rounded border border-[var(--fg-border)] bg-[var(--fg-bg)]"
          />
        </div>
        <span className="text-[10px] text-[var(--fg-text-tertiary)] shrink-0 tabular-nums">
          {t('notes.count', { count: filtered.length })}
        </span>
        <button
          onClick={() => void load()}
          aria-label={t('notes.refresh')}
          title={t('notes.refresh')}
          className="shrink-0 p-1 rounded text-[var(--fg-text-tertiary)] hover:bg-[var(--fg-tree-hover)]"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : undefined} />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="space-y-1.5">
            <StickyNote size={22} className="mx-auto text-[var(--fg-text-tertiary)]" />
            <p className="text-[var(--fg-text-secondary)]">{notes.length === 0 ? t('notes.empty') : t('notes.noMatch')}</p>
            <p className="text-[10px] text-[var(--fg-text-tertiary)]">{t('notes.emptyHint')}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          <div className="w-[42%] border-r border-[var(--fg-border)] overflow-auto">
            {grouped.map(([file, items]) => (
              <div key={file}>
                <p className="px-2 py-1 text-[10px] font-mono text-[var(--fg-text-tertiary)] truncate border-b border-[var(--fg-border)] bg-[var(--fg-panel-chrome,var(--fg-card))]" title={file}>
                  {file}
                </p>
                {items.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedId(note.id)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 border-b border-[var(--fg-border)] hover:bg-[var(--fg-tree-hover)]',
                      selectedId === note.id && 'bg-[var(--fg-accent-muted)]',
                    )}
                  >
                    <span className="block text-[10px] text-[var(--fg-text-tertiary)] tabular-nums">
                      {note.line_start ? `L${note.line_start}${note.line_end && note.line_end !== note.line_start ? `–${note.line_end}` : ''}` : t('notes.fileLevel')}
                      {note.tags ? ` · ${note.tags}` : ''}
                    </span>
                    <span className="block text-[11px] text-[var(--fg-text-secondary)] truncate">{note.body}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0 overflow-auto p-3 space-y-2">
            {selected && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenFile?.(selected.file_path, selected.line_start ?? undefined)}
                    className="text-[10px] text-[var(--fg-accent)] inline-flex items-center gap-1 hover:underline truncate"
                  >
                    <ExternalLink size={10} />
                    {selected.file_path}
                    {selected.line_start ? `:${selected.line_start}` : ''}
                  </button>
                  <span className="flex-1" />
                  <button
                    onClick={() => remove(selected.id)}
                    aria-label={t('notes.delete')}
                    title={t('notes.delete')}
                    className="shrink-0 p-1 rounded text-[var(--fg-text-tertiary)] hover:text-[var(--fg-status-error)]"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                {selected.node_id && (
                  <button
                    onClick={() => onOpenNode?.(selected.node_id)}
                    className="block font-mono text-[10px] text-[var(--fg-accent)] hover:underline truncate"
                  >
                    {selected.node_id}
                  </button>
                )}

                <textarea
                  value={editing}
                  onChange={(e) => setEditing(e.target.value)}
                  className="w-full h-40 px-2 py-1.5 text-[11px] rounded border border-[var(--fg-border)] bg-[var(--fg-bg)] resize-y"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" disabled={editing.trim() === selected.body} onClick={save}>
                    {t('notes.save')}
                  </Button>
                  <span className="text-[10px] text-[var(--fg-text-tertiary)]">
                    {new Date(selected.updated_at).toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
