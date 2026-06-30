/**
 * Fieldguide App Shell — ui-spec v0.4
 *
 * VSCode/Obsidian 风格布局：
 * ┌──────────────────────────────────────────────────────────────┐
 * │  [Logo]  项目库│代码地图│理论│桥接              🔍  ⚙       │ 顶栏 48px
 * ├────────────┬─────────────────────────────────────────────────┤
 * │  文件树     │  右侧面板区（可拖拽分隔 1~2 个面板）              │
 * │  260px     │  ┌─────────────────┬───────────────────────────┐│
 * │            │  │ 图谱 / 代码 /    │  图谱 / 代码 / 问答        ││
 * │            │  │ 问答             │                           ││
 * │            │  └─────────────────┴───────────────────────────┘│
 * ├────────────┴─────────────────────────────────────────────────┤
 * │  状态栏：就绪 · 13 节点 · tiny-go                               │ 24px
 * └──────────────────────────────────────────────────────────────┘
 */
import { useState, useEffect } from 'react'
import ProjectLibrary from './views/ProjectLibrary/ProjectLibrary'
import FileTree from './views/CodeMap/FileTree'
import SplitPanel from './views/CodeMap/SplitPanel'
import GraphPanel from './views/CodeMap/GraphPanel'
import CodeViewer from './views/CodeMap/CodeViewer'
import ChatPanel from './views/CodeMap/ChatPanel'

export type Tab = 'library' | 'codemap' | 'theory' | 'bridge'

interface Project {
  id: string
  name: string
  slug: string
  source_type: string
  source_uri: string
  root_path: string
  status: 'pending' | 'indexing' | 'ready' | 'failed' | 'stale'
  language: string
  node_count: number
  created_at: string
  indexed_at: string | null
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('library')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>()
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false)
  const [fileTreeWidth, setFileTreeWidth] = useState(260)

  const noProject = !selectedProject

  const tabs: { id: Tab; label: string; disabled?: boolean; tooltip?: string }[] = [
    { id: 'library', label: '项目库' },
    { id: 'codemap', label: '代码地图', disabled: noProject, tooltip: noProject ? '请先添加项目' : undefined },
    { id: 'theory', label: '理论' },
    { id: 'bridge', label: '桥接', disabled: noProject, tooltip: noProject ? '请先添加项目' : undefined },
  ]

  return (
    <div className="flex flex-col h-screen bg-[var(--fg-bg)] text-[var(--fg-text-primary)]">
      {/* ── Top Bar 48px ── */}
      <TopBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* ── Body: 文件树 + 面板区 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* 文件树 — 仅在代码地图 Tab 显示 */}
        {activeTab === 'codemap' && !fileTreeCollapsed && (
          <>
            <div style={{ width: fileTreeWidth }} className="flex-shrink-0 border-r border-[var(--fg-border)]">
              <FileTree
                projectId={selectedProject?.id ?? ''}
                onFileClick={(p) => setActiveFilePath(p)}
                activeFilePath={activeFilePath}
              />
            </div>
            {/* File tree resize handle */}
            <div
              className="w-1 bg-[var(--fg-border)] hover:bg-blue-400 cursor-col-resize shrink-0 transition-colors"
              onMouseDown={(e) => {
                const startX = e.clientX
                const startW = fileTreeWidth
                const onMove = (ev: MouseEvent) => {
                  const w = Math.max(160, Math.min(400, startW + ev.clientX - startX))
                  setFileTreeWidth(w)
                }
                const onUp = () => {
                  document.removeEventListener('mousemove', onMove)
                  document.removeEventListener('mouseup', onUp)
                  document.body.style.cursor = ''
                }
                document.body.style.cursor = 'col-resize'
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
              }}
            />
          </>
        )}

        {/* 文件树折叠后的小条 */}
        {activeTab === 'codemap' && fileTreeCollapsed && (
          <button
            onClick={() => setFileTreeCollapsed(false)}
            className="w-8 bg-[var(--fg-card)] border-r border-[var(--fg-border)] flex items-start justify-center pt-2 hover:bg-gray-100 transition-colors shrink-0"
            title="展开文件树"
          >
            <span className="text-gray-400 text-xs">📁</span>
          </button>
        )}

        {/* 主内容区 */}
        <main className="flex-1 overflow-hidden">
          {activeTab === 'library' && (
            <ProjectLibrary
              selected={selectedProject}
              onSelect={(p) => {
                setSelectedProject(p)
                if (p) setActiveTab('codemap')
              }}
            />
          )}
          {activeTab === 'codemap' && (
            <CodeMapLayout
              project={selectedProject}
              activeFilePath={activeFilePath}
              onToggleFileTree={() => setFileTreeCollapsed(!fileTreeCollapsed)}
              fileTreeCollapsed={fileTreeCollapsed}
            />
          )}
          {activeTab === 'theory' && <PlaceholderView title="理论学习" desc="arXiv / PDF / RAG（Phase 3）" />}
          {activeTab === 'bridge' && <PlaceholderView title="概念桥接" desc="论文 ↔ 代码节点（Phase 3）" />}
        </main>
      </div>

      {/* ── Status Bar 24px ── */}
      <StatusBar project={selectedProject} />
    </div>
  )
}

/* ──────────── CodeMap Layout ──────────── */

function CodeMapLayout({
  project,
  activeFilePath,
  onToggleFileTree,
  fileTreeCollapsed,
}: {
  project: Project | null
  activeFilePath?: string
  onToggleFileTree: () => void
  fileTreeCollapsed: boolean
}) {
  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>请先在项目库中添加项目</p>
      </div>
    )
  }

  return (
    <SplitPanel
      renderGraph={() => <GraphPanel />}
      renderCode={(path) => <CodeViewer projectId={project.id} filePath={path} />}
      renderChat={() => <ChatPanel />}
      activeFilePath={activeFilePath}
    />
  )
}

/* ──────────── Top Bar ──────────── */

function TopBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: { id: Tab; label: string; disabled?: boolean; tooltip?: string }[]
  activeTab: Tab
  onTabChange: (t: Tab) => void
}) {
  return (
    <header className="h-12 flex items-center px-4 border-b border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0 select-none">
      <button
        onClick={() => onTabChange('library')}
        className="font-bold text-lg mr-8 hover:opacity-80 transition-opacity"
      >
        Fieldguide
      </button>

      <nav className="flex gap-0.5 h-full items-stretch">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => !t.disabled && onTabChange(t.id)}
            disabled={t.disabled}
            title={t.tooltip}
            className={`relative px-3 text-sm font-medium transition-colors ${
              t.disabled
                ? 'text-gray-300 cursor-not-allowed'
                : activeTab === t.id
                  ? 'text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded" />
            )}
          </button>
        ))}
      </nav>

      <div className="flex-1" />
      <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title="搜索 (Ctrl+K)">🔍</button>
      <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded ml-1" title="设置">⚙</button>
    </header>
  )
}

/* ──────────── Status Bar ──────────── */

function StatusBar({ project }: { project: Project | null }) {
  return (
    <footer className="h-6 flex items-center px-4 border-t border-[var(--fg-border)] bg-[var(--fg-card)] text-xs text-gray-400 shrink-0 select-none gap-3">
      <span>{project ? project.status : '就绪'}</span>
      {project?.node_count ? <span>· {project.node_count} 节点</span> : null}
      {project ? <span>· {project.name}</span> : null}
      <span className="flex-1" />
      <span>Fieldguide v0.1.0</span>
    </footer>
  )
}

/* ──────────── Placeholder ──────────── */

function PlaceholderView({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center text-gray-300">
        <p className="text-lg mb-2">{title}</p>
        <p className="text-sm">{desc}</p>
      </div>
    </div>
  )
}
