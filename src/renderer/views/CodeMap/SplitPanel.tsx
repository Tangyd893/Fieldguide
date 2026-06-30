import { useState, useRef, useCallback, useEffect } from 'react'

export type PanelTab = 'graph' | 'code' | 'chat' | 'tour'
export interface PanelState { tabs: PanelTab[]; activeTab: PanelTab }

interface Props {
  renderGraph: () => React.ReactNode
  renderCode: (filePath?: string) => React.ReactNode
  renderChat: () => React.ReactNode
  activeFilePath?: string
  t: (key: string) => string
}

export default function SplitPanel({ renderGraph, renderCode, renderChat, activeFilePath, t }: Props) {
  const [panels, setPanels] = useState<PanelState[]>([{ tabs: ['graph', 'code', 'chat', 'tour'], activeTab: 'graph' }])
  const [splitPos, setSplitPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  const hasTwo = panels.length === 2

  useEffect(() => {
    if (activeFilePath && panels.length === 1) {
      setPanels([{ tabs: ['graph', 'code', 'chat', 'tour'], activeTab: 'graph' }, { tabs: ['graph', 'code', 'chat', 'tour'], activeTab: 'code' }])
      setSplitPos(55)
    } else if (activeFilePath && panels.length === 2 && panels[1].activeTab !== 'code') {
      setPanels(prev => { const n = [...prev]; n[1] = { ...n[1], activeTab: 'code' }; return n })
    }
  }, [activeFilePath])

  const onMouseDown = useCallback(() => {
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setSplitPos(Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100)))
    }
    const onUp = () => {
      document.body.style.cursor = ''; document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [])

  function updatePanel(i: number, tab: PanelTab) {
    setPanels(prev => { const n = [...prev]; n[i] = { ...n[i], activeTab: tab }; return n })
  }

  const TAB_LABELS: Record<PanelTab, string> = { graph: t('panels.graph'), code: t('panels.code'), chat: t('panels.chat'), tour: 'Tour' }

  function renderContent(panel: PanelState, _i: number) {
    switch (panel.activeTab) {
      case 'graph': return renderGraph()
      case 'code': return renderCode(activeFilePath)
      case 'chat': return renderChat()
      case 'tour': return renderTour?.() ?? <div className="p-4 text-gray-400 text-sm">Tour 不可用</div>
    }
  }

  return (
    <div ref={containerRef} className="h-full w-full flex flex-row">
      {panels.map((panel, i) => (
        <div key={i} className="flex flex-col overflow-hidden"
          style={{ width: panels.length === 2 ? (i === 0 ? `${splitPos}%` : `${100 - splitPos}%`) : '100%' }}>
          <div className="flex items-center h-8 border-b border-[var(--fg-border)] bg-[var(--fg-card)] px-1 shrink-0">
            <div className="flex-1 flex items-center gap-0">
              {panel.tabs.map(tab => (
                <button key={tab} onClick={() => updatePanel(i, tab)}
                  className={`relative px-3 py-1 text-xs font-medium transition-colors ${panel.activeTab === tab ? 'text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}>
                  {TAB_LABELS[tab]}
                  {panel.activeTab === tab && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 px-1">
              {!hasTwo && <button onClick={() => { setPanels([...panels, { tabs: ['graph', 'code', 'chat', 'tour'], activeTab: 'code' }]); setSplitPos(50) }}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs rounded" title={t('tooltip.addPanel')}>＋</button>}
              {hasTwo && <button onClick={() => setPanels(panels.filter((_, idx) => idx !== i))}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 text-xs rounded" title={t('tooltip.closePanel')}>×</button>}
            </div>
          </div>
          <div className="flex-1 overflow-hidden">{renderContent(panel, i)}</div>
        </div>
      ))}
      {hasTwo && <div onMouseDown={onMouseDown} className="w-1 shrink-0 bg-[var(--fg-border)] hover:bg-blue-400 cursor-col-resize transition-colors z-10" />}
    </div>
  )
}
