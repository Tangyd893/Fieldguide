/**
 * ProjectLibrary — ui-spec.md §3.1
 *
 * 空状态: 插图 + 添加按钮
 * 列表: 卡片 (name, language badge, status, node count, indexedAt)
 * 添加: 本地文件夹 / Git URL 对话框
 */
import { useState } from 'react'

interface Project {
  id: string
  name: string
  slug: string
  language: string
  nodeCount: number
  status: 'pending' | 'indexing' | 'ready' | 'failed' | 'stale'
  indexedAt?: string
  rootPath: string
}

// Mock data for Phase 1 development
const MOCK_PROJECTS: Project[] = []

interface Props {
  selected: Project | null
  onSelect: (p: Project) => void
}

export default function ProjectLibrary({ selected, onSelect }: Props) {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS)
  const [showAdd, setShowAdd] = useState(false)
  const [addMode, setAddMode] = useState<'local' | 'git'>('local')
  const [localPath, setLocalPath] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [gitBranch, setGitBranch] = useState('')

  // Empty state
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          {/* Placeholder illustration */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-50 flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-gray-800 mb-2">添加你的第一个项目</h2>
          <p className="text-sm text-gray-500 mb-8">
            Fieldguide 会分析项目源码并生成交互式知识图谱
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setAddMode('local'); setShowAdd(true) }}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              选择本地文件夹
            </button>
            <button
              onClick={() => { setAddMode('git'); setShowAdd(true) }}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              从 Git URL 克隆
            </button>
          </div>

          {/* Add dialog */}
          {showAdd && (
            <AddDialog
              mode={addMode}
              localPath={localPath}
              gitUrl={gitUrl}
              gitBranch={gitBranch}
              onLocalPathChange={setLocalPath}
              onGitUrlChange={setGitUrl}
              onGitBranchChange={setGitBranch}
              onClose={() => setShowAdd(false)}
              onAdd={(p) => {
                setProjects([...projects, p])
                setShowAdd(false)
                onSelect(p)
              }}
            />
          )}
        </div>
      </div>
    )
  }

  // Project list view
  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">项目库</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setAddMode('local'); setShowAdd(true) }}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            + 本地文件夹
          </button>
          <button
            onClick={() => { setAddMode('git'); setShowAdd(true) }}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            + Git URL
          </button>
        </div>
      </div>

      {/* Project cards */}
      <div className="space-y-3">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selected?.id === p.id
                ? 'border-blue-300 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{p.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                    {p.language}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="truncate max-w-[300px]" title={p.rootPath}>{p.rootPath}</span>
                  {p.indexedAt && <span>索引于 {p.indexedAt}</span>}
                  {p.nodeCount > 0 && <span>{p.nodeCount} 个节点</span>}
                </div>
              </div>
              <span className="text-gray-300 text-lg">→</span>
            </div>
          </button>
        ))}
      </div>

      {showAdd && (
        <AddDialog
          mode={addMode}
          localPath={localPath}
          gitUrl={gitUrl}
          gitBranch={gitBranch}
          onLocalPathChange={setLocalPath}
          onGitUrlChange={setGitUrl}
          onGitBranchChange={setGitBranch}
          onClose={() => setShowAdd(false)}
          onAdd={(p) => {
            setProjects([...projects, p])
            setShowAdd(false)
            onSelect(p)
          }}
        />
      )}
    </div>
  )
}

/* ──────────── Status Badge ──────────── */

function StatusBadge({ status }: { status: Project['status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: '待索引', cls: 'bg-gray-100 text-gray-500' },
    indexing: { label: '索引中…', cls: 'bg-yellow-100 text-yellow-700' },
    ready: { label: '就绪', cls: 'bg-green-100 text-green-700' },
    failed: { label: '失败', cls: 'bg-red-100 text-red-600' },
    stale: { label: '源码已更新', cls: 'bg-orange-100 text-orange-700' },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

/* ──────────── Add Dialog ──────────── */

function AddDialog({
  mode,
  localPath,
  gitUrl,
  gitBranch,
  onLocalPathChange,
  onGitUrlChange,
  onGitBranchChange,
  onClose,
  onAdd,
}: {
  mode: 'local' | 'git'
  localPath: string
  gitUrl: string
  gitBranch: string
  onLocalPathChange: (v: string) => void
  onGitUrlChange: (v: string) => void
  onGitBranchChange: (v: string) => void
  onClose: () => void
  onAdd: (p: Project) => void
}) {
  const handleAdd = () => {
    if (mode === 'local') {
      const name = localPath.split(/[/\\]/).pop() || localPath
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      onAdd({
        id: `local-${Date.now()}`,
        name,
        slug,
        language: '—',
        nodeCount: 0,
        status: 'pending',
        rootPath: localPath,
      })
    } else {
      const name = gitUrl.split('/').pop()?.replace('.git', '') || gitUrl
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      onAdd({
        id: `git-${Date.now()}`,
        name,
        slug,
        language: '—',
        nodeCount: 0,
        status: 'pending',
        rootPath: `{projectsRoot}/${slug}`,
      })
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] bg-white rounded-xl shadow-xl z-50 p-6">
        <h3 className="text-lg font-semibold mb-4">
          {mode === 'local' ? '选择本地文件夹' : '从 Git 克隆'}
        </h3>

        {mode === 'local' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">项目路径</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => onLocalPathChange(e.target.value)}
                  placeholder="D:\Projects\my-repo"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                  浏览…
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Fieldguide 不会复制源码，仅在项目目录下生成 <code className="bg-gray-100 px-1 rounded">.understand-anything/</code> 索引文件。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Git URL</label>
              <input
                type="text"
                value={gitUrl}
                onChange={(e) => onGitUrlChange(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">分支（可选）</label>
              <input
                type="text"
                value={gitBranch}
                onChange={(e) => onGitBranchChange(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleAdd}
            disabled={mode === 'local' ? !localPath.trim() : !gitUrl.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            添加项目
          </button>
        </div>
      </div>
    </>
  )
}
