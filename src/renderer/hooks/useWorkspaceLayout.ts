/**
 * useWorkspaceLayout — manages panel state for the CodeMap split view.
 * 
 * Policy (ux-split-policy):
 * - Single panel default: activeTab = 'graph'
 * - Dual panel default: panel[0] = code, panel[1] = graph
 * - File opens route to active panel (no forced split)
 * - Layout persisted to config.workspaceLayout
 */
import { useState, useCallback, useEffect } from 'react'

export type PanelTab = 'graph' | 'code' | 'chat' | 'tour'

export interface OpenFile {
  id: string
  path: string
}

export interface PanelState {
  id: number
  tabs: PanelTab[]
  activeTab: PanelTab
  filePath?: string
  openFiles: OpenFile[]
  activeFileId?: string
}

let fileIdCounter = 0
function nextFileId(): string {
  return `f${++fileIdCounter}`
}

export type SplitDirection = 'horizontal' | 'vertical'

export interface WorkspaceLayout {
  panels: PanelState[]
  activePanelIndex: number
  splitPos: number        // percentage, 20-80
  splitDirection: SplitDirection
}

const DEFAULT_LAYOUT: WorkspaceLayout = {
  panels: [
    { id: 0, tabs: ['graph', 'code', 'chat', 'tour'], activeTab: 'graph', filePath: undefined, openFiles: [], activeFileId: undefined },
  ],
  activePanelIndex: 0,
  splitPos: 50,
  splitDirection: 'horizontal',
}

let panelIdCounter = 0
function nextPanelId(): number {
  return ++panelIdCounter
}

function createPanel(activeTab: PanelTab = 'code'): PanelState {
  return { id: nextPanelId(), tabs: ['graph', 'code', 'chat', 'tour'], activeTab, filePath: undefined, openFiles: [], activeFileId: undefined }
}

export function useWorkspaceLayout(persistKey?: string) {
  const [layout, setLayout] = useState<WorkspaceLayout>(DEFAULT_LAYOUT)
  const [loaded, setLoaded] = useState(false)

  // Load persisted layout on mount
  useEffect(() => {
    window.fieldguide.configGet().then((r) => {
      if (r.ok && r.data) {
        const cfg = r.data as Record<string, unknown>
        const saved = cfg.workspaceLayout as WorkspaceLayout | undefined
        if (saved && Array.isArray(saved.panels) && saved.panels.length > 0) {
          // Re-hydrate panel id counters
          panelIdCounter = Math.max(...saved.panels.map(p => p.id), 0)
          setLayout(saved)
        } else {
          // Apply default: single panel with graph
          panelIdCounter = 0
          setLayout(DEFAULT_LAYOUT)
        }
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // Persist layout on change (debounced)
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => {
      window.fieldguide.configSet({
        workspaceLayout: layout as unknown as Record<string, unknown>,
      } as never).catch(() => {})
    }, 500)
    return () => clearTimeout(t)
  }, [layout, loaded])

  const setActivePanel = useCallback((index: number) => {
    setLayout(prev => ({ ...prev, activePanelIndex: index }))
  }, [])

  /** Route a file open to the active panel. Manages open files tab list. */
  const openFile = useCallback((filePath: string) => {
    setLayout(prev => {
      const panels = [...prev.panels]
      const activeIdx = prev.activePanelIndex
      if (activeIdx < 0 || activeIdx >= panels.length) return prev
      const panel = panels[activeIdx]
      const existing = panel.openFiles.find(f => f.path === filePath)
      if (existing) {
        panels[activeIdx] = {
          ...panel,
          filePath,
          activeFileId: existing.id,
          activeTab: panel.activeTab === 'graph' ? 'code' : panel.activeTab,
        }
      } else {
        const newFile: OpenFile = { id: nextFileId(), path: filePath }
        panels[activeIdx] = {
          ...panel,
          filePath,
          activeFileId: newFile.id,
          openFiles: [...panel.openFiles, newFile].slice(-10),
          activeTab: panel.activeTab === 'graph' ? 'code' : panel.activeTab,
        }
      }
      return { ...prev, panels }
    })
  }, [])

  const closeFile = useCallback((panelIndex: number, fileId: string) => {
    setLayout(prev => {
      const panels = [...prev.panels]
      if (panelIndex < 0 || panelIndex >= panels.length) return prev
      const panel = panels[panelIndex]
      const nextFiles = panel.openFiles.filter(f => f.id !== fileId)
      if (panel.activeFileId === fileId) {
        const next = nextFiles[nextFiles.length - 1] ?? null
        panels[panelIndex] = {
          ...panel,
          filePath: next?.path,
          activeFileId: next?.id,
          openFiles: nextFiles,
        }
      } else {
        panels[panelIndex] = { ...panel, openFiles: nextFiles }
      }
      return { ...prev, panels }
    })
  }, [])

  const switchToFile = useCallback((panelIndex: number, fileId: string) => {
    setLayout(prev => {
      const panels = [...prev.panels]
      if (panelIndex < 0 || panelIndex >= panels.length) return prev
      const panel = panels[panelIndex]
      const file = panel.openFiles.find(f => f.id === fileId)
      if (!file) return prev
      panels[panelIndex] = {
        ...panel,
        filePath: file.path,
        activeFileId: fileId,
        activeTab: panel.activeTab === 'graph' ? 'code' : panel.activeTab,
      }
      return { ...prev, panels }
    })
  }, [])

  const updatePanelTab = useCallback((panelIndex: number, tab: PanelTab) => {
    setLayout(prev => {
      const panels = [...prev.panels]
      if (panelIndex < 0 || panelIndex >= panels.length) return prev
      panels[panelIndex] = { ...panels[panelIndex], activeTab: tab }
      return { ...prev, panels }
    })
  }, [])

  const setNumPanels = useCallback((count: 1 | 2) => {
    setLayout(prev => {
      if (prev.panels.length === count) return prev
      if (count === 1) {
        // Keep current active panel
        const keep = prev.panels[prev.activePanelIndex] ?? prev.panels[0]
        return { ...prev, panels: [keep], activePanelIndex: 0, splitPos: 50 }
      }
      // count === 2: add a second panel
      const existing = prev.panels[0]
      const newPanel = createPanel('graph')
      return {
        ...prev,
        panels: [existing ?? createPanel('code'), newPanel],
        activePanelIndex: prev.activePanelIndex,
        splitPos: 50,
      }
    })
  }, [])

  const setSplitDirection = useCallback((dir: SplitDirection) => {
    setLayout(prev => ({ ...prev, splitDirection: dir }))
  }, [])

  const swapPanels = useCallback(() => {
    setLayout(prev => {
      if (prev.panels.length < 2) return prev
      return {
        ...prev,
        panels: [prev.panels[1], prev.panels[0]],
        activePanelIndex: prev.activePanelIndex === 0 ? 1 : 0,
      }
    })
  }, [])

  const setSplitPos = useCallback((pos: number) => {
    setLayout(prev => ({ ...prev, splitPos: Math.max(20, Math.min(80, pos)) }))
  }, [])

  const maximizePanel = useCallback((panelIndex: number) => {
    setLayout(prev => {
      if (prev.panels.length < 2) return prev
      // Hide the other panel by pushing split to 100/0
      const newPos = panelIndex === 0 ? 100 : 0
      return { ...prev, splitPos: newPos, _maximized: true, _preMaxPos: prev.splitPos }
    })
  }, [])

  const restorePanels = useCallback(() => {
    setLayout(prev => {
      const restored = prev as WorkspaceLayout & { _maximized?: boolean; _preMaxPos?: number }
      if (!restored._maximized) return prev
      const { _maximized, _preMaxPos, ...clean } = restored
      return { ...clean, splitPos: _preMaxPos ?? 50 }
    })
  }, [])

  return {
    layout,
    loaded,
    setActivePanel,
    openFile,
    updatePanelTab,
    setNumPanels,
    setSplitDirection,
    swapPanels,
    setSplitPos,
    maximizePanel,
    restorePanels,
    closeFile,
    switchToFile,
  }
}
