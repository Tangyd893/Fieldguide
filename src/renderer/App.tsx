/**
 * Fieldguide App Shell — ui-spec v0.4, i18n enabled.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import ProjectLibrary from './views/ProjectLibrary/ProjectLibrary'
import FileTree from './views/CodeMap/FileTree'
import SplitPanel from './views/CodeMap/SplitPanel'
import GraphPanel from './views/CodeMap/GraphPanel'
import CodeViewer from './views/CodeMap/CodeViewer'
import ChatPanel from './views/CodeMap/ChatPanel'
import TourPanel from './views/CodeMap/TourPanel'
import OnboardingWizard from './views/OnboardingWizard'
import CommandPalette from './views/CommandPalette'
import SettingsPanel from './views/SettingsPanel'
import CostDialog from './views/CostDialog'

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
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('library')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>()
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false)
  const [fileTreeWidth, setFileTreeWidth] = useState(260)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [indexProgress, setIndexProgress] = useState('')
  const [indexError, setIndexError] = useState<string | null>(null)
  const [showCostDialog, setShowCostDialog] = useState(false)
  const [pendingIndex, setPendingIndex] = useState<string | null>(null)

  // Check onboarding
  useEffect(() => {
    window.fieldguide.configGet().then((r) => {
      if (r.ok && r.data && !(r.data as Record<string, unknown>).onboardingCompleted) {
        setShowOnboarding(true)
      }
    })
  }, [])

  // Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Notify Dashboard of project switch
  useEffect(() => {
    if (selectedProject) {
      window.fieldguide.dashboardSetProject?.(selectedProject.root_path)
    } else {
      window.fieldguide.dashboardSetProject?.(null)
    }
  }, [selectedProject?.id])

  async function handleOnboardingComplete(locale: string, projectsRoot: string) {
    await window.fieldguide.configSet({ locale, projectsRoot, onboardingCompleted: true })
    i18n.changeLanguage(locale)
    setShowOnboarding(false)
  }

  async function handleReIndex() {
    if (!selectedProject) return

    // Check if LLM is configured — show cost dialog
    const llmStatus = await window.fieldguide.configGet?.()
    const cfg = (llmStatus?.data as Record<string, unknown>)
    const hasLLM = !!(cfg?.llm as Record<string, string>)?.apiKey

    if (hasLLM) {
      setPendingIndex(selectedProject.id)
      setShowCostDialog(true)
      return
    }

    doIndex(selectedProject.id, selectedProject.name)
  }

  async function doIndex(projectId: string, _projectName: string) {
    setShowCostDialog(false)
    setPendingIndex(null)
    setIndexing(true)
    setIndexError(null)
    setIndexProgress('scan')

    // Listen for progress events
    const unsub = window.fieldguide.onIndexProgress?.((data: unknown) => {
      const ev = data as { type: string; phase?: string; current?: number; total?: number; error?: string; nodeCount?: number }
      if (ev.type === 'phase') setIndexProgress(ev.phase ?? '')
      else if (ev.type === 'progress') setIndexProgress(`${ev.phase ?? ''} ${ev.current ?? 0}/${ev.total ?? 0}`)
      else if (ev.type === 'complete') {
        setIndexing(false)
        setIndexProgress('')
        setSelectedProject((prev) => prev ? { ...prev, status: 'ready', node_count: ev.nodeCount ?? prev.node_count } : null)
      } else if (ev.type === 'error') {
        setIndexError(ev.error ?? '索引失败')
        setIndexing(false)
      }
    })

    try {
      const result = await window.fieldguide.projectIndex(projectId)
      if (!result.ok) {
        setIndexError(result.error?.message ?? '索引失败')
        setIndexing(false)
      }
    } catch (err) {
      setIndexError(String(err))
      setIndexing(false)
    }
    unsub?.()
    // Refresh
    const list = await window.fieldguide.projectList()
    if (list.ok && list.data) {
      const updated = list.data.find((p: Project) => p.id === projectId) as Project | undefined
      if (updated) setSelectedProject(updated)
    }
  }

  // Command palette commands
  const commands = [
    { id: 'library', label: '项目库', shortcut: 'Tab', action: () => setActiveTab('library') },
    ...(selectedProject ? [
      { id: 'reindex', label: `重新索引: ${selectedProject.name}`, action: handleReIndex },
      { id: 'codemap', label: '代码地图', shortcut: 'Tab', action: () => setActiveTab('codemap') },
    ] : []),
    { id: 'settings', label: '打开设置', action: () => setShowSettings(true) },
    { id: 'toggleTheme', label: '切换主题', action: () => { /* placeholder */ } },
  ]

  const noProject = !selectedProject

  const tabs: { id: Tab; label: string; disabled?: boolean }[] = [
    { id: 'library', label: t('tabs.library') },
    { id: 'codemap', label: t('tabs.codemap'), disabled: noProject },
    { id: 'theory', label: t('tabs.theory') },
    { id: 'bridge', label: t('tabs.bridge'), disabled: noProject },
  ]

  return (
    <div className="flex flex-col h-screen bg-[var(--fg-bg)] text-[var(--fg-text-primary)]">
      <TopBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} t={t} />

      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'codemap' && !fileTreeCollapsed && (
          <>
            <div style={{ width: fileTreeWidth }} className="flex-shrink-0 border-r border-[var(--fg-border)]">
              <FileTree
                projectId={selectedProject?.id ?? ''}
                onFileClick={(p) => setActiveFilePath(p)}
                activeFilePath={activeFilePath}
                t={t}
              />
            </div>
            <div
              className="w-1 bg-[var(--fg-border)] hover:bg-blue-400 cursor-col-resize shrink-0 transition-colors"
              title={t('tooltip.collapseFileTree')}
              onMouseDown={(e) => {
                const startX = e.clientX
                const startW = fileTreeWidth
                const onMove = (ev: MouseEvent) => {
                  setFileTreeWidth(Math.max(160, Math.min(400, startW + ev.clientX - startX)))
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

        {activeTab === 'codemap' && fileTreeCollapsed && (
          <button
            onClick={() => setFileTreeCollapsed(false)}
            className="w-8 bg-[var(--fg-card)] border-r border-[var(--fg-border)] flex items-start justify-center pt-2 hover:bg-gray-100 transition-colors shrink-0"
            title={t('tooltip.expandFileTree')}
          >
            <span className="text-gray-400 text-xs">📁</span>
          </button>
        )}

        <main className="flex-1 overflow-hidden">
          {activeTab === 'library' && (
            <ProjectLibrary
              selected={selectedProject}
              onSelect={(p) => {
                setSelectedProject(p)
                if (p) setActiveTab('codemap')
              }}
              t={t}
            />
          )}
          {activeTab === 'codemap' && (
            <CodeMapLayout
              project={selectedProject}
              activeFilePath={activeFilePath}
              t={t}
            />
          )}
          {activeTab === 'theory' && (
            <PlaceholderView title={t('theory.title')} desc={t('theory.desc')} />
          )}
          {activeTab === 'bridge' && (
            <PlaceholderView title={t('bridge.title')} desc={t('bridge.desc')} />
          )}
        </main>
      </div>

      <StatusBar project={selectedProject} t={t} indexing={indexing} indexProgress={indexProgress} indexError={indexError} />

      {/* Onboarding overlay */}
      {showOnboarding && (
        <OnboardingWizard t={t} onComplete={handleOnboardingComplete} />
      )}

      {/* Command palette */}
      {showPalette && (
        <CommandPalette commands={commands} onClose={() => setShowPalette(false)} />
      )}

      {/* Settings */}
      {showSettings && (
        <SettingsPanel t={t} onClose={() => setShowSettings(false)} />
      )}

      {/* LLM Cost Dialog */}
      {showCostDialog && (
        <CostDialog
          t={t}
          onCancel={() => { setShowCostDialog(false); setPendingIndex(null) }}
          onContinue={() => {
            if (pendingIndex) {
              const p = selectedProject
              if (p) doIndex(p.id, p.name)
            }
          }}
          onSkipLLM={() => {
            // TODO: skip LLM phases, do structural-only index
            if (pendingIndex) {
              const p = selectedProject
              if (p) doIndex(p.id, p.name)
            }
          }}
        />
      )}
    </div>
  )
}

function CodeMapLayout({
  project,
  activeFilePath,
  t,
}: {
  project: Project | null
  activeFilePath?: string
  t: (key: string) => string
}) {
  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>{t('codeMap.noProject')}</p>
      </div>
    )
  }
  return (
    <SplitPanel
      renderGraph={() => <GraphPanel t={t} />}
      renderCode={(path) => <CodeViewer projectId={project.id} filePath={path} t={t} />}
      renderChat={() => <ChatPanel t={t} />}
      renderTour={() => <TourPanel projectId={project.id} t={t} />}
      activeFilePath={activeFilePath}
      t={t}
    />
  )
}

function TopBar({
  tabs, activeTab, onTabChange, t,
}: {
  tabs: { id: Tab; label: string; disabled?: boolean }[]
  activeTab: Tab
  onTabChange: (t: Tab) => void
  t: (k: string) => string
}) {
  return (
    <header className="h-12 flex items-center px-4 border-b border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0 select-none">
      <button onClick={() => onTabChange('library')} className="font-bold text-lg mr-8 hover:opacity-80">
        {t('app.name')}
      </button>
      <nav className="flex gap-0.5 h-full items-stretch">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            title={tab.disabled ? t('tooltip.addProjectFirst') : undefined}
            className={`relative px-3 text-sm font-medium transition-colors ${
              tab.disabled ? 'text-gray-300 cursor-not-allowed'
                : activeTab === tab.id ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded" />}
          </button>
        ))}
      </nav>
      <div className="flex-1" />
      <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title={t('tooltip.search')}>🔍</button>
      <button onClick={() => setShowSettings(true)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded ml-1" title={t('tooltip.settings')}>⚙</button>
    </header>
  )
}

function StatusBar({ project, t, indexing, indexProgress, indexError }: {
  project: Project | null
  t: (k: string) => string
  indexing?: boolean
  indexProgress?: string
  indexError?: string | null
}) {
  return (
    <footer className="h-6 flex items-center px-4 border-t border-[var(--fg-border)] bg-[var(--fg-card)] text-xs text-gray-400 shrink-0 select-none gap-3">
      {indexing ? (
        <span className="text-yellow-600">⏳ 索引中… {indexProgress}</span>
      ) : indexError ? (
        <span className="text-red-500">❌ {indexError}</span>
      ) : (
        <span>{project ? project.status : t('status.ready')}</span>
      )}
      {project?.node_count ? <span>· {t('status.nodes', { count: project.node_count })}</span> : null}
      {project ? <span>· {project.name}</span> : null}
      <span className="flex-1" />
      <span>{t('app.name')} {t('app.version')}</span>
    </footer>
  )
}

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
