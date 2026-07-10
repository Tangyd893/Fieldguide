import { useRef, useCallback } from 'react'
import { useWorkspaceLayout, type PanelTab, type SplitDirection } from '../../hooks/useWorkspaceLayout'

interface Props {
  renderGraph: () => React.ReactNode
  renderCode: (filePath?: string) => React.ReactNode
  renderChat: () => React.ReactNode
  renderTour?: () => React.ReactNode
  t: (key: string) => string
  /** Externally controlled layout (from App.tsx) */
  layout: ReturnType<typeof useWorkspaceLayout>
}

export default function SplitPanel({ renderGraph, renderCode, renderChat, renderTour, t, layout: ctrl }: Props) {
  const {
    layout,
    setActivePanel,
    updatePanelTab,
    setSplitPos: setPos,
    setNumPanels,
    setSplitDirection,
    swapPanels,
    maximizePanel,
    restorePanels,
    closeFile,
    switchToFile,
  } = ctrl

  const containerRef = useRef<HTMLDivElement>(null)
  const { panels, activePanelIndex, splitPos, splitDirection } = layout
  const hasTwo = panels.length === 2
  const isVertical = splitDirection === 'vertical'

  const onMouseDown = useCallback(() => {
    document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = isVertical
        ? ((e.clientY - rect.top) / rect.height) * 100
        : ((e.clientX - rect.left) / rect.width) * 100
      setPos(Math.max(20, Math.min(80, pct)))
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [isVertical, setPos])

  const TAB_LABELS: Record<PanelTab, string> = { graph: t('panels.graph'), code: t('panels.code'), chat: t('panels.chat'), tour: 'Tour' }

  function renderContent(panelIndex: number) {
    const panel = panels[panelIndex]
    if (!panel) return null
    switch (panel.activeTab) {
      case 'graph': return renderGraph()
      case 'code': return renderCode(panel.filePath)
      case 'chat': return renderChat()
      case 'tour': return renderTour?.() ?? <div className="p-4 text-[var(--fg-text-tertiary)] text-sm">Tour 不可用</div>
    }
  }

  const dirClass = isVertical ? 'flex-col' : 'flex-row'
  const sizeStyle = hasTwo
    ? { width: isVertical ? '100%' : `${splitPos}%`, height: isVertical ? `${splitPos}%` : '100%' }
    : { width: '100%', height: '100%' }
  const sizeStyle2 = hasTwo
    ? { width: isVertical ? '100%' : `${100 - splitPos}%`, height: isVertical ? `${100 - splitPos}%` : '100%' }
    : { width: '100%', height: '100%' }

  return (
    <div ref={containerRef} className={`h-full w-full flex ${dirClass}`}>
      {/* Split layout controls — top bar */}
      <div className="absolute top-0 right-0 flex items-center gap-0.5 px-2 py-1 z-20">
        {/* Layout buttons */}
        <button onClick={() => setNumPanels(1)} title="单面板"
          className="w-5 h-5 flex items-center justify-center text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-secondary)] text-[10px] rounded">▣</button>
        <button onClick={() => { setNumPanels(2); setSplitDirection('horizontal') }} title="左右分屏"
          className="w-5 h-5 flex items-center justify-center text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-secondary)] text-[10px] rounded">◫</button>
        <button onClick={() => { setNumPanels(2); setSplitDirection('vertical') }} title="上下分屏"
          className="w-5 h-5 flex items-center justify-center text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-secondary)] text-[10px] rounded">◰</button>
        {hasTwo && (
          <button onClick={swapPanels} title="交换面板"
            className="w-5 h-5 flex items-center justify-center text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-secondary)] text-[10px] rounded">⇄</button>
        )}
      </div>

      {panels.map((panel, i) => (
        <div key={panel.id}
          className={`flex flex-col overflow-hidden relative ${i === activePanelIndex && 'ring-1 ring-inset ring-[var(--fg-accent)]'}`}
          style={i === 0 ? sizeStyle : sizeStyle2}
          onClick={() => setActivePanel(i)}
        >
          {/* Panel header */}
          <div className="flex items-center h-8 border-b border-[var(--fg-border)] bg-[var(--fg-card)] px-1 shrink-0">
            <div className="flex-1 flex items-center gap-0">
              {panel.tabs.map(tab => (
                <button key={tab} onClick={() => updatePanelTab(i, tab)}
                  className={`relative px-3 py-1 text-xs font-medium transition-colors ${
                    panel.activeTab === tab
                      ? 'text-[var(--fg-tab-active)]' : 'text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-secondary)]'
                  }`}>
                  {TAB_LABELS[tab]}
                  {panel.activeTab === tab && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--fg-accent)] rounded" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 px-1">
              {hasTwo && (
                <>
                  <button onClick={() => maximizePanel(i)} title="最大化"
                    className="w-5 h-5 flex items-center justify-center text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-secondary)] text-xs rounded">□</button>
                  <button onClick={() => setNumPanels(1)} title="关闭面板"
                    className="w-5 h-5 flex items-center justify-center text-[var(--fg-text-tertiary)] hover:text-[var(--fg-status-error)] text-xs rounded">×</button>
                </>
              )}
            </div>
          </div>
          {/* File tabs (per-panel open files) */}
          {panel.activeTab === 'code' && panel.openFiles.length > 0 && (
            <div className="flex items-center h-7 border-b border-[var(--fg-border)] bg-[var(--fg-card)] px-1 shrink-0 overflow-x-auto gap-0.5">
              {panel.openFiles.map((f) => {
                const name = f.path.split('/').pop() ?? f.path
                const isActive = f.id === panel.activeFileId
                return (
                  <button
                    key={f.id}
                    onClick={() => switchToFile(i, f.id)}
                    className={`group flex items-center gap-1 px-2 py-0.5 text-[11px] rounded whitespace-nowrap shrink-0 transition-colors ${
                      isActive
                        ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]'
                        : 'text-[var(--fg-text-tertiary)] hover:bg-[var(--fg-tree-hover)]'
                    }`}
                  >
                    <span className="max-w-[120px] truncate">{name}</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); closeFile(i, f.id) }}
                      className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-[var(--fg-status-error)] text-[10px] leading-none"
                    >×</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex-1 overflow-hidden">{renderContent(i)}</div>
        </div>
      ))}
      {hasTwo && (
        <div
          onMouseDown={onMouseDown}
          className={isVertical
            ? 'h-1 shrink-0 bg-[var(--fg-border)] hover:bg-[var(--fg-accent)] cursor-row-resize transition-colors z-10'
            : 'w-1 shrink-0 bg-[var(--fg-border)] hover:bg-[var(--fg-accent)] cursor-col-resize transition-colors z-10'
          }
          onDoubleClick={restorePanels}
        />
      )}
    </div>
  )
}
