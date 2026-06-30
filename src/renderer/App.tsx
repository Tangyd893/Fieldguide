/**
 * Fieldguide App Shell — ui-spec.md §2.2 三栏布局
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  [Logo]  项目库│代码地图│理论│桥接          🔍  ⚙        │ 顶栏 48px
 * ├────────────┬──────────────────────────────┬──────────────┤
 * │  左栏 240  │     中央 (UA Dashboard)       │  右栏 320    │
 * │  Tour/操作 │                              │  Phase 1 隐藏 │
 * ├────────────┴──────────────────────────────┴──────────────┤
 * │  状态栏: 索引状态 · 节点数 · 当前项目                      │ 24px
 * └──────────────────────────────────────────────────────────┘
 */
import { useState } from 'react'
import ProjectLibrary from './views/ProjectLibrary/ProjectLibrary'

export type Tab = 'library' | 'codemap' | 'theory' | 'bridge'

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

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('library')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(true) // Phase 1: hidden

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

      {/* ── Body: 左 + 中 + 右 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左栏 240px — 可收窄 */}
        {!leftCollapsed && activeTab === 'codemap' && (
          <LeftPanel
            project={selectedProject}
            onCollapse={() => setLeftCollapsed(true)}
          />
        )}

        {/* 收窄后的展开按钮 */}
        {leftCollapsed && activeTab === 'codemap' && (
          <button
            onClick={() => setLeftCollapsed(false)}
            className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize flex items-center justify-center group"
            title="展开左栏"
          >
            <span className="text-gray-400 group-hover:text-white text-xs">▶</span>
          </button>
        )}

        {/* 中央 flex-1 */}
        <main className="flex-1 overflow-auto">
          {activeTab === 'library' && (
            <ProjectLibrary
              selected={selectedProject}
              onSelect={(p) => {
                setSelectedProject(p)
                if (p) setActiveTab('codemap')
              }}
            />
          )}
          {activeTab === 'codemap' && <CodeMapView project={selectedProject} />}
          {activeTab === 'theory' && <PlaceholderView title="理论学习" desc="arXiv / PDF / RAG（Phase 3）" />}
          {activeTab === 'bridge' && <PlaceholderView title="概念桥接" desc="论文 ↔ 代码节点（Phase 3）" />}
        </main>

        {/* 右栏 320px — Phase 1 折叠 */}
        {!rightCollapsed && (
          <>
            <div
              className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize"
              onClick={() => setRightCollapsed(true)}
              title="折叠右栏"
            />
            <RightPanel />
          </>
        )}
      </div>

      {/* ── Status Bar 24px ── */}
      <StatusBar project={selectedProject} />
    </div>
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
    <header className="h-12 flex items-center px-4 border-b border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0">
      {/* Logo */}
      <button
        onClick={() => onTabChange('library')}
        className="font-bold text-lg mr-8 hover:opacity-80 transition-opacity"
      >
        Fieldguide
      </button>

      {/* Nav Tabs */}
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

      {/* Right actions */}
      <button
        className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
        title="搜索 (Ctrl+K)"
      >
        🔍
      </button>
      <button
        className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors ml-1"
        title="设置"
      >
        ⚙
      </button>
    </header>
  )
}

/* ──────────── Left Panel (240px) ──────────── */

function LeftPanel({
  project,
  onCollapse,
}: {
  project: Project | null
  onCollapse: () => void
}) {
  return (
    <aside className="w-60 border-r border-[var(--fg-border)] bg-[var(--fg-card)] flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fg-border)]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">导览</span>
        <button
          onClick={onCollapse}
          className="text-gray-400 hover:text-gray-600 text-xs"
          title="收窄左栏"
        >
          ◀
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {project ? (
          <>
            {/* Tour 快捷列表 — Phase 2 */}
            <div className="text-xs text-gray-400 mb-2">Tour 列表</div>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-300">
              Phase 2 实现
            </div>

            {/* 索引操作 */}
            <div className="mt-4 space-y-2">
              <button className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                重新索引
              </button>
              <button className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                增量更新
              </button>
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-400 text-center mt-4">
            请先在项目库中选择项目
          </div>
        )}
      </div>
    </aside>
  )
}

/* ──────────── Right Panel (320px, Phase 1 hidden) ──────────── */

function RightPanel() {
  return (
    <aside className="w-80 border-l border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0 p-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">助手</div>
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-300">
        Phase 2 开放
      </div>
    </aside>
  )
}

/* ──────────── Status Bar 24px ──────────── */

function StatusBar({ project }: { project: Project | null }) {
  return (
    <footer className="h-6 flex items-center px-4 border-t border-[var(--fg-border)] bg-[var(--fg-card)] text-xs text-gray-400 shrink-0 select-none gap-4">
      <span>{project ? `状态: ${project.status}` : '就绪'}</span>
      {project && <span>·</span>}
      {project && <span>节点: {project.nodeCount || '—'}</span>}
      <span className="flex-1" />
      <span>Fieldguide v0.1.0</span>
    </footer>
  )
}

/* ──────────── Code Map View ──────────── */

function CodeMapView({ project }: { project: Project | null }) {
  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <p className="text-lg mb-2">请先在项目库中添加项目</p>
          <p className="text-sm">切换到「项目库」Tab 开始</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center text-gray-400 max-w-lg">
        <p className="text-lg font-medium mb-2">UA Dashboard 嵌入区域</p>
        <p className="text-sm mb-4">Phase 1.7 — 将在此嵌入 Understand-Anything Dashboard</p>
        <div className="text-xs text-gray-300 bg-gray-100 rounded p-2 font-mono">
          {project.rootPath}/.understand-anything/
        </div>
      </div>
    </div>
  )
}

/* ──────────── Placeholder View ──────────── */

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
