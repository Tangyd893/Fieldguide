/**
 * AboutDialog — 关于 Fieldguide (Phase 4)
 */
import { useState, useEffect } from 'react'

interface Props {
  t: (key: string) => string
  onClose: () => void
}

export default function AboutDialog({ t, onClose }: Props) {
  const [version, setVersion] = useState('0.2.0')

  useEffect(() => {
    window.fieldguide.appVersion().then(v => setVersion(v)).catch(() => {})
  }, [])

  return (
    <>
      <div className="fixed inset-0 bg-[var(--fg-overlay)] z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-[var(--fg-card)] rounded-xl shadow-2xl z-50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--fg-border)]">
          <h2 className="text-lg font-semibold">{t('about.title')}</h2>
          <button onClick={onClose} className="text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-secondary)] text-lg">×</button>
        </div>

        <div className="px-6 py-6 space-y-4 text-center">
          <div className="text-4xl mb-2">🧭</div>
          <h3 className="text-xl font-bold text-[var(--fg-text-primary)]">{t('app.name')}</h3>
          <p className="text-sm text-[var(--fg-text-tertiary)]">v{version}</p>

          <p className="text-sm text-[var(--fg-text-secondary)] leading-relaxed max-w-sm mx-auto">
            {t('about.description')}
          </p>

          <div className="pt-4 space-y-2 text-xs text-[var(--fg-text-tertiary)]">
            <p>{t('about.license')}</p>
            <p>{t('about.uaCredit')}</p>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-[var(--fg-border)]">
          <button onClick={onClose}
            className="px-5 py-2 bg-[var(--fg-accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
            {t('settings.cancel')}
          </button>
        </div>
      </div>
    </>
  )
}
