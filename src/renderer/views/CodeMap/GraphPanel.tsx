/**
 * GraphPanel — UA Dashboard iframe embed.
 * ui-spec v0.4 §3.2.3
 */
import { useState, useEffect } from 'react'

export default function GraphPanel() {
  const [dashboardUrl, setDashboardUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.fieldguide.dashboardUrl?.()
      .then(setDashboardUrl)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        加载 Dashboard…
      </div>
    )
  }

  if (!dashboardUrl) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Dashboard 不可用 — 请确保已构建 UA Dashboard
      </div>
    )
  }

  return (
    <iframe
      src={dashboardUrl}
      className="w-full h-full border-0"
      title="UA Dashboard"
    />
  )
}
