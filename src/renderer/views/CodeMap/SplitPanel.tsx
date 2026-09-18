import { useRef, useCallback, type CSSProperties, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { useWorkspaceLayout, type PanelTab } from '../../hooks/useWorkspaceLayout'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { beginResizeDrag } from '@/lib/resize-drag'

interface Props {
  renderGraph: () => ReactNode
  renderCode: (filePath?: string) => ReactNode
  renderChat: () => ReactNode
  renderTour?: () => ReactNode
  renderOverview?: () => ReactNode
  renderKnowledge?: () => ReactNode
  renderInterview?: () => ReactNode
  renderExplore?: () => ReactNode
  t: (key: string) => string
  layout: ReturnType<typeof useWorkspaceLayout>
  /** When true, layout buttons live in the title bar instead. */
  hideChromeControls?: boolean
}

export default function SplitPanel({
  renderGraph,
  renderCode,
  renderChat,
  renderTour,
  renderOverview,
  renderKnowledge,
  renderInterview,
  renderExplore,
  t,
  layout: ctrl,
  hideChromeControls,
}: Props) {
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

  const onMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    beginResizeDrag({
      cursor: isVertical ? 'row-resize' : 'col-resize',
      onMove: (ev) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const pct = isVertical
          ? ((ev.clientY - rect.top) / rect.height) * 100
          : ((ev.clientX - rect.left) / rect.width) * 100
        setPos(Math.max(20, Math.min(80, pct)))
      },
    })
  }, [isVertical, setPos])

  const TAB_LABELS: Record<PanelTab, string> = {
    overview: t('panels.overview'),
    graph: t('panels.graph'),
    code: t('panels.code'),
    chat: t('panels.chat'),
    tour: t('panels.tour'),
    knowledge: t('panels.knowledge'),
    interview: t('panels.interview'),
    explore: t('panels.explore'),
  }

  function renderContent(panelIndex: number) {
    const panel = panels[panelIndex]
    if (!panel) return null
    switch (panel.activeTab) {
      case 'overview':
        return renderOverview?.() ?? <div className="p-4 text-[var(--fg-text-tertiary)] text-sm">{t('panels.overviewUnavailable')}</div>
      case 'graph': return renderGraph()
      case 'code': return renderCode(panel.filePath)
      case 'chat': return renderChat()
      case 'tour': return renderTour?.() ?? <div className="p-4 text-[var(--fg-text-tertiary)] text-sm">{t('panels.tourUnavailable')}</div>
      case 'knowledge':
        return renderKnowledge?.() ?? <div className="p-4 text-[var(--fg-text-tertiary)] text-sm">{t('panels.knowledgeUnavailable')}</div>
      case 'interview':
        return renderInterview?.() ?? <div className="p-4 text-[var(--fg-text-tertiary)] text-sm">{t('panels.interviewUnavailable')}</div>
      case 'explore':
        return renderExplore?.() ?? <div className="p-4 text-[var(--fg-text-tertiary)] text-sm">{t('panels.exploreUnavailable')}</div>
    }
  }

  const panelStyle = (index: number): CSSProperties => {
    if (!hasTwo) return { width: '100%', height: '100%' }
    const pct = index === 0 ? splitPos : 100 - splitPos
    return isVertical
      ? { width: '100%', height: `${pct}%` }
      : { width: `${pct}%`, height: '100%' }
  }

  const divider = hasTwo ? (
    <div
      role="separator"
      aria-orientation={isVertical ? 'horizontal' : 'vertical'}
      aria-label={t('split.resizeHint')}
      aria-valuenow={Math.round(splitPos)}
      aria-valuemin={20}
      aria-valuemax={80}
      tabIndex={0}
      onMouseDown={onMouseDown}
      onDoubleClick={restorePanels}
      onKeyDown={(e) => {
        // ui-spec §368: the separator must be operable without a pointer.
        const step = e.shiftKey ? 10 : 2
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          setPos(Math.max(20, splitPos - step))
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          setPos(Math.min(80, splitPos + step))
        } else if (e.key === 'Home') {
          e.preventDefault()
          setPos(20)
        } else if (e.key === 'End') {
          e.preventDefault()
          setPos(80)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          restorePanels()
        }
      }}
      title={t('split.resizeHint')}
      className={cn(
        'group shrink-0 z-20 flex items-center justify-center transition-colors duration-150',
        isVertical
          ? 'h-1.5 cursor-row-resize bg-[var(--fg-chrome-border,var(--fg-border))] hover:bg-[var(--fg-accent-muted)]'
          : 'w-1.5 cursor-col-resize bg-[var(--fg-chrome-border,var(--fg-border))] hover:bg-[var(--fg-accent-muted)]',
      )}
    >
      <div
        className={cn(
          'rounded-full bg-[var(--fg-text-tertiary)] opacity-0 group-hover:opacity-50 transition-opacity',
          isVertical ? 'h-0.5 w-10' : 'w-0.5 h-10',
        )}
      />
    </div>
  ) : null

  return (
    <div ref={containerRef} className={cn('h-full w-full flex relative', isVertical ? 'flex-col' : 'flex-row')}>
      {!hideChromeControls && (
        <div className="absolute top-0 right-0 flex items-center gap-0.5 px-2 py-1 z-20" role="toolbar" aria-label={t('split.controls')}>
          <Button variant="ghost" size="icon-sm" onClick={() => setNumPanels(1)} title={t('split.singlePanel')} aria-label={t('split.singlePanel')} aria-pressed={!hasTwo} className="text-[10px]">▣</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => { setNumPanels(2); setSplitDirection('horizontal') }} title={t('split.horizontal')} aria-label={t('split.horizontal')} aria-pressed={hasTwo && !isVertical} className="text-[10px]">◫</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => { setNumPanels(2); setSplitDirection('vertical') }} title={t('split.vertical')} aria-label={t('split.vertical')} aria-pressed={hasTwo && isVertical} className="text-[10px]">◰</Button>
          {hasTwo && (
            <Button variant="ghost" size="icon-sm" onClick={swapPanels} title={t('split.swap')} aria-label={t('split.swap')} className="text-[10px]">⇄</Button>
          )}
        </div>
      )}

      {panels[0] && (
        <PanelChrome
          panel={panels[0]}
          isActive={activePanelIndex === 0}
          style={panelStyle(0)}
          tabLabels={TAB_LABELS}
          t={t}
          hasTwo={hasTwo}
          renderContent={() => renderContent(0)}
          onActivate={() => setActivePanel(0)}
          onTabChange={(tab) => updatePanelTab(0, tab)}
          onMaximize={() => maximizePanel(0)}
          onClosePanel={() => setNumPanels(1)}
          onSwitchFile={(id) => switchToFile(0, id)}
          onCloseFile={(id) => closeFile(0, id)}
        />
      )}

      {divider}

      {panels[1] && (
        <PanelChrome
          panel={panels[1]}
          isActive={activePanelIndex === 1}
          style={panelStyle(1)}
          tabLabels={TAB_LABELS}
          t={t}
          hasTwo={hasTwo}
          renderContent={() => renderContent(1)}
          onActivate={() => setActivePanel(1)}
          onTabChange={(tab) => updatePanelTab(1, tab)}
          onMaximize={() => maximizePanel(1)}
          onClosePanel={() => setNumPanels(1)}
          onSwitchFile={(id) => switchToFile(1, id)}
          onCloseFile={(id) => closeFile(1, id)}
        />
      )}
    </div>
  )
}

function PanelChrome({
  panel, isActive, style, tabLabels, hasTwo, renderContent, t,
  onActivate, onTabChange, onMaximize, onClosePanel, onSwitchFile, onCloseFile,
}: {
  panel: ReturnType<typeof useWorkspaceLayout>['layout']['panels'][number]
  isActive: boolean
  style: CSSProperties
  tabLabels: Record<PanelTab, string>
  hasTwo: boolean
  renderContent: () => ReactNode
  t: (key: string, opts?: Record<string, unknown>) => string
  onActivate: () => void
  onTabChange: (tab: PanelTab) => void
  onMaximize: () => void
  onClosePanel: () => void
  onSwitchFile: (fileId: string) => void
  onCloseFile: (fileId: string) => void
}) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden relative transition-[box-shadow,border-color] duration-150 shrink-0 bg-[var(--fg-bg)]',
        isActive && 'ring-1 ring-inset ring-[var(--fg-accent)]/40',
      )}
      style={style}
      onClick={onActivate}
    >
      <div className="flex items-center h-8 border-b border-[var(--fg-border)] bg-[var(--fg-panel-chrome,var(--fg-card))] px-1 shrink-0" data-fg-surface>
        <Tabs value={panel.activeTab} onValueChange={(v) => onTabChange(v as PanelTab)} className="flex-1 min-w-0">
          <TabsList className="h-8 bg-transparent p-0 gap-0 w-full justify-start overflow-x-auto">
            {panel.tabs.map(tab => (
              <TabsTrigger key={tab} value={tab} className="h-7 px-2.5 text-[11px] rounded-none shrink-0">
                {tabLabels[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-0.5 px-1">
          {hasTwo && (
            <>
              <Button variant="ghost" size="icon-sm" onClick={onMaximize} title={t('split.maximizePanel')} aria-label={t('split.maximizePanel')} className="text-xs">□</Button>
              <Button variant="ghost" size="icon-sm" onClick={onClosePanel} title={t('split.closePanel')} aria-label={t('split.closePanel')} className="text-xs hover:text-[var(--fg-status-error)]">×</Button>
            </>
          )}
        </div>
      </div>

      {panel.activeTab === 'code' && panel.openFiles.length > 0 && (
        <div className="flex items-center h-8 border-b border-[var(--fg-border)] bg-[var(--fg-panel-chrome,var(--fg-card))] px-1 shrink-0 overflow-x-auto gap-0">
          {panel.openFiles.map((f) => {
            const name = f.path.split('/').pop() ?? f.path
            const isFileActive = f.id === panel.activeFileId
            return (
              <button
                key={f.id}
                onClick={() => onSwitchFile(f.id)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    onCloseFile(f.id)
                  }
                }}
                aria-current={isFileActive}
                title={f.path}
                className={cn(
                  'group flex items-center gap-1 px-3 py-1 text-[11px] whitespace-nowrap shrink-0 transition-colors duration-150 border-b-2 -mb-px',
                  isFileActive
                    ? 'border-[var(--fg-accent)] text-[var(--fg-accent-text)] bg-[var(--fg-bg)] font-medium'
                    : 'border-transparent text-[var(--fg-text-tertiary)] hover:bg-[var(--fg-tree-hover)] hover:text-[var(--fg-text-secondary)]',
                )}
              >
                <span className="max-w-[120px] truncate">{name}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={t('split.closeFile')}
                  title={t('split.closeFile')}
                  onClick={(e) => { e.stopPropagation(); onCloseFile(f.id) }}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-[var(--fg-status-error)] text-[10px] leading-none"
                >×</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  )
}
