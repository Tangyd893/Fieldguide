/**
 * Fieldguide App Shell — ui-spec v0.4, i18n enabled.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Settings as SettingsIcon, Folder } from 'lucide-react'
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
import AboutDialog from './views/AboutDialog'
import TheoryView from './views/Theory/TheoryView'
import BridgeView from './views/Bridge/BridgeView'
import { useToast, ToastContainer, showToast } from './views/Toast'
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout'
import { useIndexProgress, progressPercent } from './hooks/useIndexProgress'
import { useDashboardThemeSync } from './hooks/useDashboardThemeSync'
import { syncDashboardTheme } from './lib/dashboard-theme'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type Tab = 'library' | 'codemap' | 'theory' | 'bridge'

/** Apply theme and preset to <html> element. Call on mount and after settings save. */
export function applyTheme(theme: string, themePreset?: string): void {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme
  } else {
    delete document.documentElement.dataset.theme
  }
  if (themePreset && themePreset !== 'none') {
    document.documentElement.dataset.themePreset = themePreset
  } else {
    delete document.documentElement.dataset.themePreset
  }
}

/** Apply zoom level to the root element. Clamped to 50–200. */
export function applyZoom(zoom: number): void {
  const clamped = Math.max(50, Math.min(200, zoom))
  document.documentElement.style.fontSize = `${clamped / 100 * 14}px`
}

/** Apply font families via CSS custom properties on <body>. */
export function applyFonts(uiFont: string, monoFont: string): void {
  document.body.style.setProperty('--fg-font-ui', uiFont)
  document.body.style.setProperty('--fg-font-mono', `'${monoFont}', monospace`)
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
  const workspaceLayout = useWorkspaceLayout()
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false)
  const [fileTreeWidth, setFileTreeWidth] = useState(260)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCostDialog, setShowCostDialog] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const indexProgress = useIndexProgress(selectedProject?.id)
  const [pendingIndex, setPendingIndex] = useState<string | null>(null)
  const [zoom, setZoomState] = useState(100)
  const fileTreeWidthRef = useRef(260)
  const { toasts, removeToast } = useToast()

  useDashboardThemeSync()

  // Apply saved theme on mount
  useEffect(() => {
    window.fieldguide.configGet().then((r) => {
      if (r.ok && r.data) {
        const cfg = r.data as Record<string, unknown>
        const theme = cfg.theme as string | undefined
        const appearance = cfg.appearance as Record<string, string> | undefined
        applyTheme(theme || 'system', appearance?.themePreset || 'parchment')

        // Apply saved zoom
        const zoomVal = appearance?.zoom ? Number(appearance.zoom) : 100
        setZoomState(zoomVal)
        applyZoom(zoomVal)

        // Apply saved fonts
        const uiFont = appearance?.uiFont || 'Segoe UI'
        const monoFont = appearance?.monoFont || 'Cascadia Code'
        applyFonts(uiFont, monoFont)

        // Restore sidebar width
        const sidebarWidthVal = appearance?.sidebarWidth ? Number(appearance.sidebarWidth) : 260
        setFileTreeWidth(Math.max(160, Math.min(400, sidebarWidthVal)))

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

  // Ctrl+= / Ctrl+- / Ctrl+0 — zoom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      let newZoom = zoom
      if (e.key === '=' || e.key === '+') { e.preventDefault(); newZoom = Math.min(200, zoom + 10) }
      else if (e.key === '-') { e.preventDefault(); newZoom = Math.max(50, zoom - 10) }
      else if (e.key === '0') { e.preventDefault(); newZoom = 100 }
      else return
      setZoomState(newZoom)
      applyZoom(newZoom)
      showToast('info', `缩放: ${newZoom}%`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

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
  async function handleOnboardingSetup(
    option: 'demo' | 'local',
    locale: string,
    projectsRoot: string,
    localPath?: string,
  ): Promise<string | null> {
    await window.fieldguide.configSet({ locale, projectsRoot })
    i18n.changeLanguage(locale)

    switch (option) {
      case 'demo': {
        const result = await window.fieldguide.projectInstallDemo(projectsRoot || undefined)
        if (result.ok && result.data) {
          const project = result.data as Project
          setSelectedProject(project)
          if (project.status !== 'ready') {
            doIndex(project.id, project.name)
          }
          return project.id
        } else {
          showToast('error', result.error?.message ?? '内置示例安装失败')
          return null
        }
      }
      case 'local': {
        const path = localPath
        if (!path) {
          showToast('error', '未选择项目文件夹')
          return null
        }
        const result = await window.fieldguide.projectAddLocal(path)
        if (result.ok && result.data) {
          const project = result.data as Project
          setSelectedProject(project)
          doIndex(project.id, project.name)
          return project.id
        }
        showToast('error', result.error?.message ?? '添加本地项目失败')
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

    try {
      const result = await window.fieldguide.projectIndex(projectId, incremental)
      if (!result.ok) {
        showToast('error', result.error?.message ?? '索引失败')
        return
      }
      // Refresh project details to get node count
      const list = await window.fieldguide.projectList()
      if (list.ok && list.data) {
        const updated = list.data.find((p: Project) => p.id === projectId) as Project | undefined
        if (updated) setSelectedProject(updated)
      }
      showToast('success', `索引完成 — ${(result.data as Record<string, unknown>)?.nodeCount ?? '?'} 个节点`)
    } catch (err) {
      showToast('error', String(err))
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
      const preset = document.documentElement.dataset.themePreset
      applyTheme(next, preset)
      syncDashboardTheme()
      // Persist to config
      window.fieldguide.configSet({ theme: next }).catch(() => {})
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
                workspaceLayout.openFile(node.filePath)
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
    <div className="flex flex-col h-screen bg-[var(--fg-bg)] text-[var(--fg-text-primary)]" data-fg-surface>
      <TopBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSettings={() => setShowSettings(true)}
        onSearch={() => setShowPalette(true)}
        t={t}
      />

      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'codemap' && !fileTreeCollapsed && (
          <>
            <div
              style={{ width: fileTreeWidth }}
              className="flex-shrink-0 border-r border-[var(--fg-border)] bg-[var(--fg-sidebar-bg,var(--fg-bg))] transition-[width] duration-200 ease-out"
            >
              <FileTree
                projectId={selectedProject?.id ?? ''}
                onFileClick={(p) => workspaceLayout.openFile(p)}
                activeFilePath={workspaceLayout.layout.panels[workspaceLayout.layout.activePanelIndex]?.filePath}
                t={t}
              />
            </div>
            <div
              className="group w-1.5 bg-[var(--fg-border)] hover:bg-[var(--fg-accent-muted)] cursor-col-resize shrink-0 transition-colors duration-150 flex items-center justify-center"
              title={t('tooltip.collapseFileTree')}
              onMouseDown={(e) => {
                const startX = e.clientX
                const startW = fileTreeWidth
                const onMove = (ev: MouseEvent) => {
                  const w = Math.max(160, Math.min(400, startW + ev.clientX - startX))
                  setFileTreeWidth(w)
                  fileTreeWidthRef.current = w
                }
                const onUp = () => {
                  document.removeEventListener('mousemove', onMove)
                  document.removeEventListener('mouseup', onUp)
                  document.body.style.cursor = ''
                  // Persist sidebar width
                  window.fieldguide.configGet().then((r) => {
                    if (r.ok && r.data) {
                      const cfg = r.data as Record<string, unknown>
                      const app = (cfg.appearance as Record<string, unknown>) || {}
                      window.fieldguide.configSet({ appearance: { ...app, sidebarWidth: fileTreeWidthRef.current } }).catch(() => {})
                    }
                  }).catch(() => {})
                }
                document.body.style.cursor = 'col-resize'
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
              }}
            >
              <div className="w-0.5 h-8 rounded-full bg-[var(--fg-text-tertiary)] opacity-0 group-hover:opacity-60 transition-opacity" />
            </div>
          </>
        )}

        {activeTab === 'codemap' && fileTreeCollapsed && (
          <button
            onClick={() => setFileTreeCollapsed(false)}
            className="w-8 bg-[var(--fg-card)] border-r border-[var(--fg-border)] flex items-start justify-center pt-2 hover:bg-[var(--fg-tree-hover)] transition-colors shrink-0"
            title={t('tooltip.expandFileTree')}
          >
            <Folder size={14} className="text-[var(--fg-text-tertiary)]" />
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
                if (filePath) workspaceLayout.openFile(filePath)
              }} t={t} />
              <div className="flex-1 overflow-hidden">
                <CodeMapLayout
                  project={selectedProject}
                  workspaceLayout={workspaceLayout}
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

      <StatusBar project={selectedProject} t={t} indexProgress={indexProgress} />

      {/* Onboarding overlay */}
      {showOnboarding && (
        <OnboardingWizard t={t} onComplete={handleOnboardingComplete} onStartOption={handleOnboardingStart} onSetupStart={handleOnboardingSetup} />
      )}

      {/* Command palette */}
      <CommandPalette
        open={showPalette}
        commands={commands}
        t={t}
        onClose={() => setShowPalette(false)}
        onFileSelect={selectedProject ? (filePath) => {
          workspaceLayout.openFile(filePath)
          setActiveTab('codemap')
          setFileTreeCollapsed(false)
        } : undefined}
        searchFiles={selectedProject ? async (q: string) => {
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
        } : undefined}
        searchNodes={selectedProject ? async (q: string) => {
          const r = await window.fieldguide.graphGet(selectedProject.id)
          if (!r.ok || !r.data) return []
          const g = r.data as { nodes?: Array<{ id: string; label?: string; type?: string; filePath?: string }> }
          const ql = q.toLowerCase()
          return (g.nodes || [])
            .filter(n => (n.label || n.id).toLowerCase().includes(ql))
            .slice(0, 8)
            .map(n => ({ id: n.id, label: n.label || n.id, type: n.type || 'unknown', filePath: n.filePath }))
        } : undefined}
        onNodeSelect={selectedProject ? (nodeId: string) => {
          dashboardSelectNode(nodeId)
          window.fieldguide.graphGet(selectedProject.id).then(r => {
            if (r.ok && r.data) {
              const g = r.data as { nodes?: Array<{ id: string; filePath?: string }> }
              const node = (g.nodes || []).find(n => n.id === nodeId)
              if (node?.filePath) {
                workspaceLayout.openFile(node.filePath)
                setActiveTab('codemap')
                setFileTreeCollapsed(false)
              }
            }
          })
        } : undefined}
      />

      {/* Settings */}
      <SettingsPanel open={showSettings} t={t} onClose={() => setShowSettings(false)} onAbout={() => { setShowSettings(false); setShowAbout(true) }} />

      {/* About */}
      <AboutDialog open={showAbout} t={t} onClose={() => setShowAbout(false)} />

      {/* LLM Cost Dialog */}
      <CostDialog
        open={showCostDialog && !!selectedProject}
        t={t}
        projectId={selectedProject?.id ?? ''}
        projectName={selectedProject?.name ?? ''}
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
    </div>
  )
}

function CodeMapLayout({
  project,
  workspaceLayout,
  t,
  onDashboardMessage,
}: {
  project: Project | null
  workspaceLayout: ReturnType<typeof useWorkspaceLayout>
  t: (key: string) => string
  onDashboardMessage?: (msg: DashboardMessage) => void
}) {
  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--fg-text-tertiary)]">
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
      layout={workspaceLayout}
      t={t}
    />
  )
}

function TopBar({
  tabs, activeTab, onTabChange, onSettings, onSearch, t,
}: {
  tabs: { id: Tab; label: string; disabled?: boolean }[]
  activeTab: Tab
  onTabChange: (t: Tab) => void
  onSettings: () => void
  onSearch: () => void
  t: (k: string) => string
}) {
  return (
    <header className="h-11 flex items-center px-3 border-b border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0 select-none shadow-sm" data-fg-surface>
      <Button variant="ghost" size="sm" onClick={() => onTabChange('library')} className="font-bold text-lg mr-6 px-0 hover:bg-transparent">
        {t('app.name')}
      </Button>
      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as Tab)} className="h-full flex items-stretch">
        <TabsList className="h-full bg-transparent p-0 gap-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              title={tab.disabled ? t('tooltip.addProjectFirst') : undefined}
              className="h-full rounded-none px-3 text-sm font-medium disabled:opacity-40 data-[state=active]:font-semibold"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="icon" size="icon-sm" onClick={onSearch} aria-label={t('tooltip.search')}>
            <Search size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ctrl+K</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="icon" size="icon-sm" onClick={onSettings} className="ml-1" aria-label={t('tooltip.settings')}>
            <SettingsIcon size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('tooltip.settings')}</TooltipContent>
      </Tooltip>
    </header>
  )
}

function StatusBar({ project, t, indexProgress }: {
  project: Project | null
  t: (k: string, opts?: Record<string, unknown>) => string
  indexProgress: ReturnType<typeof useIndexProgress>
}) {
  const p = indexProgress.progress
  const pct = progressPercent(p)
  const label = p?.phase ? indexProgress.phaseLabel(p.phase, t) : ''
  const detail = p?.type === 'progress' && p.current !== undefined && p.total ? `${p.current}/${p.total}` : ''
  const error = p?.type === 'error' ? p.error : null

  return (
    <footer className="shrink-0 select-none border-t border-[var(--fg-border)] bg-[var(--fg-card)]">
      {indexProgress.isIndexing && pct >= 0 && (
        <div className="h-[3px] bg-[var(--fg-input-border)]">
          <div
            className="h-full bg-[var(--fg-accent)] transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="h-6 flex items-center px-4 text-xs gap-3">
        {indexProgress.isIndexing ? (
          <span className="text-[var(--fg-accent-text)] flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--fg-accent)] animate-pulse" />
            {label}
            {detail && <span className="text-[var(--fg-text-tertiary)]">{detail}</span>}
          </span>
        ) : error ? (
          <span className="text-[var(--fg-status-error)]">{error}</span>
        ) : (
          <span className="text-[var(--fg-text-tertiary)]">{project ? project.status : t('status.ready')}</span>
        )}
        {project?.node_count ? <span className="text-[var(--fg-text-tertiary)]">· {t('status.nodes', { count: project.node_count })}</span> : null}
        {project ? <span className="text-[var(--fg-text-tertiary)]">· {project.name}</span> : null}
        <span className="flex-1" />
        <span className="text-[var(--fg-text-tertiary)]">{t('app.name')} {t('app.version')}</span>
      </div>
    </footer>
  )
}
