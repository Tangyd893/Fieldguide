import { useState, useEffect } from 'react'

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
      } else setError(r.error?.message ?? '添加失败')
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
        setDiffResult({ projectId, summary: d.summary ?? d.message ?? (d.noChanges ? '未检测到文件变更。' : '分析完成。') })
      } else {
        setDiffResult({ projectId, summary: r.error?.message ?? '分析失败' })
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
        setError(r.error?.message ?? '删除失败')
      }
    } catch (err) { setError(String(err)) }
    finally { setDeleting(null) }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-gray-400 text-sm">{t('codeMap.loading')}</div></div>

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-50 flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('project.emptyTitle')}</h2>
          <p className="text-sm text-gray-500 mb-8">{t('project.emptyDesc')}</p>
          <div className="flex flex-col gap-3">
            <button onClick={()=>{setAddMode('local');setShowAdd(true)}} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">{t('project.addLocal')}</button>
            <button onClick={()=>{setAddMode('git');setShowAdd(true)}} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">{t('project.addGit')}</button>
          </div>
          {showAdd && <AddDialog mode={addMode} localPath={localPath} gitUrl={gitUrl} gitBranch={gitBranch} error={error} adding={adding}
            onLocalPathChange={setLocalPath} onGitUrlChange={setGitUrl} onGitBranchChange={setGitBranch}
            onClose={()=>{setShowAdd(false);setError(null)}} onAdd={handleAdd} t={t} />}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{t('tabs.library')}</h2>
        <div className="flex gap-2">
          <button onClick={()=>{setAddMode('local');setShowAdd(true)}} className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">+ {t('project.addLocal')}</button>
          <button onClick={()=>{setAddMode('git');setShowAdd(true)}} className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">+ {t('project.addGit')}</button>
        </div>
      </div>
      <div className="space-y-3">
        {projects.map(p=>(
          <button key={p.id} onClick={()=>onSelect(p)}
            onContextMenu={(e) => { e.preventDefault(); if (window.confirm(`确定删除项目「${p.name}」？\n此操作仅删除记录，不会删除源代码文件。`)) handleDelete(p.id) }}
            className={`w-full text-left p-4 rounded-lg border transition-all group relative ${selected?.id===p.id?'border-blue-300 bg-blue-50 shadow-sm':'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{p.name}</span>
                  {p.language&&<span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">{p.language}</span>}
                  <StatusBadge status={p.status} t={t} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="truncate max-w-[300px]" title={p.root_path}>{p.root_path}</span>
                  {p.indexed_at&&<span>{t('project.indexedAt',{date:new Date(p.indexed_at).toLocaleDateString('zh-CN')})}</span>}
                  {p.node_count>0&&<span>{t('project.nodes',{count:p.node_count})}</span>}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); if (window.confirm(`确定删除项目「${p.name}」？\n此操作仅删除记录，不会删除源代码文件。`)) handleDelete(p.id) }}
                disabled={deleting === p.id}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-lg leading-none px-1 transition-opacity disabled:opacity-40"
                title="删除项目记录"
              >×</button>
              {(p.status === 'pending' || p.status === 'failed' || p.status === 'stale') && (
                <button
                  onClick={(e) => { e.stopPropagation(); onIndex?.(p.id) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-500 text-xs px-2 py-0.5 border border-gray-200 rounded hover:border-blue-300 transition-all"
                  title={p.status === 'stale' ? '更新索引' : '开始索引'}
                >{p.status === 'stale' ? '🔄 更新' : '⚡ 索引'}</button>
              )}
              {(p.status === 'stale' || p.status === 'ready') && p.node_count > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDiffAnalyze(p.id) }}
                  disabled={analyzingDiff === p.id}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-purple-500 text-xs px-2 py-0.5 border border-gray-200 rounded hover:border-purple-300 transition-all disabled:opacity-40"
                  title="分析变更影响"
                >{analyzingDiff === p.id ? '⏳' : '📊 分析'}</button>
              )}
              {(p.status === 'stale' || p.status === 'ready') && p.node_count > 0 && onFullReindex && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(`确定对「${p.name}」执行全量重建索引？\n这将忽略已有缓存重新分析所有文件。`)) onFullReindex(p.id) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-amber-500 text-xs px-2 py-0.5 border border-gray-200 rounded hover:border-amber-300 transition-all"
                  title="全量重建索引（忽略已有缓存）"
                >🔁 全量</button>
              )}
              <span className="text-gray-300 text-lg">→</span>
            </div>
          </button>
        ))}
      </div>
      {showAdd && <AddDialog mode={addMode} localPath={localPath} gitUrl={gitUrl} gitBranch={gitBranch} error={error} adding={adding}
        onLocalPathChange={setLocalPath} onGitUrlChange={setGitUrl} onGitBranchChange={setGitBranch}
        onClose={()=>{setShowAdd(false);setError(null)}} onAdd={handleAdd} t={t} />}
      {diffResult && <DiffResultDialog result={diffResult} onClose={() => setDiffResult(null)} />}
    </div>
  )
}

function StatusBadge({ status, t }: { status: ProjectRow['status']; t: (k: string) => string }) {
  const map: Record<string, string> = { pending:'bg-gray-100 text-gray-500', indexing:'bg-yellow-100 text-yellow-700', ready:'bg-green-100 text-green-700', failed:'bg-red-100 text-red-600', stale:'bg-orange-100 text-orange-700' }
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${map[status]??map.pending}`}>{t(`project.status.${status}`)}</span>
}

function AddDialog({ mode, localPath, gitUrl, gitBranch, error, adding, onLocalPathChange, onGitUrlChange, onGitBranchChange, onClose, onAdd, t }:
  { mode:string; localPath:string; gitUrl:string; gitBranch:string; error:string|null; adding:boolean
    onLocalPathChange:(v:string)=>void; onGitUrlChange:(v:string)=>void; onGitBranchChange:(v:string)=>void
    onClose:()=>void; onAdd:()=>void; t:(k:string)=>string }) {
  const can = mode==='local' ? localPath.trim().length>0 : gitUrl.trim().length>0
  return <>
    <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] bg-white rounded-xl shadow-xl z-50 p-6">
      <h3 className="text-lg font-semibold mb-4">{mode==='local'?t('project.addLocalTitle'):t('project.addGitTitle')}</h3>
      {mode==='local'?<>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('project.pathLabel')}</label>
        <input type="text" value={localPath} onChange={e=>onLocalPathChange(e.target.value)} placeholder="D:\Projects\my-repo"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus disabled={adding} />
        <p className="text-xs text-gray-400 mt-3">{t('project.localPathHint')}</p>
      </>:<>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('project.gitUrlLabel')}</label>
        <input type="text" value={gitUrl} onChange={e=>onGitUrlChange(e.target.value)} placeholder="https://github.com/user/repo.git"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus disabled={adding} />
        <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">{t('project.branchLabel')}</label>
        <input type="text" value={gitBranch} onChange={e=>onGitBranchChange(e.target.value)} placeholder={t('project.branchPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={adding} />
      </>}
      {error && <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">{error}</div>}
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} disabled={adding} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-40">{t('project.cancel')}</button>
        <button onClick={onAdd} disabled={!can||adding} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">{adding?t('project.processing'):t('project.addProject')}</button>
      </div>
    </div>
  </>
}

function DiffResultDialog({ result, onClose }: { result: { projectId: string; summary: string }; onClose: () => void }) {
  return <>
    <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-h-[80vh] bg-white rounded-xl shadow-xl z-50 p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">📊 变更影响分析</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>
      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
        {result.summary}
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">关闭</button>
      </div>
    </div>
  </>
}
