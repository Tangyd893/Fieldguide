/**
 * Fieldguide App Shell — ui-spec v0.4, i18n enabled.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import ProjectLibrary from './views/ProjectLibrary/ProjectLibrary'
import FileTree from './views/CodeMap/FileTree'
import SplitPanel from './views/CodeMap/SplitPanel'
import GraphPanel from './views/CodeMap/GraphPanel'
import { type DashboardMessage, dashboardSelectNode } from './views/CodeMap/GraphPanel'
import CodeViewer from './views/CodeMap/CodeViewer'
import ChatPanel from './views/CodeMap/ChatPanel'
import TourPanel from './views/CodeMap/TourPanel'
import NodeSearchBar from './views/CodeMap/NodeSearchBar'
import OnboardingWizard from './views/OnboardingWizard'
import CommandPalette from './views/CommandPalette'
import SettingsPanel from './views/SettingsPanel'
import CostDialog from './views/CostDialog'
import TheoryView from './views/Theory/TheoryView'
import BridgeView from './views/Bridge/BridgeView'
import { useToast, ToastContainer, showToast } from './views/Toast'

export type Tab = 'library' | 'codemap' | 'theory' | 'bridge'

/** Apply theme to <html> element. Call on mount and after settings save. */
export function applyTheme(theme: string): void {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme
  } else {
    delete document.documentElement.dataset.theme
  }
}

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
  const { toasts, removeToast } = useToast()

  // Apply saved theme on mount
  useEffect(() => {
    window.fieldguide.configGet().then((r) => {
      if (r.ok && r.data) {
        const cfg = r.data as Record<string, unknown>
        const theme = cfg.theme as string | undefined
        applyTheme(theme || 'system')

        // Restore last project and tab
        const lastProjectId = cfg.lastProjectId as string | undefined
        const lastTab = cfg.lastTab as Tab | undefined
        if (lastTab) setActiveTab(lastTab)
        if (lastProjectId) {
          window.fieldguide.projectList().then((list) => {
            if (list.ok && list.data) {
              const found = list.data.find((p: Project) => p.id === lastProjectId)
              if (found) setSelectedProject(found)
            }
          })
        }
      }
    })
  }, [])

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

  // Persist last active tab
  useEffect(() => {
    window.fieldguide.configSet({ lastTab: activeTab } as never).catch(() => {})
  }, [activeTab])

  // Persist last selected project
  useEffect(() => {
    if (selectedProject) {
      window.fieldguide.configSet({ lastProjectId: selectedProject.id } as never).catch(() => {})
    }
  }, [selectedProject?.id])

  async function handleOnboardingComplete(locale: string, projectsRoot: string, navigateTo?: 'codemap' | 'library') {
    await window.fieldguide.configSet({ locale, projectsRoot, onboardingCompleted: true })
    i18n.changeLanguage(locale)
    setShowOnboarding(false)
    if (navigateTo === 'codemap') setActiveTab('codemap')
    else if (navigateTo === 'library') setActiveTab('library')
  }

  /** Called from OnboardingWizard Step 5: sets up project without closing wizard. Returns projectId. */
  async function handleOnboardingSetup(option: 'demo' | 'local', locale: string, projectsRoot: string): Promise<string | null> {
    await window.fieldguide.configSet({ locale, projectsRoot })
    i18n.changeLanguage(locale)

    switch (option) {
      case 'demo': {
        const demoUrl = 'https://github.com/fieldguide-app/fieldguide-demo'
        const result = await window.fieldguide.projectAddGit(demoUrl)
        if (result.ok && result.data) {
          const project = result.data as Project
          setSelectedProject(project)
          doIndex(project.id, project.name)
          return project.id
        } else {
          showToast('error', result.error?.message ?? 'Demo 克隆失败，请检查网络后重试')
          return null
        }
      }
      case 'local': {
        const folderResult = await window.fieldguide.openFolderDialog?.()
        if (folderResult?.ok && folderResult.data) {
          const result = await window.fieldguide.projectAddLocal(folderResult.data)
          if (result.ok && result.data) {
            const project = result.data as Project
            setSelectedProject(project)
            doIndex(project.id, project.name)
            return project.id
          }
        }
        return null
      }
    }
  }

  /** Legacy path: user picks 'skip' on Step 4 — directly complete onboarding. */
  async function handleOnboardingStart(option: 'demo' | 'local' | 'skip', locale: string, projectsRoot: string) {
    await window.fieldguide.configSet({ locale, projectsRoot, onboardingCompleted: true })
    i18n.changeLanguage(locale)
    setShowOnboarding(false)
  }

  async function handleReIndex(incremental = false) {
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

    doIndex(selectedProject.id, selectedProject.name, incremental)
  }

  async function doIndex(projectId: string, _projectName: string, incremental = false) {
    setShowCostDialog(false)
    setPendingIndex(null)
    setIndexing(true)
    setIndexError(null)
    setIndexProgress(incremental ? 'scan-changed' : 'scan')

    // Listen for progress events
    const unsub = window.fieldguide.onIndexProgress?.((data: unknown) => {
      const ev = data as { type: string; phase?: string; current?: number; total?: number; error?: string; nodeCount?: number }
      if (ev.type === 'phase') setIndexProgress(ev.phase ?? '')
      else if (ev.type === 'progress') setIndexProgress(`${ev.phase ?? ''} ${ev.current ?? 0}/${ev.total ?? 0}`)
      else if (ev.type === 'complete') {
        setIndexing(false)
        setIndexProgress('')
        showToast('success', `索引完成 — ${ev.nodeCount ?? '?'} 个节点`)
        setSelectedProject((prev) => prev ? { ...prev, status: 'ready', node_count: ev.nodeCount ?? prev.node_count } : null)
      } else if (ev.type === 'error') {
        setIndexError(ev.error ?? '索引失败')
        setIndexing(false)
        showToast('error', ev.error ?? '索引失败')
      }
    })

    try {
      const result = await window.fieldguide.projectIndex(projectId, incremental)
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
      { id: 'openFolder', label: `在资源管理器打开项目`, action: () => window.fieldguide.openInExplorer(selectedProject.id, '.') },
    ] : []),
    { id: 'settings', label: '打开设置', action: () => setShowSettings(true) },
    { id: 'toggleTheme', label: '切换主题 (亮/暗)', action: () => {
      const current = document.documentElement.dataset.theme
      const next = current === 'dark' ? 'light' : 'dark'
      applyTheme(next)
    }},
  ]

  // Handle messages from the Dashboard iframe
  function handleDashboardMessage(msg: DashboardMessage) {
    switch (msg.type) {
      case 'nodeSelected': {
        // Dashboard selected a node — sync to shell: open the file
        if (msg.nodeId && selectedProject) {
          window.fieldguide.graphGet(selectedProject.id).then(r => {
            if (r.ok && r.data) {
              const g = r.data as { nodes?: Array<{ id: string; filePath?: string }> }
              const node = (g.nodes || []).find(n => n.id === msg.nodeId)
              if (node?.filePath) {
                setActiveFilePath(node.filePath)
              }
            }
          })
        }
        break
      }
      case 'tourStepChanged':
        // Dashboard advanced tour — update TourPanel (it reads from graph, no direct state needed)
        break
    }
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
      <TopBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} onSettings={() => setShowSettings(true)} t={t} />

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
              onIndex={async (projectId) => {
                // For stale projects, do incremental; for pending/failed, do full
                const list = await window.fieldguide.projectList()
                const p = list.ok ? (list.data as Project[] | undefined)?.find(x => x.id === projectId) : undefined
                if (p) doIndex(p.id, p.name, p.status === 'stale')
              }}
              onFullReindex={async (projectId) => {
                const list = await window.fieldguide.projectList()
                const p = list.ok ? (list.data as Project[] | undefined)?.find(x => x.id === projectId) : undefined
                if (p) doIndex(p.id, p.name, false)
              }}
              t={t}
            />
          )}
          {activeTab === 'codemap' && (
            <div className="h-full flex flex-col">
              <NodeSearchBar projectId={selectedProject?.id ?? ''} onNodeSelect={(nodeId, filePath) => {
                if (filePath) setActiveFilePath(filePath)
              }} t={t} />
              <div className="flex-1 overflow-hidden">
                <CodeMapLayout
                  project={selectedProject}
                  activeFilePath={activeFilePath}
                  t={t}
                  onDashboardMessage={handleDashboardMessage}
                />
              </div>
            </div>
          )}
          {activeTab === 'theory' && <TheoryView t={t} projectId={selectedProject?.id} />}
          {activeTab === 'bridge' && (
            <BridgeView t={t} projectId={selectedProject?.id} />
          )}
        </main>
      </div>

      <StatusBar project={selectedProject} t={t} indexing={indexing} indexProgress={indexProgress} indexError={indexError} />

      {/* Onboarding overlay */}
      {showOnboarding && (
        <OnboardingWizard t={t} onComplete={handleOnboardingComplete} onStartOption={handleOnboardingStart} onSetupStart={handleOnboardingSetup} />
      )}

      {/* Command palette */}
      {showPalette && selectedProject && (
        <CommandPalette
          commands={commands}
          onClose={() => setShowPalette(false)}
          onFileSelect={(filePath) => {
            setActiveFilePath(filePath)
            setActiveTab('codemap')
            setFileTreeCollapsed(false)
          }}
          searchFiles={async (q: string) => {
            const r = await window.fieldguide.fileTree(selectedProject.id)
            if (!r.ok || !r.data) return []
            const results: Array<{ path: string; name: string }> = []
            const walk = (entries: unknown[], depth = 0) => {
              for (const e of entries) {
                const entry = e as Record<string, unknown>
                const name = entry.name as string
                const path = entry.path as string
                if (!entry.isDirectory && name.toLowerCase().includes(q.toLowerCase())) {
                  results.push({ path, name })
                }
                if (Array.isArray(entry.children) && depth < 5) walk(entry.children as unknown[], depth + 1)
              }
            }
            walk(r.data as unknown[])
            return results.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8)
          }}
          searchNodes={async (q: string) => {
            const r = await window.fieldguide.graphGet(selectedProject.id)
            if (!r.ok || !r.data) return []
            const g = r.data as { nodes?: Array<{ id: string; label?: string; type?: string; filePath?: string }> }
            const ql = q.toLowerCase()
            return (g.nodes || [])
              .filter(n => (n.label || n.id).toLowerCase().includes(ql))
              .slice(0, 8)
              .map(n => ({ id: n.id, label: n.label || n.id, type: n.type || 'unknown', filePath: n.filePath }))
          }}
          onNodeSelect={(nodeId: string) => {
            // Highlight node in Dashboard via postMessage
            dashboardSelectNode(nodeId)
            // Also open the node's file in the code viewer
            window.fieldguide.graphGet(selectedProject.id).then(r => {
              if (r.ok && r.data) {
                const g = r.data as { nodes?: Array<{ id: string; filePath?: string }> }
                const node = (g.nodes || []).find(n => n.id === nodeId)
                if (node?.filePath) {
                  setActiveFilePath(node.filePath)
                  setActiveTab('codemap')
                  setFileTreeCollapsed(false)
                }
              }
            })
          }}
        />
      )}
      {showPalette && !selectedProject && (
        <CommandPalette commands={commands} onClose={() => setShowPalette(false)} />
      )}

      {/* Settings */}
      {showSettings && (
        <SettingsPanel t={t} onClose={() => setShowSettings(false)} />
      )}

      {/* LLM Cost Dialog */}
      {showCostDialog && selectedProject && (
        <CostDialog
          t={t}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          onCancel={() => { setShowCostDialog(false); setPendingIndex(null) }}
          onContinue={() => {
            if (pendingIndex) {
              const p = selectedProject
              if (p) doIndex(p.id, p.name)
            }
          }}
          onSkipLLM={() => {
            // Skip LLM phases, do structural-only index
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
  onDashboardMessage,
}: {
  project: Project | null
  activeFilePath?: string
  t: (key: string) => string
  onDashboardMessage?: (msg: DashboardMessage) => void
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
      renderGraph={() => <GraphPanel t={t} projectRoot={project.root_path} projectId={project.id} onDashboardMessage={onDashboardMessage} />}
      renderCode={(path) => <CodeViewer projectId={project.id} filePath={path} t={t} />}
      renderChat={() => <ChatPanel projectId={project.id} projectName={project.name} t={t} />}
      renderTour={() => <TourPanel projectId={project.id} t={t} />}
      activeFilePath={activeFilePath}
      t={t}
    />
  )
}

function TopBar({
  tabs, activeTab, onTabChange, onSettings, t,
}: {
  tabs: { id: Tab; label: string; disabled?: boolean }[]
  activeTab: Tab
  onTabChange: (t: Tab) => void
  onSettings: () => void
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
      <button onClick={onSettings} className="p-1.5 text-gray-400 hover:text-gray-600 rounded ml-1" title={t('tooltip.settings')}>⚙</button>
    </header>
  )
}

function StatusBar({ project, t, indexing, indexProgress, indexError }: {
  project: Project | null
  t: (k: string, opts?: Record<string, unknown>) => string
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
