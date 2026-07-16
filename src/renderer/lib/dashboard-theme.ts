import { postToDashboard, postToDashboardWindow } from '@/lib/dashboard-bridge'

/** Collect shell theme tokens for UA Dashboard iframe sync. */
export function collectDashboardThemeColors(): Record<string, string> {
  const rootStyle = getComputedStyle(document.documentElement)
  const bodyStyle = getComputedStyle(document.body)
  const pick = (name: string, fallback = '') =>
    rootStyle.getPropertyValue(name).trim() || fallback

  // Fallbacks matter: empty --fg-bg + UA default (#0a0a0a) reads as a "dead" black canvas.
  const background = pick('--fg-bg', '#fafafa')
  let mode = document.documentElement.dataset.theme || 'system'
  // Resolve to light|dark for UA (it only understands those)
  if (mode !== 'light' && mode !== 'dark') {
    const hex = background.replace('#', '')
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      mode = lum < 0.45 ? 'dark' : 'light'
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      mode = 'dark'
    } else {
      mode = 'light'
    }
  }

  return {
    background,
    card: pick('--fg-card', '#ffffff'),
    border: pick('--fg-border', '#e5e7eb'),
    text: pick('--fg-text-primary', '#111827'),
    muted: pick('--fg-text-secondary', '#6b7280'),
    tertiary: pick('--fg-text-tertiary', '#9ca3af'),
    accent: pick('--fg-accent', '#2563eb'),
    accentMuted: pick('--fg-accent-muted', '#dbeafe'),
    accentText: pick('--fg-accent-text', '#1d4ed8'),
    treeHover: pick('--fg-tree-hover', '#f3f4f6'),
    treeSelected: pick('--fg-tree-selected', '#e4e6f1'),
    scrollbarThumb: pick('--fg-scrollbar-thumb', '#d1d5db'),
    fontUi: bodyStyle.getPropertyValue('--fg-font-ui').trim() || 'Segoe UI',
    fontMono: bodyStyle.getPropertyValue('--fg-font-mono').trim() || 'Cascadia Code',
    preset: document.documentElement.dataset.themePreset || 'parchment',
    mode,
  }
}

/** Push current shell theme to embedded UA Dashboard. */
export function syncDashboardTheme(win?: Window | null): void {
  const payload = {
    type: 'setTheme',
    chromeless: true,
    colors: collectDashboardThemeColors(),
  }
  if (win) {
    postToDashboardWindow(win, payload)
  } else {
    postToDashboard(payload)
  }
}

/**
 * Theme + chromeless after iframe load. Retries briefly so React/Zustand
 * inside UA Dashboard has time to mount (first paint is otherwise bare black).
 */
export function syncDashboardThemeAfterLoad(win: Window | null | undefined): void {
  if (!win) return
  const run = () => {
    syncDashboardTheme(win)
    postToDashboardWindow(win, { type: 'setChromeless', chromeless: true })
  }
  run()
  // UA boots async; re-apply so text/contrast land before ELK finishes.
  window.setTimeout(run, 200)
  window.setTimeout(run, 800)
  window.setTimeout(run, 2000)
}
