/**
 * Appearance helpers — shell/dashboard zoom and UI/code fonts.
 * Shell zoom scales rem-based chrome; dashboard zoom applies only to the UA iframe.
 */

export interface AppearanceState {
  themePreset: string
  shellZoom: number
  dashboardZoom: number
  uiFont: string
  monoFont: string
  uiFontSize: number
  monoFontSize: number
  sidebarWidth: number
}

export const DEFAULT_APPEARANCE: AppearanceState = {
  themePreset: 'parchment',
  shellZoom: 100,
  dashboardZoom: 100,
  uiFont: 'Segoe UI',
  monoFont: 'Cascadia Code',
  uiFontSize: 14,
  monoFontSize: 13,
  sidebarWidth: 260,
}

/** Normalize raw config appearance (migrates legacy `zoom` → `shellZoom`). */
export function normalizeAppearance(raw?: Record<string, unknown> | null): AppearanceState {
  const r = raw || {}
  const legacyZoom = r.zoom != null ? Number(r.zoom) : undefined
  return {
    themePreset: String(r.themePreset || DEFAULT_APPEARANCE.themePreset),
    shellZoom: clampZoom(Number(r.shellZoom ?? legacyZoom ?? DEFAULT_APPEARANCE.shellZoom)),
    dashboardZoom: clampZoom(Number(r.dashboardZoom ?? DEFAULT_APPEARANCE.dashboardZoom)),
    uiFont: String(r.uiFont || DEFAULT_APPEARANCE.uiFont),
    monoFont: String(r.monoFont || DEFAULT_APPEARANCE.monoFont),
    uiFontSize: clampFontSize(Number(r.uiFontSize ?? DEFAULT_APPEARANCE.uiFontSize)),
    monoFontSize: clampFontSize(Number(r.monoFontSize ?? DEFAULT_APPEARANCE.monoFontSize)),
    sidebarWidth: Math.max(160, Math.min(400, Number(r.sidebarWidth ?? DEFAULT_APPEARANCE.sidebarWidth))),
  }
}

export function clampZoom(n: number): number {
  if (!Number.isFinite(n)) return 100
  return Math.max(50, Math.min(200, Math.round(n)))
}

export function clampFontSize(n: number): number {
  if (!Number.isFinite(n)) return 14
  return Math.max(10, Math.min(28, Math.round(n)))
}

/** Apply shell zoom + UI base size to root rem. Does not affect dashboard iframe document. */
export function applyShellZoom(shellZoom: number, uiFontSize = 14): void {
  const zoom = clampZoom(shellZoom)
  const base = clampFontSize(uiFontSize)
  document.documentElement.style.fontSize = `${(zoom / 100) * base}px`
  document.documentElement.style.setProperty('--fg-shell-zoom', String(zoom / 100))
  document.documentElement.dataset.shellZoom = String(zoom)
}

/** Dashboard iframe zoom (CSS zoom on the iframe element). */
export function applyDashboardZoom(dashboardZoom: number): void {
  const zoom = clampZoom(dashboardZoom)
  document.documentElement.style.setProperty('--fg-dashboard-zoom', String(zoom / 100))
  document.documentElement.dataset.dashboardZoom = String(zoom)
}

export function applyFonts(uiFont: string, monoFont: string, uiFontSize: number, monoFontSize: number): void {
  document.body.style.setProperty('--fg-font-ui', uiFont || DEFAULT_APPEARANCE.uiFont)
  document.body.style.setProperty('--fg-font-mono', `'${monoFont || DEFAULT_APPEARANCE.monoFont}', monospace`)
  const uiSize = clampFontSize(uiFontSize)
  const monoSize = clampFontSize(monoFontSize)
  document.documentElement.style.setProperty('--fg-ui-font-size-px', String(uiSize))
  document.documentElement.style.setProperty('--fg-mono-font-size', `${monoSize}px`)
}

export function applyAppearance(state: AppearanceState): void {
  applyFonts(state.uiFont, state.monoFont, state.uiFontSize, state.monoFontSize)
  applyShellZoom(state.shellZoom, state.uiFontSize)
  applyDashboardZoom(state.dashboardZoom)
}

export async function persistAppearancePatch(patch: Partial<AppearanceState>): Promise<void> {
  const r = await window.fieldguide.configGet()
  if (!r.ok || !r.data) return
  const cfg = r.data as Record<string, unknown>
  const current = normalizeAppearance(cfg.appearance as Record<string, unknown> | undefined)
  const next = { ...current, ...patch }
  await window.fieldguide.configSet({ appearance: next })
}
