/**
 * SplitPanel — resizable split panel area (1 or 2 panels).
 * ui-spec v0.4 §3.2.2
 *
 * Supports: left/right split (default) or top/bottom split.
 * Each panel has a Tab bar: [图谱] [代码] [问答]
 */
import { useState, useRef, useCallback, useEffect } from 'react'

export type PanelTab = 'graph' | 'code' | 'chat'

export interface PanelState {
  tabs: PanelTab[]
  activeTab: PanelTab
}

interface Props {
  /** Panel A (primary) content renderers */
  renderGraph: () => React.ReactNode
  renderCode: (filePath?: string) => React.ReactNode
  renderChat: () => React.ReactNode
  /** Currently open file path (from file tree click) */
  activeFilePath?: string
}

type SplitDirection = 'horizontal' | 'vertical'

export default function SplitPanel({ renderGraph, renderCode, renderChat, activeFilePath }: Props) {
  const [panels, setPanels] = useState<PanelState[]>([
    { tabs: ['graph', 'code', 'chat'], activeTab: 'graph' },
  ])
  const [direction, setDirection] = useState<SplitDirection>('horizontal')
  const [splitPos, setSplitPos] = useState(50) // percentage for first panel
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const hasTwoPanels = panels.length === 2

  // When a file is clicked, auto-open code panel
  useEffect(() => {
    if (activeFilePath && panels.length === 1) {
      // Split into 2 panels: keep graph on left, code on right
      setPanels([
        { tabs: ['graph', 'code', 'chat'], activeTab: 'graph' },
        { tabs: ['graph', 'code', 'chat'], activeTab: 'code' },
      ])
      setSplitPos(55)
    } else if (activeFilePath && panels.length === 2) {
      // Ensure second panel shows code
      setPanels((prev) => {
        const next = [...prev]
        if (next[1].activeTab !== 'code') {
          next[1] = { ...next[1], activeTab: 'code' }
        }
        return next
      })
    }
  }, [activeFilePath])

  // Drag handler
  const onMouseDown = useCallback(() => {
    dragging.current = true
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const total = direction === 'horizontal' ? rect.width : rect.height
      const pos = direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top
      const pct = Math.max(20, Math.min(80, (pos / total) * 100))
      setSplitPos(pct)
    }

    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [direction])

  function updatePanel(index: number, tab: PanelTab) {
    setPanels((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], activeTab: tab }
      return next
    })
  }

  function addPanel() {
    if (panels.length >= 2) return
    setPanels([...panels, { tabs: ['graph', 'code', 'chat'], activeTab: 'code' }])
    setSplitPos(50)
  }

  function removePanel(index: number) {
    if (panels.length <= 1) return
    setPanels(panels.filter((_, i) => i !== index))
  }

  function renderContent(panel: PanelState, _index: number) {
    switch (panel.activeTab) {
      case 'graph':
        return renderGraph()
      case 'code':
        return renderCode(activeFilePath)
      case 'chat':
        return renderChat()
    }
  }

  const TAB_LABELS: Record<PanelTab, string> = {
    graph: '图谱',
    code: '代码',
    chat: '问答',
  }

  const containerClass = direction === 'horizontal' ? 'flex flex-row' : 'flex flex-col'

  return (
    <div ref={containerRef} className={`h-full w-full ${containerClass}`}>
      {panels.map((panel, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden"
          style={{
            [direction === 'horizontal' ? 'width' : 'height']:
              panels.length === 2 ? (i === 0 ? `${splitPos}%` : `${100 - splitPos}%`) : '100%',
          }}
        >
          {/* Tab bar */}
          <div className="flex items-center h-8 border-b border-[var(--fg-border)] bg-[var(--fg-card)] px-1 shrink-0">
            <div className="flex-1 flex items-center gap-0">
              {panel.tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => updatePanel(i, tab)}
                  className={`relative px-3 py-1 text-xs font-medium transition-colors ${
                    panel.activeTab === tab
                      ? 'text-blue-700'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {TAB_LABELS[tab]}
                  {panel.activeTab === tab && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded" />
                  )}
                </button>
              ))}
            </div>
            {/* Panel actions */}
            <div className="flex items-center gap-0.5 px-1">
              {panels.length < 2 && (
                <button
                  onClick={addPanel}
                  className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs rounded"
                  title="添加面板"
                >
                  ＋
                </button>
              )}
              {panels.length > 1 && (
                <button
                  onClick={() => removePanel(i)}
                  className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 text-xs rounded"
                  title="关闭面板"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {renderContent(panel, i)}
          </div>
        </div>
      ))}

      {/* Drag handle between panels */}
      {hasTwoPanels && (
        <div
          onMouseDown={onMouseDown}
          className={`shrink-0 bg-[var(--fg-border)] hover:bg-blue-400 transition-colors z-10 ${
            direction === 'horizontal'
              ? 'w-1 cursor-col-resize'
              : 'h-1 cursor-row-resize'
          }`}
        />
      )}
    </div>
  )
}
