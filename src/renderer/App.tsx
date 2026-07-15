/**
 * Fieldguide App Shell — VS Code–style activity bar + contextual title bar.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Folder, ChevronDown } from 'lucide-react'
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
import SettingsView from './views/SettingsPanel'
import CostDialog from './views/CostDialog'
import AboutDialog from './views/AboutDialog'
import TheoryView from './views/Theory/TheoryView'
import BridgeView from './views/Bridge/BridgeView'
import ActivityBar, { defaultActivityIcons, type ShellModule } from './components/ActivityBar'
import { useToast, ToastContainer, showToast } from './views/Toast'
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout'
import { useIndexProgress, progressPercent } from './hooks/useIndexProgress'
import { useDashboardThemeSync } from './hooks/useDashboardThemeSync'
import { syncDashboardTheme } from './lib/dashboard-theme'
import { postToDashboard } from './lib/dashboard-bridge'
import {
  applyAppearance,
  applyShellZoom,
  clampZoom,
  normalizeAppearance,
  persistAppearancePatch,
  type AppearanceState,
} from './lib/appearance'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type Tab = ShellModule

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

/** @deprecated Use applyShellZoom from lib/appearance */
export function applyZoom(zoom: number): void {
  applyShellZoom(zoom, 14)
}

/** @deprecated Use applyFonts from lib/appearance with sizes */
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
  const [projects, setProjects] = useState<Project[]>([])
  const workspaceLayout = useWorkspaceLayout()
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false)
  const [fileTreeWidth, setFileTreeWidth] = useState(260)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showCostDialog, setShowCostDialog] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const indexProgress = useIndexProgress(selectedProject?.id)
  const [pendingIndex, setPendingIndex] = useState<string | null>(null)
  const [appearance, setAppearance] = useState<AppearanceState>(() => normalizeAppearance())
  const fileTreeWidthRef = useRef(260)
  const { toasts, removeToast } = useToast()

  useDashboardThemeSync()

  const refreshProjects = () => {
    window.fieldguide.projectList().then((list) => {
      if (list.ok && list.data) setProjects(list.data as Project[])
    })
  }

  useEffect(() => {
    const unsub = window.fieldguide.onDiffResult?.((data) => {
      const payload = data as { changedNodeIds?: string[]; affectedNodeIds?: string[] }
      postToDashboard({
        type: 'setDiffOverlay',
        changed: payload.changedNodeIds ?? [],
        affected: payload.affectedNodeIds ?? [],
      })
    })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    const unsubFolder = window.fieldguide.onMenuOpenProjectsFolder?.(() => {
      window.fieldguide.configGet().then((r) => {
        if (r.ok && r.data) {
          const root = (r.data as Record<string, unknown>).projectsRoot as string
          if (root) window.fieldguide.openFile(root).catch(() => {})
        }
      })
    })
    const unsubOpenProject = window.fieldguide.onMenuOpenProject?.(() => { void openLocalProject() })
    const unsubAbout = window.fieldguide.onMenuAbout?.(() => setShowAbout(true))
    const unsubZoomIn = window.fieldguide.onMenuZoomIn?.(() => bumpShellZoom(10))
    const unsubZoomOut = window.fieldguide.onMenuZoomOut?.(() => bumpShellZoom(-10))
    const unsubZoomReset = window.fieldguide.onMenuZoomReset?.(() => setShellZoom(100))
    return () => {
      unsubFolder?.()
      unsubOpenProject?.()
      unsubAbout?.()
      unsubZoomIn?.()
      unsubZoomOut?.()
      unsubZoomReset?.()
    }
  }, [appearance.shellZoom, appearance.uiFontSize])

  async function openLocalProject() {
    const picked = await window.fieldguide.openFolderDialog()
    if (!picked.ok || !picked.data) return
    const folder = picked.data

    const list = await window.fieldguide.projectList()
    const existing = list.ok && list.data
      ? (list.data as Project[]).find((p) => p.root_path === folder || p.source_uri === folder)
      : undefined
    if (existing) {
      setSelectedProject(existing)
      refreshProjects()
      setActiveTab('codemap')
      return
    }

    const result = await window.fieldguide.projectAddLocal(folder)
    if (!result.ok || !result.data) {
      showToast('error', result.error?.message ?? t('project.addFailed'))
      return
    }
    const project = result.data as Project
    setSelectedProject(project)
    refreshProjects()
    setActiveTab('codemap')
    doIndex(project.id, project.name)
  }
  function setShellZoom(zoom: number, notify = true) {
    setAppearance((prev) => {
      const next = clampZoom(zoom)
      applyShellZoom(next, prev.uiFontSize)
      persistAppearancePatch({ shellZoom: next }).catch(() => {})
      if (notify) showToast('info', t('status.shellZoom', { zoom: next }))
      return { ...prev, shellZoom: next }
    })
  }

  function bumpShellZoom(delta: number, notify = true) {
    setAppearance((prev) => {
      const next = clampZoom(prev.shellZoom + delta)
      applyShellZoom(next, prev.uiFontSize)
      persistAppearancePatch({ shellZoom: next }).catch(() => {})
      if (notify) showToast('info', t('status.shellZoom', { zoom: next }))
      return { ...prev, shellZoom: next }
    })
  }

  useEffect(() => {
    window.fieldguide.configGet().then((r) => {
      if (r.ok && r.data) {
        const cfg = r.data as Record<string, unknown>
        const theme = cfg.theme as string | undefined
        const app = normalizeAppearance(cfg.appearance as Record<string, unknown> | undefined)
        setAppearance(app)
        applyTheme(theme || 'system', app.themePreset || 'parchment')
        applyAppearance(app)
        setFileTreeWidth(app.sidebarWidth)

        const lastProjectId = cfg.lastProjectId as string | undefined
        const lastTab = cfg.lastTab as Tab | undefined
        if (lastTab && lastTab !== 'settings') setActiveTab(lastTab)
        refreshProjects()
        if (lastProjectId) {
          window.fieldguide.projectList().then((list) => {
            if (list.ok && list.data) {
              const found = (list.data as Project[]).find((p) => p.id === lastProjectId)
              if (found) setSelectedProject(found)
            }
          })
        }
      }
    })
  }, [])

  useEffect(() => {
    window.fieldguide.configGet().then((r) => {
      if (r.ok && r.data && !(r.data as Record<string, unknown>).onboardingCompleted) {
        setShowOnboarding(true)
      }
    })
  }, [])

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

  // Ctrl + mouse wheel — shell zoom (VS Code / browser style)
  useEffect(() => {
    let last = 0
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const now = Date.now()
      if (now - last < 50) return
      last = now
      bumpShellZoom(e.deltaY < 0 ? 10 : -10, false)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [appearance.shellZoom, appearance.uiFontSize])

  // Shell zoom via View menu (accelerators) — see onMenuZoom*
  // Keyboard is handled by Electron menu accelerators → menu:zoomIn/Out/Reset
  useEffect(() => {
    if (selectedProject) {
      window.fieldguide.dashboardSetProject?.(selectedProject.root_path)
    } else {
      window.fieldguide.dashboardSetProject?.(null)
    }
  }, [selectedProject?.id])

  useEffect(() => {
    if (activeTab !== 'settings') {
      window.fieldguide.configSet({ lastTab: activeTab } as never).catch(() => {})
    }
  }, [activeTab])

  useEffect(() => {
    if (selectedProject) {
      window.fieldguide.configSet({ lastProjectId: selectedProject.id } as never).catch(() => {})
    }
  }, [selectedProject?.id])

  async function handleOnboardingComplete(locale: string, projectsRoot: string, navigateTo?: 'codemap' | 'library') {
    await window.fieldguide.configSet({ locale, projectsRoot, onboardingCompleted: true })
    i18n.changeLanguage(locale)
    setShowOnboarding(false)
    refreshProjects()
    if (navigateTo === 'codemap') setActiveTab('codemap')
    else if (navigateTo === 'library') setActiveTab('library')
  }

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
          refreshProjects()
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
          refreshProjects()
          doIndex(project.id, project.name)
          return project.id
        }
        showToast('error', result.error?.message ?? '添加本地项目失败')
        return null
      }
    }
  }

  async function handleOnboardingStart(_option: 'demo' | 'local' | 'skip', locale: string, projectsRoot: string) {
    await window.fieldguide.configSet({ locale, projectsRoot, onboardingCompleted: true })
    i18n.changeLanguage(locale)
    setShowOnboarding(false)
  }

  async function handleReIndex(incremental = false) {
    if (!selectedProject) return
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
      const list = await window.fieldguide.projectList()
      if (list.ok && list.data) {
        const updated = (list.data as Project[]).find((p) => p.id === projectId)
        if (updated) setSelectedProject(updated)
        setProjects(list.data as Project[])
      }
      showToast('success', `索引完成 — ${(result.data as Record<string, unknown>)?.nodeCount ?? '?'} 个节点`)
    } catch (err) {
      showToast('error', String(err))
    }
  }

  const commands = [
    { id: 'library', label: t('commandPalette.library'), shortcut: 'Tab', action: () => setActiveTab('library') },
    ...(selectedProject ? [
      { id: 'reindex', label: t('commandPalette.reindex', { name: selectedProject.name }), action: handleReIndex },
      { id: 'codemap', label: t('commandPalette.codemap'), shortcut: 'Tab', action: () => setActiveTab('codemap') },
      { id: 'openFolder', label: t('commandPalette.openFolder'), action: () => window.fieldguide.openInExplorer(selectedProject.id, '.') },
    ] : []),
    { id: 'settings', label: t('commandPalette.settings'), action: () => setActiveTab('settings') },
    { id: 'zoomIn', label: t('commandPalette.zoomIn'), action: () => bumpShellZoom(10) },
    { id: 'zoomOut', label: t('commandPalette.zoomOut'), action: () => bumpShellZoom(-10) },
    { id: 'zoomReset', label: t('commandPalette.zoomReset'), action: () => setShellZoom(100) },
    { id: 'toggleTheme', label: t('commandPalette.toggleTheme'), action: () => {
      const current = document.documentElement.dataset.theme
      const next = current === 'dark' ? 'light' : 'dark'
      const preset = document.documentElement.dataset.themePreset
      applyTheme(next, preset)
      syncDashboardTheme()
      window.fieldguide.configSet({ theme: next }).catch(() => {})
    }},
  ]

  function handleNodeRef(nodeId: string) {
    if (!selectedProject) return
    dashboardSelectNode(nodeId)
    window.fieldguide.graphGet(selectedProject.id).then((r) => {
      if (r.ok && r.data) {
        const g = r.data as { nodes?: Array<{ id: string; filePath?: string }> }
        const node = (g.nodes || []).find((n) => n.id === nodeId)
        if (node?.filePath) workspaceLayout.openFile(node.filePath)
      }
    })
  }

  function handleDashboardMessage(msg: DashboardMessage) {
    switch (msg.type) {
      case 'nodeSelected': {
        if (msg.nodeId && selectedProject) {
          window.fieldguide.graphGet(selectedProject.id).then((r) => {
            if (r.ok && r.data) {
              const g = r.data as { nodes?: Array<{ id: string; filePath?: string }> }
              const node = (g.nodes || []).find((n) => n.id === msg.nodeId)
              if (node?.filePath) workspaceLayout.openFile(node.filePath)
            }
          })
        }
        break
      }
      case 'tourStepChanged':
        break
    }
  }

  const noProject = !selectedProject
  const icons = defaultActivityIcons()

  function changeModule(id: ShellModule) {
    if ((id === 'codemap' || id === 'bridge') && noProject) return
    setActiveTab(id)
    if (id === 'library') refreshProjects()
  }

  const activityItems = [
    { id: 'library' as const, icon: icons.library, label: t('tabs.library') },
    { id: 'codemap' as const, icon: icons.codemap, label: t('tabs.codemap'), disabled: noProject },
    { id: 'theory' as const, icon: icons.theory, label: t('tabs.theory') },
    { id: 'bridge' as const, icon: icons.bridge, label: t('tabs.bridge'), disabled: noProject },
    { id: 'settings' as const, icon: null as unknown as React.ReactNode, label: t('tabs.settings') },
  ]

  const moduleTitle =
    activeTab === 'library' ? t('tabs.library')
      : activeTab === 'codemap' ? t('tabs.codemap')
        : activeTab === 'theory' ? t('tabs.theory')
          : activeTab === 'bridge' ? t('tabs.bridge')
            : t('tabs.settings')

  return (
    <div className="flex h-screen bg-[var(--fg-bg)] text-[var(--fg-text-primary)]" data-fg-surface>
      <ActivityBar
        active={activeTab}
        onChange={changeModule}
        items={activityItems}
        settingsLabel={t('tabs.settings')}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TitleBar
          moduleTitle={moduleTitle}
          selectedProject={selectedProject}
          projects={projects}
          showProjectMenu={showProjectMenu}
          setShowProjectMenu={setShowProjectMenu}
          onSelectProject={(p) => {
            setSelectedProject(p)
            setShowProjectMenu(false)
            if (p) setActiveTab('codemap')
          }}
          onOpenLibrary={() => setActiveTab('library')}
          onSearch={() => setShowPalette(true)}
          showLayout={activeTab === 'codemap'}
          workspaceLayout={workspaceLayout}
          t={t}
        />

        <div className="flex-1 flex overflow-hidden min-h-0">
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

          <main className="flex-1 overflow-hidden min-w-0">
            {activeTab === 'library' && (
              <ProjectLibrary
                selected={selectedProject}
                onSelect={(p) => {
                  setSelectedProject(p)
                  refreshProjects()
                  if (p) setActiveTab('codemap')
                }}
                onIndex={async (projectId) => {
                  const list = await window.fieldguide.projectList()
                  const p = list.ok ? (list.data as Project[] | undefined)?.find((x) => x.id === projectId) : undefined
                  if (p) doIndex(p.id, p.name, p.status === 'stale')
                }}
                onFullReindex={async (projectId) => {
                  const list = await window.fieldguide.projectList()
                  const p = list.ok ? (list.data as Project[] | undefined)?.find((x) => x.id === projectId) : undefined
                  if (p) doIndex(p.id, p.name, false)
                }}
                t={t}
              />
            )}
            {activeTab === 'codemap' && (
              <div className="h-full flex flex-col">
                <NodeSearchBar projectId={selectedProject?.id ?? ''} onNodeSelect={(_nodeId, filePath) => {
                  if (filePath) workspaceLayout.openFile(filePath)
                }} t={t} />
                <div className="flex-1 overflow-hidden">
                  <CodeMapLayout
                    project={selectedProject}
                    workspaceLayout={workspaceLayout}
                    t={t}
                    onDashboardMessage={handleDashboardMessage}
                    onNodeRefClick={handleNodeRef}
                  />
                </div>
              </div>
            )}
            {activeTab === 'theory' && <TheoryView t={t} projectId={selectedProject?.id} />}
            {activeTab === 'bridge' && <BridgeView t={t} projectId={selectedProject?.id} />}
            {activeTab === 'settings' && (
              <SettingsView
                t={t}
                onAbout={() => setShowAbout(true)}
                selectedProjectId={selectedProject?.id}
                onAppearanceLive={setAppearance}
              />
            )}
          </main>
        </div>

        <StatusBar
          project={selectedProject}
          t={t}
          indexProgress={indexProgress}
          shellZoom={appearance.shellZoom}
          dashboardZoom={appearance.dashboardZoom}
          onCancelIndex={selectedProject ? () => window.fieldguide.projectIndexCancel(selectedProject.id) : undefined}
        />
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {showOnboarding && (
        <OnboardingWizard t={t} onComplete={handleOnboardingComplete} onStartOption={handleOnboardingStart} onSetupStart={handleOnboardingSetup} />
      )}

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
            .filter((n) => (n.label || n.id).toLowerCase().includes(ql))
            .slice(0, 8)
            .map((n) => ({ id: n.id, label: n.label || n.id, type: n.type || 'unknown', filePath: n.filePath }))
        } : undefined}
        onNodeSelect={selectedProject ? (nodeId: string) => {
          dashboardSelectNode(nodeId)
          window.fieldguide.graphGet(selectedProject.id).then((r) => {
            if (r.ok && r.data) {
              const g = r.data as { nodes?: Array<{ id: string; filePath?: string }> }
              const node = (g.nodes || []).find((n) => n.id === nodeId)
              if (node?.filePath) {
                workspaceLayout.openFile(node.filePath)
                setActiveTab('codemap')
                setFileTreeCollapsed(false)
              }
            }
          })
        } : undefined}
      />

      <AboutDialog open={showAbout} t={t} onClose={() => setShowAbout(false)} />

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
          if (pendingIndex) {
            const p = selectedProject
            if (p) doIndex(p.id, p.name)
          }
        }}
      />
    </div>
  )
}

function TitleBar({
  moduleTitle,
  selectedProject,
  projects,
  showProjectMenu,
  setShowProjectMenu,
  onSelectProject,
  onOpenLibrary,
  onSearch,
  showLayout,
  workspaceLayout,
  t,
}: {
  moduleTitle: string
  selectedProject: Project | null
  projects: Project[]
  showProjectMenu: boolean
  setShowProjectMenu: (v: boolean) => void
  onSelectProject: (p: Project | null) => void
  onOpenLibrary: () => void
  onSearch: () => void
  showLayout: boolean
  workspaceLayout: ReturnType<typeof useWorkspaceLayout>
  t: (k: string) => string
}) {
  const { setNumPanels, setSplitDirection, swapPanels, layout } = workspaceLayout
  const hasTwo = layout.panels.length === 2

  return (
    <header className="h-10 flex items-center px-2 border-b border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0 select-none gap-1" data-fg-surface>
      <span className="text-[11px] font-semibold tracking-wide text-[var(--fg-text-tertiary)] px-1.5 shrink-0" title={t('app.name')}>
        FG
      </span>
      <span className="text-sm font-medium text-[var(--fg-text-secondary)] shrink-0 mr-1">{moduleTitle}</span>
      <span className="text-[var(--fg-border)] mx-0.5">·</span>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowProjectMenu(!showProjectMenu)}
          className="flex items-center gap-1 max-w-[220px] px-2 py-1 rounded-md text-sm hover:bg-[var(--fg-tree-hover)] text-[var(--fg-text-primary)]"
        >
          <span className="truncate">{selectedProject?.name || t('titleBar.noProject')}</span>
          <ChevronDown size={14} className="shrink-0 text-[var(--fg-text-tertiary)]" />
        </button>
        {showProjectMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowProjectMenu(false)} />
            <div className="absolute top-full left-0 mt-1 z-50 min-w-[220px] max-h-64 overflow-auto rounded-lg border border-[var(--fg-border)] bg-[var(--fg-card)] shadow-[var(--fg-dialog-shadow)] py-1">
              {projects.length === 0 ? (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]"
                  onClick={() => { setShowProjectMenu(false); onOpenLibrary() }}
                >
                  {t('titleBar.openLibrary')}
                </button>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm truncate hover:bg-[var(--fg-tree-hover)]',
                      selectedProject?.id === p.id && 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]',
                    )}
                    onClick={() => onSelectProject(p)}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex-1" />

      {showLayout && (
        <div className="flex items-center gap-0.5 mr-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setNumPanels(1)} title={t('split.singlePanel')} className="text-[10px]">▣</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => { setNumPanels(2); setSplitDirection('horizontal') }} title={t('split.horizontal')} className="text-[10px]">◫</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => { setNumPanels(2); setSplitDirection('vertical') }} title={t('split.vertical')} className="text-[10px]">◰</Button>
          {hasTwo && (
            <Button variant="ghost" size="icon-sm" onClick={swapPanels} title={t('split.swap')} className="text-[10px]">⇄</Button>
          )}
        </div>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="icon" size="icon-sm" onClick={onSearch} aria-label={t('tooltip.search')}>
            <Search size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ctrl+K</TooltipContent>
      </Tooltip>
    </header>
  )
}

function CodeMapLayout({
  project,
  workspaceLayout,
  t,
  onDashboardMessage,
  onNodeRefClick,
}: {
  project: Project | null
  workspaceLayout: ReturnType<typeof useWorkspaceLayout>
  t: (key: string) => string
  onDashboardMessage?: (msg: DashboardMessage) => void
  onNodeRefClick?: (nodeId: string) => void
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
      renderChat={() => <ChatPanel projectId={project.id} projectName={project.name} t={t} onNodeRefClick={onNodeRefClick} />}
      renderTour={() => <TourPanel projectId={project.id} t={t} />}
      layout={workspaceLayout}
      t={t}
      hideChromeControls
    />
  )
}

function StatusBar({
  project, t, indexProgress, onCancelIndex, shellZoom, dashboardZoom,
}: {
  project: Project | null
  t: (k: string, opts?: Record<string, unknown>) => string
  indexProgress: ReturnType<typeof useIndexProgress>
  onCancelIndex?: () => void
  shellZoom: number
  dashboardZoom: number
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
      <div className="h-6 flex items-center px-3 text-xs gap-3">
        {indexProgress.isIndexing ? (
          <span className="text-[var(--fg-accent-text)] flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--fg-accent)] animate-pulse" />
            {label}
            {detail && <span className="text-[var(--fg-text-tertiary)]">{detail}</span>}
            {onCancelIndex && (
              <button onClick={onCancelIndex} className="ml-1 text-[var(--fg-text-tertiary)] hover:text-[var(--fg-status-error)] underline">
                {t('status.cancelIndex')}
              </button>
            )}
          </span>
        ) : error ? (
          <span className="text-[var(--fg-status-error)]">{error}</span>
        ) : (
          <span className="text-[var(--fg-text-tertiary)]">{project ? t(`project.status.${project.status}`) : t('status.ready')}</span>
        )}
        {project?.node_count ? <span className="text-[var(--fg-text-tertiary)]">· {t('status.nodes', { count: project.node_count })}</span> : null}
        {project ? <span className="text-[var(--fg-text-tertiary)]">· {project.name}</span> : null}
        <span className="flex-1" />
        <span className="text-[var(--fg-text-tertiary)]" title={t('status.zoomHint')}>
          {t('status.zoom', { shell: shellZoom, dash: dashboardZoom })}
        </span>
        <span className="text-[var(--fg-text-tertiary)]">{t('app.name')} {t('app.version')}</span>
      </div>
    </footer>
  )
}
