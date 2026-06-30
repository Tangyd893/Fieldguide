import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  t: (key: string) => string
  /** Project root path — changes trigger iframe reload */
  projectRoot?: string
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

// Module-level iframe reference — set by GraphPanel on mount
let _iframeRef: HTMLIFrameElement | null = null

export default function GraphPanel({ t, projectRoot, onDashboardMessage }: Props) {
  const [dashboardUrl, setDashboardUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)

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

  // Reload iframe when project changes (so Dashboard picks up new knowledge-graph.json)
  const prevRoot = useRef(projectRoot)
  useEffect(() => {
    if (projectRoot && projectRoot !== prevRoot.current) {
      prevRoot.current = projectRoot
      setIframeKey(k => k + 1)
    }
  }, [projectRoot])

  if (loading) return <div className="h-full flex items-center justify-center text-gray-400 text-sm">{t('codeMap.dashboardLoading')}</div>
  if (!dashboardUrl) return <div className="h-full flex items-center justify-center text-gray-400 text-sm">{t('codeMap.dashboardUnavailable')}</div>

  return <iframe ref={iframeRef} key={iframeKey} src={dashboardUrl} className="w-full h-full border-0" title="UA Dashboard" />
}
