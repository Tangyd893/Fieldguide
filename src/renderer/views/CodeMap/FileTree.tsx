/**
 * FileTree — VSCode-style project file explorer.
 * ui-spec v0.4 §3.2.1
 */
import { useState, useEffect } from 'react'

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  children?: FileEntry[]
}

interface Props {
  projectId: string
  onFileClick: (filePath: string) => void
  activeFilePath?: string
}

export default function FileTree({ projectId, onFileClick, activeFilePath }: Props) {
  const [tree, setTree] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    loadTree()
  }, [projectId])

  async function loadTree() {
    setLoading(true)
    try {
      const result = await window.fieldguide.fileTree(projectId)
      if (result.ok && result.data) {
        setTree(result.data as FileEntry[])
      }
    } catch (err) {
      console.error('FileTree load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  function filterTree(entries: FileEntry[], query: string): FileEntry[] {
    if (!query) return entries
    const lower = query.toLowerCase()
    return entries
      .filter((e) => {
        if (e.name.toLowerCase().includes(lower)) return true
        if (e.children) return filterTree(e.children, query).length > 0
        return false
      })
      .map((e) => (e.children ? { ...e, children: filterTree(e.children, query) } : e))
  }

  const filtered = filterTree(tree, filter)

  return (
    <div className="h-full flex flex-col bg-[var(--fg-card)]">
      {/* Filter input */}
      <div className="px-2 py-1.5 border-b border-[var(--fg-border)]">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="搜索文件…"
          className="w-full px-2 py-1 text-xs border border-[var(--fg-border)] rounded bg-[var(--fg-bg)] text-[var(--fg-text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-auto text-sm">
        {loading ? (
          <div className="p-4 text-gray-400 text-xs">加载中…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-gray-400 text-xs">无匹配文件</div>
        ) : (
          <TreeNodeList
            entries={filtered}
            depth={0}
            onFileClick={onFileClick}
            activeFilePath={activeFilePath}
          />
        )}
      </div>
    </div>
  )
}

/* ──────────── Recursive Tree Nodes ──────────── */

function TreeNodeList({
  entries,
  depth,
  onFileClick,
  activeFilePath,
}: {
  entries: FileEntry[]
  depth: number
  onFileClick: (p: string) => void
  activeFilePath?: string
}) {
  return (
    <>
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={depth}
          onFileClick={onFileClick}
          activeFilePath={activeFilePath}
        />
      ))}
    </>
  )
}

function TreeNode({
  entry,
  depth,
  onFileClick,
  activeFilePath,
}: {
  entry: FileEntry
  depth: number
  onFileClick: (p: string) => void
  activeFilePath?: string
}) {
  const [expanded, setExpanded] = useState(depth < 1) // auto-expand top 2 levels
  const hasChildren = entry.isDirectory && entry.children && entry.children.length > 0
  const isActive = entry.path === activeFilePath

  const paddingLeft = 8 + depth * 16

  // Language → icon map
  const fileIcon = entry.isDirectory ? '📁' : getFileIcon(entry.name)

  return (
    <div>
      <div
        onClick={() => {
          if (entry.isDirectory) {
            setExpanded(!expanded)
          } else {
            onFileClick(entry.path)
          }
        }}
        className={`flex items-center gap-1 px-1 py-0.5 cursor-pointer select-none text-[13px] leading-5
          ${isActive ? 'bg-[#E4E6F1] text-blue-700' : 'hover:bg-gray-100 text-[var(--fg-text-primary)]'}
        `}
        style={{ paddingLeft }}
        title={entry.path}
      >
        {entry.isDirectory && (
          <span className="w-3.5 text-center text-gray-400 text-xs flex-shrink-0">
            {expanded ? '▾' : '▸'}
          </span>
        )}
        {!entry.isDirectory && <span className="w-3.5 flex-shrink-0" />}
        <span className="flex-shrink-0 text-xs">{fileIcon}</span>
        <span className="truncate">{entry.name}</span>
      </div>
      {hasChildren && expanded && (
        <TreeNodeList
          entries={entry.children!}
          depth={depth + 1}
          onFileClick={onFileClick}
          activeFilePath={activeFilePath}
        />
      )}
    </div>
  )
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    go: '🔵', ts: '🔷', tsx: '⚛️', js: '🟨', jsx: '⚛️',
    py: '🐍', rs: '🦀', java: '☕', rb: '💎', php: '🐘',
    css: '🎨', html: '🌐', json: '📋', yaml: '📋', yml: '📋',
    toml: '⚙️', md: '📝', sql: '🗄️', graphql: '◈',
    sh: '💻', dockerfile: '🐳', mod: '📦', sum: '🔒',
  }
  if (name === 'Dockerfile') return '🐳'
  if (name === 'Makefile') return '🔧'
  if (name === 'go.mod') return '📦'
  if (name === 'go.sum') return '🔒'
  return map[ext] || '📄'
}
