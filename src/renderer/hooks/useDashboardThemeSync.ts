import { useEffect } from 'react'
import { syncDashboardTheme } from '@/lib/dashboard-theme'

/**
 * Re-sync UA Dashboard theme when shell tokens change.
 *
 * The shell's own colors are driven by CSS (`@media (prefers-color-scheme: dark)`),
 * so the browser restyles them automatically when the OS theme flips — but the
 * embedded Dashboard reads token *values* through JS and would keep the old
 * palette. We mirror the OS preference onto a data attribute so the observer
 * (and any future consumer) sees the change.
 */
export function useDashboardThemeSync(): void {
  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      syncDashboardTheme()
    })
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-preset', 'data-system-theme', 'style'],
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style'],
    })

    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const applySystemTheme = () => {
      root.dataset.systemTheme = media?.matches ? 'dark' : 'light'
    }
    if (media) {
      applySystemTheme()
      media.addEventListener('change', applySystemTheme)
    }

    return () => {
      media?.removeEventListener('change', applySystemTheme)
      observer.disconnect()
    }
  }, [])
}
