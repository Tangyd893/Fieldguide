import { useState, useEffect, useRef } from 'react'
import { useIndexProgress } from '../../hooks/useIndexProgress'

interface LayerInfo {
  id: string
  name: string
  description: string
  nodeCount: number
}

interface Props {
  t: (key: string) => string
  /** Project root path — changes trigger iframe reload */
  projectRoot?: string
  /** Project ID — used to fetch layers from the graph */
  projectId?: string
  /** Called when the Dashboard sends a message back to the shell */
  onDashboardMessage?: (msg: DashboardMessage) => void
}

/** Messages sent from Dashboard to the shell */
export interface DashboardMessage {
  source: string
  type: string
  nodeId?: string
  step?: number
  total?: number
}

/** Post a command to the Dashboard iframe. Safe to call before iframe loads. */
export function postToDashboard(msg: Record<string, unknown>): void {
  if (_iframeRef) {
    _iframeRef.contentWindow?.postMessage(
      { source: 'fieldguide', ...msg },
      '*',
    )
  }
}

/** Select/highlight a node in the Dashboard graph */
export function dashboardSelectNode(nodeId: string): void {
  postToDashboard({ type: 'selectNode', nodeId })
}

/** Focus on a node's neighborhood in the Dashboard */
export function dashboardFocusNode(nodeId: string): void {
  postToDashboard({ type: 'focusNode', nodeId })
}

/** Navigate the Dashboard to show a specific node */
export function dashboardNavigateToNode(nodeId: string): void {
  postToDashboard({ type: 'navigateToNode', nodeId })
}

/** Start tour playback in the Dashboard */
export function dashboardStartTour(): void {
  postToDashboard({ type: 'startTour' })
}

/** Stop tour playback in the Dashboard */
export function dashboardStopTour(): void {
  postToDashboard({ type: 'stopTour' })
}

/** Jump to a specific tour step in the Dashboard */
export function dashboardSetTourStep(step: number): void {
  postToDashboard({ type: 'setTourStep', step })
}

/** Advance to the next tour step */
export function dashboardNextTourStep(): void {
  postToDashboard({ type: 'nextTourStep' })
}

/** Go back to the previous tour step */
export function dashboardPrevTourStep(): void {
  postToDashboard({ type: 'prevTourStep' })
}

/** Drill into a specific layer in the Dashboard graph */
export function dashboardDrillIntoLayer(layerId: string): void {
  postToDashboard({ type: 'drillIntoLayer', layerId })
}

/** Switch the Dashboard view mode */
export function dashboardSetViewMode(mode: 'structural' | 'domain' | 'knowledge'): void {
  postToDashboard({ type: 'setViewMode', mode })
}

/** Navigate back to the overview (layer clusters) */
export function dashboardNavigateToOverview(): void {
  postToDashboard({ type: 'navigateToOverview' })
}

// Module-level iframe reference — set by GraphPanel on mount
let _iframeRef: HTMLIFrameElement | null = null

export default function GraphPanel({ t, projectRoot, projectId, onDashboardMessage }: Props) {
  const [dashboardUrl, setDashboardUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const [layers, setLayers] = useState<LayerInfo[]>([])
  const [activeLayer, setActiveLayer] = useState<string | null>(null)
  const [iframeLoading, setIframeLoading] = useState(true)

  // Auto-refresh when index completes
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

  // Keep module-level ref in sync
  useEffect(() => {
    _iframeRef = iframeRef.current
    return () => { _iframeRef = null }
  }, [iframeKey])

  // Listen for messages from Dashboard
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

  // Reload iframe when project changes
  const prevRoot = useRef(projectRoot)
  useEffect(() => {
    if (projectRoot && projectRoot !== prevRoot.current) {
      prevRoot.current = projectRoot
      setIframeKey(k => k + 1)
      setIframeLoading(true)
      setActiveLayer(null)
    }
  }, [projectRoot])

  // Fetch layers from the graph
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

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--fg-text-tertiary)] text-sm">{t('codeMap.dashboardLoading')}</div>
  if (!dashboardUrl) return <div className="h-full flex items-center justify-center text-[var(--fg-text-tertiary)] text-sm">{t('codeMap.dashboardUnavailable')}</div>

  return (
    <div className="h-full flex flex-col">
      {/* Layer bar */}
      {layers.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--fg-border)] bg-[var(--fg-card)] shrink-0 overflow-x-auto">
          <button
            onClick={() => { dashboardNavigateToOverview(); setActiveLayer(null) }}
            className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap transition-colors ${
              !activeLayer ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] font-medium' : 'text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]'
            }`}
          >
            📐 总览
          </button>
          {layers.map(l => (
            <button
              key={l.id}
              onClick={() => { dashboardDrillIntoLayer(l.id); setActiveLayer(l.id) }}
              title={`${l.description} (${l.nodeCount} nodes)`}
              className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                activeLayer === l.id ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] font-medium' : 'text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]'
              }`}
            >
              {l.name}
              <span className="ml-1 text-[var(--fg-text-tertiary)]">{l.nodeCount}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* Skeleton while iframe loads */}
      {iframeLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--fg-bg)] mt-8 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--fg-accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[var(--fg-text-tertiary)]">加载图谱…</span>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        key={iframeKey}
        src={dashboardUrl}
        className="w-full flex-1 border-0"
        title="UA Dashboard"
        onLoad={() => {
          setIframeLoading(false)
          const rootStyle = getComputedStyle(document.documentElement)
          postToDashboard({
            type: 'setTheme',
            colors: {
              background: rootStyle.getPropertyValue('--fg-bg').trim(),
              accent: rootStyle.getPropertyValue('--fg-accent').trim(),
              text: rootStyle.getPropertyValue('--fg-text-primary').trim(),
              muted: rootStyle.getPropertyValue('--fg-text-secondary').trim(),
              card: rootStyle.getPropertyValue('--fg-card').trim(),
              border: rootStyle.getPropertyValue('--fg-border').trim(),
            },
          })
        }}
        style={iframeLoading ? { visibility: 'hidden', position: 'absolute' } : undefined}
      />
    </div>
  )
}
