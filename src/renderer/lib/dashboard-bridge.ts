/** Messages sent from Dashboard to the shell */
export interface DashboardMessage {
  source: string
  type: string
  nodeId?: string
  filePath?: string
  step?: number
  total?: number
  /** layoutStatus */
  busy?: boolean
  nodeCount?: number
  renderedNodes?: number
  reason?: 'layout' | 'no-layers' | 'ready'
  layerCount?: number
}

let _iframeRef: HTMLIFrameElement | null = null

export function setDashboardIframeRef(ref: HTMLIFrameElement | null): void {
  _iframeRef = ref
}

/** Post a command to the Dashboard iframe. Safe to call before iframe loads. */
export function postToDashboard(msg: Record<string, unknown>): void {
  const win = _iframeRef?.contentWindow
  if (win) {
    win.postMessage({ source: 'fieldguide', ...msg }, '*')
  }
}

/**
 * Post directly to an iframe's contentWindow (use from onLoad so we don't
 * race the React effect that registers `_iframeRef`).
 */
export function postToDashboardWindow(
  win: Window | null | undefined,
  msg: Record<string, unknown>,
): void {
  if (win) {
    win.postMessage({ source: 'fieldguide', ...msg }, '*')
  }
}

export function dashboardSelectNode(nodeId: string): void {
  postToDashboard({ type: 'selectNode', nodeId })
}

export function dashboardFocusNode(nodeId: string): void {
  postToDashboard({ type: 'focusNode', nodeId })
}

export function dashboardNavigateToNode(nodeId: string): void {
  postToDashboard({ type: 'navigateToNode', nodeId })
}

export function dashboardStartTour(): void {
  postToDashboard({ type: 'startTour' })
}

export function dashboardStopTour(): void {
  postToDashboard({ type: 'stopTour' })
}

export function dashboardSetTourStep(step: number): void {
  postToDashboard({ type: 'setTourStep', step })
}

export function dashboardNextTourStep(): void {
  postToDashboard({ type: 'nextTourStep' })
}

export function dashboardPrevTourStep(): void {
  postToDashboard({ type: 'prevTourStep' })
}

export function dashboardDrillIntoLayer(layerId: string): void {
  postToDashboard({ type: 'drillIntoLayer', layerId })
}

export function dashboardSetViewMode(mode: 'structural' | 'domain' | 'knowledge'): void {
  postToDashboard({ type: 'setViewMode', mode })
}

export function dashboardNavigateToOverview(): void {
  postToDashboard({ type: 'navigateToOverview' })
}

export function dashboardViewportZoomIn(): void {
  postToDashboard({ type: 'viewportZoomIn' })
}

export function dashboardViewportZoomOut(): void {
  postToDashboard({ type: 'viewportZoomOut' })
}

export function dashboardViewportZoomReset(): void {
  postToDashboard({ type: 'viewportZoomReset' })
}
