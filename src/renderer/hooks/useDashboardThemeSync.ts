import { useEffect } from 'react'
import { syncDashboardTheme } from '@/lib/dashboard-theme'

/** Re-sync UA Dashboard theme when shell tokens change. */
export function useDashboardThemeSync(): void {
  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      syncDashboardTheme()
    })
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-preset', 'style'],
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style'],
    })
    return () => observer.disconnect()
  }, [])
}
