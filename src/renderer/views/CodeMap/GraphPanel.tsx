import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { useIndexProgress } from '../../hooks/useIndexProgress'
import {
  type DashboardMessage,
  setDashboardIframeRef,
  postToDashboard,
  dashboardDrillIntoLayer,
  dashboardNavigateToOverview,
  dashboardSetViewMode,
} from '@/lib/dashboard-bridge'
import { syncDashboardTheme } from '@/lib/dashboard-theme'

export type { DashboardMessage }
export {
  postToDashboard,
  dashboardSelectNode,
  dashboardFocusNode,
  dashboardNavigateToNode,
  dashboardStartTour,
  dashboardStopTour,
  dashboardSetTourStep,
  dashboardNextTourStep,
  dashboardPrevTourStep,
  dashboardDrillIntoLayer,
  dashboardSetViewMode,
  dashboardNavigateToOverview,
} from '@/lib/dashboard-bridge'

interface LayerInfo {
  id: string
  name: string
  description: string
  nodeCount: number
}

interface Props {
  t: (key: string) => string
  projectRoot?: string
  projectId?: string
  onDashboardMessage?: (msg: DashboardMessage) => void
}

export default function GraphPanel({ t, projectRoot, projectId, onDashboardMessage }: Props) {
  const [dashboardUrl, setDashboardUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const [layers, setLayers] = useState<LayerInfo[]>([])
  const [activeLayer, setActiveLayer] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'structural' | 'domain' | 'knowledge'>('structural')
  const [iframeLoading, setIframeLoading] = useState(true)

  const [graphEmpty, setGraphEmpty] = useState(false)

  const idxProgress = useIndexProgress(projectId)
  const prevComplete = useRef(false)
  useEffect(() => {
    if (idxProgress.progress?.type === 'complete') {
      if (!prevComplete.current) {
        prevComplete.current = true
        setIframeKey(k => k + 1)
        setIframeLoading(true)
      }
    } else {
      prevComplete.current = false
    }
  }, [idxProgress.progress?.type])

  useEffect(() => {
    window.fieldguide.dashboardUrl?.().then(setDashboardUrl).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setDashboardIframeRef(iframeRef.current)
    return () => { setDashboardIframeRef(null) }
  }, [iframeKey])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as DashboardMessage | undefined
      if (data && data.source === 'ua-dashboard') {
        onDashboardMessage?.(data)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onDashboardMessage])

  const prevRoot = useRef(projectRoot)
  useEffect(() => {
    if (projectRoot && projectRoot !== prevRoot.current) {
      prevRoot.current = projectRoot
      setIframeKey(k => k + 1)
      setIframeLoading(true)
      setActiveLayer(null)
    }
  }, [projectRoot])

  useEffect(() => {
    if (!projectId) return
    window.fieldguide.graphGet?.(projectId).then((result) => {
      if (result.ok && result.data) {
        const graph = result.data as { layers?: Array<{ id: string; name: string; description: string; nodeIds: string[] }> }
        const graphLayers = (graph.layers || []).map(l => ({
          id: l.id,
          name: l.name,
          description: l.description || '',
          nodeCount: (l.nodeIds || []).length,
        }))
        setLayers(graphLayers)
      }
    }).catch(() => { /* layers are optional */ })
  }, [projectId, iframeKey])

  useEffect(() => {
    if (!projectId) {
      setGraphEmpty(false)
      return
    }
    window.fieldguide.graphGet?.(projectId).then((result) => {
      if (result.ok && result.data) {
        const graph = result.data as { nodes?: unknown[] }
        setGraphEmpty(!graph.nodes?.length)
      } else {
        setGraphEmpty(true)
      }
    }).catch(() => setGraphEmpty(true))
  }, [projectId, iframeKey])

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--fg-text-tertiary)] text-sm">{t('codeMap.dashboardLoading')}</div>
  if (!dashboardUrl) return <div className="h-full flex items-center justify-center text-[var(--fg-text-tertiary)] text-sm">{t('codeMap.dashboardUnavailable')}</div>
  if (idxProgress.isIndexing) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-[var(--fg-text-tertiary)] text-sm bg-[var(--fg-bg)]" data-fg-surface>
        <div className="w-8 h-8 border-2 border-[var(--fg-accent)] border-t-transparent rounded-full animate-spin" />
        <span>{t('codeMap.graphIndexing')}</span>
      </div>
    )
  }
  if (graphEmpty) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center bg-[var(--fg-bg)]" data-fg-surface>
        <p className="text-sm text-[var(--fg-text-secondary)]">{t('codeMap.graphEmpty')}</p>
        <p className="text-xs text-[var(--fg-text-tertiary)]">{t('codeMap.graphEmptyHint')}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col relative bg-[var(--fg-bg)]" data-fg-surface>
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0">
        {(['structural', 'domain', 'knowledge'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => {
              setViewMode(mode)
              dashboardSetViewMode(mode)
              if (mode === 'structural') {
                dashboardNavigateToOverview()
                setActiveLayer(null)
              }
            }}
            className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap transition-colors duration-150 ${
              viewMode === mode ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] font-medium' : 'text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]'
            }`}
          >
            {t(`graph.viewMode.${mode}`)}
          </button>
        ))}
      </div>
      {layers.length > 0 && viewMode === 'structural' && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0 overflow-x-auto">
          <button
            onClick={() => { dashboardNavigateToOverview(); setActiveLayer(null) }}
            className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap transition-colors duration-150 ${
              !activeLayer ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] font-medium' : 'text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]'
            }`}
          >
            {t('graph.overview')}
          </button>
          {layers.map(l => (
            <button
              key={l.id}
              onClick={() => { dashboardDrillIntoLayer(l.id); setActiveLayer(l.id) }}
              title={`${l.description} (${l.nodeCount} nodes)`}
              className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap transition-colors duration-150 ${
                activeLayer === l.id ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] font-medium' : 'text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]'
              }`}
            >
              {l.name}
              <span className="ml-1 text-[var(--fg-text-tertiary)]">{l.nodeCount}</span>
            </button>
          ))}
        </div>
      )}

      {iframeLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--fg-bg)] z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--fg-accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[var(--fg-text-tertiary)]">{t('codeMap.dashboardLoading')}</span>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        key={iframeKey}
        src={dashboardUrl}
        className="w-full flex-1 border-0 bg-[var(--fg-bg)] origin-top-left"
        title="UA Dashboard"
        onLoad={() => {
          setIframeLoading(false)
          syncDashboardTheme()
          postToDashboard({ type: 'setChromeless', chromeless: true })
        }}
        style={{
          visibility: iframeLoading ? 'hidden' : undefined,
          // Chromium CSS zoom — independent of shell rem zoom
          ...({ zoom: 'var(--fg-dashboard-zoom, 1)' } as CSSProperties),
        }}
      />
    </div>
  )
}
