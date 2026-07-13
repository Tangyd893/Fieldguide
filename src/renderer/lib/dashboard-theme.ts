import { postToDashboard } from '@/lib/dashboard-bridge'

/** Collect shell theme tokens for UA Dashboard iframe sync. */
export function collectDashboardThemeColors(): Record<string, string> {
  const rootStyle = getComputedStyle(document.documentElement)
  const bodyStyle = getComputedStyle(document.body)
  const pick = (name: string) => rootStyle.getPropertyValue(name).trim()

  return {
    background: pick('--fg-bg'),
    card: pick('--fg-card'),
    border: pick('--fg-border'),
    text: pick('--fg-text-primary'),
    muted: pick('--fg-text-secondary'),
    tertiary: pick('--fg-text-tertiary'),
    accent: pick('--fg-accent'),
    accentMuted: pick('--fg-accent-muted'),
    accentText: pick('--fg-accent-text'),
    treeHover: pick('--fg-tree-hover'),
    treeSelected: pick('--fg-tree-selected'),
    scrollbarThumb: pick('--fg-scrollbar-thumb'),
    fontUi: bodyStyle.getPropertyValue('--fg-font-ui').trim() || 'Segoe UI',
    fontMono: bodyStyle.getPropertyValue('--fg-font-mono').trim() || 'Cascadia Code',
    preset: document.documentElement.dataset.themePreset || 'parchment',
    mode: document.documentElement.dataset.theme || 'system',
  }
}

/** Push current shell theme to embedded UA Dashboard. */
export function syncDashboardTheme(): void {
  postToDashboard({
    type: 'setTheme',
    chromeless: true,
    colors: collectDashboardThemeColors(),
  })
}
