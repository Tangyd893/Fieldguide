/**
 * Fieldguide App Shell — ui-spec v0.4, i18n enabled.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ProjectLibrary from './views/ProjectLibrary/ProjectLibrary'
import FileTree from './views/CodeMap/FileTree'
import SplitPanel from './views/CodeMap/SplitPanel'
import GraphPanel from './views/CodeMap/GraphPanel'
import CodeViewer from './views/CodeMap/CodeViewer'
import ChatPanel from './views/CodeMap/ChatPanel'
import OnboardingWizard from './views/OnboardingWizard'

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

  // Check onboarding status on mount
  useEffect(() => {
    window.fieldguide.configGet().then((r) => {
      if (r.ok && r.data && !(r.data as Record<string, unknown>).onboardingCompleted) {
        setShowOnboarding(true)
      }
    })
  }, [])

  async function handleOnboardingComplete(locale: string, projectsRoot: string) {
    await window.fieldguide.configSet({ locale, projectsRoot, onboardingCompleted: true })
    i18n.changeLanguage(locale)
    setShowOnboarding(false)
  }

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

      <StatusBar project={selectedProject} t={t} />

      {/* Onboarding overlay */}
      {showOnboarding && (
        <OnboardingWizard t={t} onComplete={handleOnboardingComplete} />
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
      <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded ml-1" title={t('tooltip.settings')}>⚙</button>
    </header>
  )
}

function StatusBar({ project, t }: { project: Project | null; t: (k: string) => string }) {
  return (
    <footer className="h-6 flex items-center px-4 border-t border-[var(--fg-border)] bg-[var(--fg-card)] text-xs text-gray-400 shrink-0 select-none gap-3">
      <span>{project ? project.status : t('status.ready')}</span>
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
