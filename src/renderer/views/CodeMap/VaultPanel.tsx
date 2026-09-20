/**
 * VaultPanel — the Obsidian side of a project: what was synced, what needs a
 * decision, and what the reader added themselves.
 *
 * The panel is the only place that shows note *status*, because status is a
 * three-way comparison (what we wrote / what is on disk / what the sources now
 * say) that no other view has the context for.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, FileText, Play, RefreshCw, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import type { ObsidianStatus, VaultNoteStatus, VaultNoteView, VaultSyncReport } from '@shared/obsidian'
import { renderMarkdown } from '../../lib/markdown'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  t: (key: string, opts?: Record<string, unknown>) => string
  /** Lets the shell refresh the notes panel after "采纳为代码笔记". */
  onNoteSaved?: () => void
}

const STATUS_KEYS: Record<VaultNoteStatus, string> = {
  clean: 'vault.status.clean',
  'user-edited': 'vault.status.userEdited',
  conflict: 'vault.status.conflict',
  missing: 'vault.status.missing',
}

const KIND_KEYS: Record<string, string> = {
  index: 'vault.kind.index',
  architecture: 'vault.kind.architecture',
  layer: 'vault.kind.layer',
  module: 'vault.kind.module',
  tour: 'vault.kind.tour',
  knowledge: 'vault.kind.knowledge',
  interview: 'vault.kind.interview',
  bridge: 'vault.kind.bridge',
  path: 'vault.kind.path',
  note: 'vault.kind.note',
  report: 'vault.kind.report',
}

/** Obsidian wikilinks are not Markdown; show their label instead of `[[…]]`. */
function previewSource(markdown: string): string {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/%%\s*fieldguide:(begin|end)\s*%%/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^>\s?/gm, '')
    .trim()
}

export default function VaultPanel({ projectId, t, onNoteSaved }: Props) {
  const [status, setStatus] = useState<ObsidianStatus | null>(null)
  const [notes, setNotes] = useState<VaultNoteView[]>([])
  const [folder, setFolder] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [plan, setPlan] = useState<VaultSyncReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyProblems, setOnlyProblems] = useState(false)

  const load = useCallback(async () => {
    try {
      const [statusResult, notesResult] = await Promise.all([
        window.fieldguide.obsidianStatus(projectId),
        window.fieldguide.obsidianNotes(projectId),
      ])
      if (statusResult.ok && statusResult.data) setStatus(statusResult.data)
      if (notesResult.ok && notesResult.data) {
        setNotes(notesResult.data.notes)
        setFolder(notesResult.data.folder)
      } else if (!notesResult.ok) {
        setNotes([])
      }
    } catch {
      /* the panel degrades to its empty state */
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const problems = useMemo(
    () => notes.filter((note) => note.status === 'conflict' || note.status === 'missing'),
    [notes],
  )
  const visible = onlyProblems ? problems : notes
  const current = notes.find((note) => note.notePath === selected) ?? visible[0] ?? null

  useEffect(() => {
    if (!current) { setPreview(''); return }
    let cancelled = false
    void window.fieldguide.obsidianReadNote(projectId, current.notePath).then((result) => {
      if (cancelled) return
      if (result.ok && result.data) setPreview(previewSource(result.data.content))
      else setPreview('')
    })
    return () => { cancelled = true }
  }, [current, projectId])

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  /** Preview first: the first sync of a vault writes into the user's own directory. */
  function previewPlan() {
    void run(async () => {
      const result = await window.fieldguide.obsidianSync(projectId, { dryRun: true })
      if (!result.ok) { setError(result.error?.message ?? t('vault.syncFailed')); return }
      setPlan(result.data ?? null)
    })
  }

  /**
   * Apply the previewed plan.
   *
   * `openAfter` is left *unspecified* for the plain 确认 path so the main process
   * can apply the user's standing `openAfterSync` preference — passing `false`
   * here would silently override that setting.
   */
  function applyPlan(openAfter?: boolean) {
    void run(async () => {
      const result = await window.fieldguide.obsidianSync(projectId, {
        dryRun: false,
        ...(openAfter === undefined ? {} : { openAfter }),
      })
      if (!result.ok) { setError(result.error?.message ?? t('vault.syncFailed')); return }
      const report = result.data
      setPlan(null)
      setMessage(report
        ? t('vault.synced', {
          created: report.created,
          updated: report.updated,
          conflicts: report.conflicts.length,
        })
        : t('vault.synced', { created: 0, updated: 0, conflicts: 0 }))
      setTimeout(() => setMessage(null), 5000)
      await load()
    })
  }

  const openNote = (note: VaultNoteView) => run(async () => {
    const result = await window.fieldguide.obsidianOpenNote(projectId, note.notePath)
    if (!result.ok) setError(result.error?.message ?? t('vault.openFailed'))
  })

  const adopt = (note: VaultNoteView) => run(async () => {
    const result = await window.fieldguide.obsidianAdoptNote(projectId, note.notePath)
    if (!result.ok) { setError(result.error?.message ?? t('vault.adoptFailed')); return }
    setMessage(t('vault.adopted'))
    setTimeout(() => setMessage(null), 4000)
    onNoteSaved?.()
  })

  const resolve = (note: VaultNoteView, action: 'keep-user' | 'overwrite' | 'save-copy') => run(async () => {
    const result = await window.fieldguide.obsidianResolveNote(projectId, note.notePath, action)
    if (!result.ok) { setError(result.error?.message ?? t('vault.resolveFailed')); return }
    await load()
  })

  const cleanup = () => {
    if (!window.confirm(t('vault.cleanupConfirm'))) return
    void run(async () => {
      const result = await window.fieldguide.obsidianCleanup(projectId)
      if (!result.ok) { setError(result.error?.message ?? t('vault.syncFailed')); return }
      setMessage(t('vault.cleanupDone', { removed: result.data?.removed ?? 0, kept: result.data?.kept.length ?? 0 }))
      setTimeout(() => setMessage(null), 5000)
      await load()
    })
  }

  const vaultBound = Boolean(status?.binding?.path)
  const cliReady = status?.cli.state === 'ok'

  if (!vaultBound) {
    return (
      <div className="p-4 text-xs space-y-2">
        <p className="font-medium text-[var(--fg-text-secondary)]">{t('vault.noVault')}</p>
        <p className="text-[var(--fg-text-tertiary)]">{t('vault.noVaultHint')}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--fg-border)]">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--fg-text-primary)] truncate">{t('vault.title')}</h3>
          <p className="text-[11px] text-[var(--fg-text-tertiary)] truncate">
            {status?.binding?.name || t('vault.unnamedVault')} · {folder}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={previewPlan}
          >
            <RefreshCw size={12} className={busy ? 'animate-spin' : undefined} />
            {busy ? t('vault.syncing') : t('vault.sync')}
          </Button>
          {status?.lastSyncAt && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || !cliReady}
              onClick={() => applyPlan(true)}
            >
              <Play size={12} /> {t('vault.openIndex')}
            </Button>
          )}
        </div>
      </div>

      {!cliReady && (
        <p className="px-3 py-1.5 text-[11px] text-[var(--fg-text-tertiary)] border-b border-[var(--fg-border)]">
          {t('vault.cliHint')}
        </p>
      )}

      {message && (
        <p className="px-3 py-1.5 text-[11px] text-[var(--fg-status-success)] border-b border-[var(--fg-border)]">
          <Check size={11} className="inline mr-1" />{message}
        </p>
      )}
      {error && (
        <p className="px-3 py-1.5 text-[11px] text-[var(--fg-status-error)] border-b border-[var(--fg-border)]">
          <TriangleAlert size={11} className="inline mr-1" />{error}
        </p>
      )}

      {plan && (
        <div className="px-3 py-2 border-b border-[var(--fg-border)] bg-[var(--fg-tree-hover)] space-y-2">
          <p className="font-medium text-[var(--fg-text-secondary)]">{t('vault.previewTitle')}</p>
          <p className="text-[var(--fg-text-tertiary)]">
            {t('vault.previewCounts', {
              created: plan.created,
              updated: plan.updated,
              unchanged: plan.unchanged,
              conflicts: plan.conflicts.length,
              removed: plan.removed,
            })}
          </p>
          {plan.conflicts.length > 0 && (
            <ul className="text-[11px] text-[var(--fg-status-error)] space-y-0.5">
              {plan.conflicts.slice(0, 5).map((conflict) => (
                <li key={conflict.notePath} className="truncate">{conflict.notePath} — {conflict.reason}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => applyPlan()}>{t('vault.confirm')}</Button>
            <Button variant="ghost" size="sm" onClick={() => setPlan(null)}>{t('vault.cancel')}</Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="p-4 space-y-2">
          <p className="text-[var(--fg-text-secondary)]">{t('vault.neverSynced')}</p>
          <p className="text-[var(--fg-text-tertiary)]">{t('vault.syncHint')}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          <div className="w-[42%] border-r border-[var(--fg-border)] flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--fg-border)]">
              <span className="text-[11px] text-[var(--fg-text-tertiary)]">
                {t('vault.noteCount', { count: notes.length })}
              </span>
              <button
                type="button"
                onClick={() => setOnlyProblems((value) => !value)}
                className={cn(
                  'text-[11px] px-1.5 py-0.5 rounded border',
                  onlyProblems
                    ? 'border-[var(--fg-accent)] text-[var(--fg-accent-text)]'
                    : 'border-[var(--fg-border)] text-[var(--fg-text-tertiary)]',
                )}
              >
                {t('vault.onlyProblems', { count: problems.length })}
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {visible.map((note) => (
                <button
                  key={note.notePath}
                  type="button"
                  onClick={() => setSelected(note.notePath)}
                  className={cn(
                    'w-full text-left px-2.5 py-1.5 border-b border-[var(--fg-border)] hover:bg-[var(--fg-tree-hover)]',
                    current?.notePath === note.notePath && 'bg-[var(--fg-accent-muted)]',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <FileText size={11} className="shrink-0 text-[var(--fg-text-tertiary)]" />
                    <span className="truncate text-[var(--fg-text-primary)]">{note.title}</span>
                  </span>
                  <span className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--fg-text-tertiary)]">
                    <span>{t(KIND_KEYS[note.kind] ?? 'vault.kind.knowledge')}</span>
                    <span className={cn(
                      note.status === 'conflict' || note.status === 'missing'
                        ? 'text-[var(--fg-status-error)]'
                        : note.status === 'user-edited'
                          ? 'text-[var(--fg-accent-text)]'
                          : '',
                    )}>
                      {t(STATUS_KEYS[note.status])}
                    </span>
                    {note.userChars > 0 && <span>· {t('vault.userChars', { count: note.userChars })}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            {current && (
              <>
                <div className="flex items-center gap-1.5 flex-wrap px-2.5 py-1.5 border-b border-[var(--fg-border)]">
                  <span className="text-[11px] text-[var(--fg-text-tertiary)] truncate flex-1">{current.notePath}</span>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => openNote(current)}>
                    <ExternalLink size={11} /> {t('vault.open')}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => adopt(current)}>
                    <Sparkles size={11} /> {t('vault.adopt')}
                  </Button>
                </div>
                {(current.status === 'conflict' || current.status === 'missing') && (
                  <div className="flex items-center gap-1.5 flex-wrap px-2.5 py-1.5 border-b border-[var(--fg-border)] bg-[var(--fg-tree-hover)]">
                    <span className="text-[11px] text-[var(--fg-status-error)]">{t('vault.conflictTitle')}</span>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => resolve(current, 'keep-user')}>
                      {t('vault.resolveKeepUser')}
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => resolve(current, 'overwrite')}>
                      {t('vault.resolveOverwrite')}
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => resolve(current, 'save-copy')}>
                      {t('vault.resolveSaveCopy')}
                    </Button>
                  </div>
                )}
                <div className="flex-1 overflow-auto p-3 text-[var(--fg-text-secondary)] leading-relaxed">
                  {preview ? renderMarkdown(preview) : <p className="text-[var(--fg-text-tertiary)]">{t('vault.loading')}</p>}
                </div>
              </>
            )}
            {!current && (
              <div className="p-4 text-[var(--fg-text-tertiary)]">{t('vault.selectHint')}</div>
            )}
            <div className="px-2.5 py-1.5 border-t border-[var(--fg-border)] flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={cleanup}>
                <Trash2 size={11} /> {t('vault.cleanup')}
              </Button>
              {status?.lastSyncAt && (
                <span className="text-[10px] text-[var(--fg-text-tertiary)]">
                  {t('vault.lastSync', { time: status.lastSyncAt.slice(0, 19).replace('T', ' ') })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
