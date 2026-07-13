/** Messages sent from Dashboard to the shell */
export interface DashboardMessage {
  source: string
  type: string
  nodeId?: string
  step?: number
  total?: number
}

let _iframeRef: HTMLIFrameElement | null = null

export function setDashboardIframeRef(ref: HTMLIFrameElement | null): void {
  _iframeRef = ref
}

/** Post a command to the Dashboard iframe. Safe to call before iframe loads. */
export function postToDashboard(msg: Record<string, unknown>): void {
  if (_iframeRef) {
    _iframeRef.contentWindow?.postMessage({ source: 'fieldguide', ...msg }, '*')
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
