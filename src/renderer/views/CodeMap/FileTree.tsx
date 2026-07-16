import { useState, useEffect } from 'react'
import { FileText, Clipboard, FolderOpen } from 'lucide-react'
import FileIcon, { TreeChevron } from '../../components/icons/FileIcon'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface FileEntry { name: string; path: string; isDirectory: boolean; size: number; children?: FileEntry[] }

interface Props {
  projectId: string
  onFileClick: (filePath: string) => void
  activeFilePath?: string
  t: (key: string, opts?: Record<string, unknown>) => string
}

const AUTO_EXPAND_DIRS = new Set(['cmd', 'internal', 'pkg', 'api', 'services', 'backend-api-auth'])

function shouldAutoExpand(name: string, depth: number): boolean {
  return depth < 1 || (depth <= 2 && AUTO_EXPAND_DIRS.has(name))
}

export default function FileTree({ projectId, onFileClick, activeFilePath, t }: Props) {
  const [tree, setTree] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => { loadTree() }, [projectId])

  async function loadTree() {
    setLoading(true)
    setError(null)
    try {
      const result = await window.fieldguide.fileTree(projectId)
      if (result.ok && result.data) {
        setTree(result.data as FileEntry[])
      } else {
        setTree([])
        setError(result.error?.message ?? t('fileTree.loadError'))
      }
    } catch (err) {
      setTree([])
      setError(err instanceof Error ? err.message : t('fileTree.loadError'))
    } finally {
      setLoading(false)
    }
  }

  function filterTree(entries: FileEntry[], query: string): FileEntry[] {
    if (!query) return entries
    const lower = query.toLowerCase()
    return entries.filter(e => e.name.toLowerCase().includes(lower) || (e.children && filterTree(e.children, query).length > 0))
      .map(e => e.children ? { ...e, children: filterTree(e.children, query) } : e)
  }

  const filtered = filterTree(tree, filter)

  return (
    <div className="h-full flex flex-col bg-[var(--fg-chrome-bg,var(--fg-card))]" data-fg-surface data-fg-chrome>
      <div className="px-2 py-1.5 border-b border-[var(--fg-border)]">
        <Input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder={t('codeMap.fileTreeSearch')}
          className="h-8 text-xs"
        />
      </div>
      <ScrollArea className="flex-1">
        <div className="text-sm py-1">
          {loading ? <div className="p-4 text-[var(--fg-text-tertiary)] text-xs">{t('codeMap.loading')}</div>
            : error ? <div className="p-4 text-[var(--fg-status-error)] text-xs">{error}</div>
              : filtered.length === 0 ? <div className="p-4 text-[var(--fg-text-tertiary)] text-xs">{t('codeMap.noFiles')}</div>
                : <TreeNodeList entries={filtered} depth={0} onFileClick={onFileClick} activeFilePath={activeFilePath} projectId={projectId} t={t} />}
        </div>
      </ScrollArea>
    </div>
  )
}

function TreeNodeList({ entries, depth, onFileClick, activeFilePath, projectId, t }: {
  entries: FileEntry[]; depth: number; onFileClick: (p: string) => void; activeFilePath?: string; projectId: string
  t: (key: string) => string
}) {
  return <>{entries.map(e => <TreeNode key={e.path} entry={e} depth={depth} onFileClick={onFileClick} activeFilePath={activeFilePath} projectId={projectId} t={t} />)}</>
}

function TreeNode({ entry, depth, onFileClick, activeFilePath, projectId, t }: {
  entry: FileEntry; depth: number; onFileClick: (p: string) => void; activeFilePath?: string; projectId: string
  t: (key: string) => string
}) {
  const [expanded, setExpanded] = useState(() => shouldAutoExpand(entry.name, depth))
  const hasChildren = entry.isDirectory && entry.children && entry.children.length > 0
  const isActive = entry.path === activeFilePath
  const pl = 8 + depth * 16

  async function openInExplorer() {
    await window.fieldguide.openInExplorer?.(projectId, entry.path)
  }

  function copyPath() {
    navigator.clipboard.writeText(entry.path).catch(() => {})
  }

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={() => entry.isDirectory ? setExpanded(!expanded) : onFileClick(entry.path)}
            className={`flex items-center gap-1 px-1 py-0.5 cursor-pointer select-none text-[13px] leading-5 transition-colors duration-150 ${
              isActive ? 'bg-[var(--fg-tree-selected)] text-[var(--fg-accent-text)]' : 'hover:bg-[var(--fg-tree-hover)] text-[var(--fg-text-primary)]'
            }`}
            style={{ paddingLeft: pl }}
            title={entry.path}
          >
            {entry.isDirectory ? (
              <TreeChevron expanded={expanded} />
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}
            <span className="flex-shrink-0 flex items-center">
              <FileIcon name={entry.name} isDirectory={entry.isDirectory} expanded={expanded} />
            </span>
            <span className="truncate">{entry.name}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {!entry.isDirectory && (
            <ContextMenuItem onSelect={() => onFileClick(entry.path)}>
              <FileText size={12} /> {t('fileTree.openFile')}
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={copyPath}>
            <Clipboard size={12} /> {t('fileTree.copyPath')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={openInExplorer}>
            <FolderOpen size={12} /> {t('fileTree.revealInExplorer')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {hasChildren && expanded && (
        <TreeNodeList entries={entry.children!} depth={depth + 1} onFileClick={onFileClick} activeFilePath={activeFilePath} projectId={projectId} t={t} />
      )}
    </div>
  )
}
