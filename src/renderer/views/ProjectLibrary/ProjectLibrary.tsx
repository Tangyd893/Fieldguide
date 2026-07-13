import { useState, useEffect } from 'react'
import { RefreshCw, Zap, BarChart2, Loader2, RotateCw } from 'lucide-react'
import FolderPathField from '../../components/FolderPathField'
import { useIndexProgress, progressPercent } from '../../hooks/useIndexProgress'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogCloseButton } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface ProjectRow {
  id: string; name: string; slug: string; source_type: string; source_uri: string
  root_path: string; status: 'pending'|'indexing'|'ready'|'failed'|'stale'
  language: string; node_count: number; created_at: string; indexed_at: string|null
}

interface Props {
  selected: ProjectRow | null
  onSelect: (p: ProjectRow | null) => void
  onIndex?: (projectId: string) => void
  onFullReindex?: (projectId: string) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

export default function ProjectLibrary({ selected, onSelect, onIndex, onFullReindex, t }: Props) {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addMode, setAddMode] = useState<'local'|'git'>('local')
  const [localPath, setLocalPath] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [gitBranch, setGitBranch] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [deleting, setDeleting] = useState<string|null>(null)
  const [analyzingDiff, setAnalyzingDiff] = useState<string|null>(null)
  const [diffResult, setDiffResult] = useState<{ projectId: string; summary: string } | null>(null)
  const idxProgress = useIndexProgress()
  const idxPct = progressPercent(idxProgress.progress)

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    try {
      const r = await window.fieldguide.projectList()
      if (r.ok && r.data) setProjects(r.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function handleAdd() {
    setError(null); setAdding(true)
    try {
      const r = addMode==='local' ? await window.fieldguide.projectAddLocal(localPath) : await window.fieldguide.projectAddGit(gitUrl, gitBranch||undefined)
      if (r.ok && r.data) {
        setProjects(p => [r.data!, ...p]); setShowAdd(false); setLocalPath(''); setGitUrl(''); setGitBranch('')
        onSelect(r.data!)
      } else setError(r.error?.message ?? t('project.addFailed'))
    } catch (err) { setError(String(err)) }
    finally { setAdding(false) }
  }

  async function handleDiffAnalyze(projectId: string) {
    setAnalyzingDiff(projectId)
    setDiffResult(null)
    try {
      const r = await window.fieldguide.diffAnalyze(projectId)
      if (r.ok && r.data) {
        const d = r.data as { summary?: string; noChanges?: boolean; message?: string }
        setDiffResult({ projectId, summary: d.summary ?? d.message ?? (d.noChanges ? t('project.noChanges') : t('project.analyzeDone')) })
      } else {
        setDiffResult({ projectId, summary: r.error?.message ?? t('project.analyzeFailed') })
      }
    } catch (err) {
      setDiffResult({ projectId, summary: String(err) })
    } finally {
      setAnalyzingDiff(null)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const r = await window.fieldguide.projectRemove(id)
      if (r.ok) {
        setProjects(p => p.filter(x => x.id !== id))
        if (selected?.id === id) onSelect(null)
      } else {
        setError(r.error?.message ?? t('project.deleteFailed'))
      }
    } catch (err) { setError(String(err)) }
    finally { setDeleting(null) }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-[var(--fg-text-tertiary)] text-sm">{t('codeMap.loading')}</div></div>

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--fg-accent-muted)] flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--fg-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--fg-text-primary)] mb-2">{t('project.emptyTitle')}</h2>
          <p className="text-sm text-[var(--fg-text-secondary)] mb-8">{t('project.emptyDesc')}</p>
          <div className="flex flex-col gap-3">
            <Button onClick={()=>{setAddMode('local');setShowAdd(true)}} className="px-6 py-2.5">{t('project.addLocal')}</Button>
            <Button variant="outline" onClick={()=>{setAddMode('git');setShowAdd(true)}} className="px-6 py-2.5">{t('project.addGit')}</Button>
          </div>
          <AddDialog open={showAdd} mode={addMode} localPath={localPath} gitUrl={gitUrl} gitBranch={gitBranch} error={error} adding={adding}
            onLocalPathChange={setLocalPath} onGitUrlChange={setGitUrl} onGitBranchChange={setGitBranch}
            onClose={()=>{setShowAdd(false);setError(null)}} onAdd={handleAdd} t={t} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{t('tabs.library')}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={()=>{setAddMode('local');setShowAdd(true)}}>+ {t('project.addLocal')}</Button>
          <Button variant="outline" size="sm" onClick={()=>{setAddMode('git');setShowAdd(true)}}>+ {t('project.addGit')}</Button>
        </div>
      </div>
      <div className="space-y-3">
        {projects.map(p=>(
          <button key={p.id} onClick={()=>onSelect(p)}
            onContextMenu={(e) => { e.preventDefault(); if (window.confirm(t('project.deleteConfirm', { name: p.name }))) handleDelete(p.id) }}
            className={`w-full text-left p-4 rounded-lg border transition-all group relative ${selected?.id===p.id?'border-[var(--fg-accent)] bg-[var(--fg-accent-muted)] shadow-sm':'border-[var(--fg-border)] bg-[var(--fg-card)] hover:border-[var(--fg-text-tertiary)] hover:shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--fg-text-primary)] truncate">{p.name}</span>
                  {p.language&&<span className="text-xs px-1.5 py-0.5 rounded bg-[var(--fg-tree-hover)] text-[var(--fg-text-secondary)] font-mono">{p.language}</span>}
                  <StatusBadge status={p.status} t={t} isIndexing={idxProgress.isIndexing} pct={idxPct} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--fg-text-tertiary)]">
                  <span className="truncate max-w-[300px]" title={p.root_path}>{p.root_path}</span>
                  {p.indexed_at&&<span>{t('project.indexedAt',{date:new Date(p.indexed_at).toLocaleDateString('zh-CN')})}</span>}
                  {p.node_count>0&&<span>{t('project.nodes',{count:p.node_count})}</span>}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); if (window.confirm(t('project.deleteConfirm', { name: p.name }))) handleDelete(p.id) }}
                disabled={deleting === p.id}
                className="opacity-0 group-hover:opacity-100 text-[var(--fg-text-tertiary)] hover:text-[var(--fg-status-error)] text-lg leading-none px-1 transition-opacity disabled:opacity-40"
                title={t('tooltip.deleteProject')}
              >×</button>
              {(p.status === 'pending' || p.status === 'failed' || p.status === 'stale') && (
                <button
                  onClick={(e) => { e.stopPropagation(); onIndex?.(p.id) }}
                  className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[var(--fg-text-tertiary)] hover:text-[var(--fg-accent)] text-xs px-2 py-0.5 border border-[var(--fg-border)] rounded hover:border-[var(--fg-accent)] transition-all"
                  title={p.status === 'stale' ? t('tooltip.updateIndex') : t('tooltip.indexProject')}
                >
                  {p.status === 'stale' ? <RefreshCw size={12} /> : <Zap size={12} />}
                  {p.status === 'stale' ? t('project.updateIndex') : t('project.indexBtn')}
                </button>
              )}
              {(p.status === 'stale' || p.status === 'ready') && p.node_count > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDiffAnalyze(p.id) }}
                  disabled={analyzingDiff === p.id}
                  className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[var(--fg-text-tertiary)] hover:text-[var(--fg-status-info)] text-xs px-2 py-0.5 border border-[var(--fg-border)] rounded hover:border-[var(--fg-status-info)] transition-all disabled:opacity-40"
                  title={t('project.analyzeDiff')}
                >
                  {analyzingDiff === p.id ? <Loader2 size={12} className="animate-spin" /> : <BarChart2 size={12} />}
                  {analyzingDiff === p.id ? t('project.analyzing') : t('project.analyzeDiff')}
                </button>
              )}
              {(p.status === 'stale' || p.status === 'ready') && p.node_count > 0 && onFullReindex && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(t('project.fullReindexConfirm', { name: p.name }))) onFullReindex(p.id) }}
                  className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[var(--fg-text-tertiary)] hover:text-[var(--fg-status-warning)] text-xs px-2 py-0.5 border border-[var(--fg-border)] rounded hover:border-[var(--fg-status-warning)] transition-all"
                  title={t('project.fullReindex')}
                >
                  <RotateCw size={12} />
                  {t('project.fullReindex')}
                </button>
              )}
              <span className="text-[var(--fg-text-tertiary)] text-lg">→</span>
            </div>
          </button>
        ))}
      </div>
      <AddDialog open={showAdd} mode={addMode} localPath={localPath} gitUrl={gitUrl} gitBranch={gitBranch} error={error} adding={adding}
        onLocalPathChange={setLocalPath} onGitUrlChange={setGitUrl} onGitBranchChange={setGitBranch}
        onClose={()=>{setShowAdd(false);setError(null)}} onAdd={handleAdd} t={t} />
      <DiffResultDialog open={!!diffResult} result={diffResult} onClose={() => setDiffResult(null)} t={t} />
    </div>
  )
}

function StatusBadge({ status, t, isIndexing, pct }: { status: ProjectRow['status']; t: (k: string) => string; isIndexing?: boolean; pct?: number }) {
  if (status === 'indexing' && isIndexing && pct !== undefined && pct >= 0) {
    const r = 10; const circ = 2 * Math.PI * r; const offset = circ - (pct / 100) * circ
    return (
      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-[var(--fg-status-warning-bg)] text-[var(--fg-status-warning)]">
        <svg className="w-3.5 h-3.5 -ml-0.5" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="3" opacity="0.2" />
          <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="3"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
        </svg>
        {pct}%
      </span>
    )
  }
  const map: Record<string, string> = {
    pending: 'bg-[var(--fg-tree-hover)] text-[var(--fg-text-secondary)]',
    indexing: 'bg-[var(--fg-status-warning-bg)] text-[var(--fg-status-warning)]',
    ready: 'bg-[var(--fg-status-success-bg)] text-[var(--fg-status-success)]',
    failed: 'bg-[var(--fg-status-error-bg)] text-[var(--fg-status-error)]',
    stale: 'bg-[var(--fg-status-warning-bg)] text-[var(--fg-status-warning)]',
  }
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${map[status]??map.pending}`}>{t(`project.status.${status}`)}</span>
}

function AddDialog({ open, mode, localPath, gitUrl, gitBranch, error, adding, onLocalPathChange, onGitUrlChange, onGitBranchChange, onClose, onAdd, t }:
  { open: boolean; mode:string; localPath:string; gitUrl:string; gitBranch:string; error:string|null; adding:boolean
    onLocalPathChange:(v:string)=>void; onGitUrlChange:(v:string)=>void; onGitBranchChange:(v:string)=>void
    onClose:()=>void; onAdd:()=>void; t:(k:string)=>string }) {
  const can = mode==='local' ? localPath.trim().length>0 : gitUrl.trim().length>0
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="w-[440px] max-w-[95vw] p-6">
        <div className="flex items-center justify-between mb-4">
          <DialogTitle>{mode==='local'?t('project.addLocalTitle'):t('project.addGitTitle')}</DialogTitle>
          <DialogCloseButton />
        </div>
        {mode==='local'?<>
          <label className="block text-sm font-medium text-[var(--fg-text-primary)] mb-1">{t('project.pathLabel')}</label>
          <FolderPathField
            value={localPath}
            onChange={onLocalPathChange}
            placeholder="D:\Projects\my-repo"
            browseLabel={t('common.browseFolder')}
            disabled={adding}
            autoFocus
          />
          <p className="text-xs text-[var(--fg-text-tertiary)] mt-3">{t('project.localPathHint')}</p>
        </>:<>
          <label className="block text-sm font-medium text-[var(--fg-text-primary)] mb-1">{t('project.gitUrlLabel')}</label>
          <Input type="text" value={gitUrl} onChange={e=>onGitUrlChange(e.target.value)} placeholder="https://github.com/user/repo.git" autoFocus disabled={adding} />
          <label className="block text-sm font-medium text-[var(--fg-text-primary)] mt-3 mb-1">{t('project.branchLabel')}</label>
          <Input type="text" value={gitBranch} onChange={e=>onGitBranchChange(e.target.value)} placeholder={t('project.branchPlaceholder')} disabled={adding} />
        </>}
        {error && <div className="mt-3 p-2 bg-[var(--fg-status-error-bg)] border border-[var(--fg-status-error)] rounded text-sm text-[var(--fg-status-error)]">{error}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={onClose} disabled={adding}>{t('project.cancel')}</Button>
          <Button onClick={onAdd} disabled={!can||adding}>{adding?t('project.processing'):t('project.addProject')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DiffResultDialog({ open, result, onClose, t }: { open: boolean; result: { projectId: string; summary: string } | null; onClose: () => void; t: (k: string) => string }) {
  if (!result) return null
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="w-[520px] max-w-[95vw] max-h-[80vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <DialogTitle>{t('project.diffTitle')}</DialogTitle>
          <DialogCloseButton />
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg-text-primary)]">
          {result.summary}
        </div>
        <div className="flex justify-end mt-6">
          <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
