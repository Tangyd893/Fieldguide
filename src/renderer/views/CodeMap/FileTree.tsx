import { useState, useEffect, useRef } from 'react'

interface FileEntry { name: string; path: string; isDirectory: boolean; size: number; children?: FileEntry[] }

interface Props {
  projectId: string
  onFileClick: (filePath: string) => void
  activeFilePath?: string
  t: (key: string, opts?: Record<string, unknown>) => string
}

export default function FileTree({ projectId, onFileClick, activeFilePath, t }: Props) {
  const [tree, setTree] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => { loadTree() }, [projectId])

  async function loadTree() {
    setLoading(true)
    try {
      const result = await window.fieldguide.fileTree(projectId)
      if (result.ok && result.data) setTree(result.data as FileEntry[])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function filterTree(entries: FileEntry[], query: string): FileEntry[] {
    if (!query) return entries
    const lower = query.toLowerCase()
    return entries.filter(e => e.name.toLowerCase().includes(lower) || (e.children && filterTree(e.children, query).length > 0))
      .map(e => e.children ? { ...e, children: filterTree(e.children, query) } : e)
  }

  const filtered = filterTree(tree, filter)

  return (
    <div className="h-full flex flex-col bg-[var(--fg-card)]">
      <div className="px-2 py-1.5 border-b border-[var(--fg-border)]">
        <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder={t('codeMap.fileTreeSearch')}
          className="w-full px-2 py-1 text-xs border border-[var(--fg-border)] rounded bg-[var(--fg-bg)] text-[var(--fg-text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-400" />
      </div>
      <div className="flex-1 overflow-auto text-sm">
        {loading ? <div className="p-4 text-gray-400 text-xs">{t('codeMap.loading')}</div>
          : filtered.length === 0 ? <div className="p-4 text-gray-400 text-xs">{t('codeMap.noFiles')}</div>
            : <TreeNodeList entries={filtered} depth={0} onFileClick={onFileClick} activeFilePath={activeFilePath} projectId={projectId} />}
      </div>
    </div>
  )
}

function TreeNodeList({ entries, depth, onFileClick, activeFilePath, projectId }: {
  entries: FileEntry[]; depth: number; onFileClick: (p: string) => void; activeFilePath?: string; projectId: string
}) {
  return <>{entries.map(e => <TreeNode key={e.path} entry={e} depth={depth} onFileClick={onFileClick} activeFilePath={activeFilePath} projectId={projectId} />)}</>
}

function TreeNode({ entry, depth, onFileClick, activeFilePath, projectId }: {
  entry: FileEntry; depth: number; onFileClick: (p: string) => void; activeFilePath?: string; projectId: string
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const hasChildren = entry.isDirectory && entry.children && entry.children.length > 0
  const isActive = entry.path === activeFilePath
  const pl = 8 + depth * 16
  const fileIcon = entry.isDirectory ? '📁' : getFileIcon(entry.name)

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  async function openInExplorer() {
    await window.fieldguide.openInExplorer?.(projectId, entry.path)
    setContextMenu(null)
  }

  function copyPath() {
    navigator.clipboard.writeText(entry.path).catch(() => {})
    setContextMenu(null)
  }

  return (
    <div>
      <div onClick={() => entry.isDirectory ? setExpanded(!expanded) : onFileClick(entry.path)}
        onContextMenu={handleContextMenu}
        className={`flex items-center gap-1 px-1 py-0.5 cursor-pointer select-none text-[13px] leading-5 ${isActive ? 'bg-[#E4E6F1] text-blue-700' : 'hover:bg-gray-100 text-[var(--fg-text-primary)]'}`}
        style={{ paddingLeft: pl }} title={entry.path}>
        {entry.isDirectory && <span className="w-3.5 text-center text-gray-400 text-xs flex-shrink-0">{expanded ? '▾' : '▸'}</span>}
        {!entry.isDirectory && <span className="w-3.5 flex-shrink-0" />}
        <span className="flex-shrink-0 text-xs">{fileIcon}</span>
        <span className="truncate">{entry.name}</span>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 min-w-[180px] text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {!entry.isDirectory && (
            <button onClick={() => { onFileClick(entry.path); setContextMenu(null) }}
              className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-gray-700 text-xs">📖 打开文件</button>
          )}
          <button onClick={copyPath}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-gray-700 text-xs">📋 复制路径</button>
          <button onClick={openInExplorer}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-gray-700 text-xs">📁 在资源管理器打开</button>
        </div>
      )}

      {hasChildren && expanded && <TreeNodeList entries={entry.children!} depth={depth + 1} onFileClick={onFileClick} activeFilePath={activeFilePath} projectId={projectId} />}
    </div>
  )
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    go:'🔵',ts:'🔷',tsx:'⚛️',js:'🟨',jsx:'⚛️',py:'🐍',rs:'🦀',java:'☕',rb:'💎',php:'🐘',
    css:'🎨',html:'🌐',json:'📋',yaml:'📋',yml:'📋',toml:'⚙️',md:'📝',sql:'🗄️',graphql:'◈',sh:'💻',
  }
  if (name === 'Dockerfile') return '🐳'
  if (name === 'Makefile') return '🔧'
  if (name === 'go.mod') return '📦'
  if (name === 'go.sum') return '🔒'
  return map[ext] || '📄'
}
