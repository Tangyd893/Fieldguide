import { useState, useEffect } from 'react'

interface Props { t: (key: string) => string }

export default function GraphPanel({ t }: Props) {
  const [dashboardUrl, setDashboardUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.fieldguide.dashboardUrl?.().then(setDashboardUrl).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="h-full flex items-center justify-center text-gray-400 text-sm">{t('codeMap.dashboardLoading')}</div>
  if (!dashboardUrl) return <div className="h-full flex items-center justify-center text-gray-400 text-sm">{t('codeMap.dashboardUnavailable')}</div>

  return <iframe src={dashboardUrl} className="w-full h-full border-0" title="UA Dashboard" />
}
