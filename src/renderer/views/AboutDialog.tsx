/**
 * AboutDialog — 关于 Fieldguide (Phase 4)
 */
import { useState, useEffect } from 'react'
import { Compass } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogCloseButton } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  t: (key: string) => string
  onClose: () => void
}

export default function AboutDialog({ open, t, onClose }: Props) {
  const [version, setVersion] = useState('0.2.0')

  useEffect(() => {
    window.fieldguide.appVersion().then(v => setVersion(v)).catch(() => {})
  }, [])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="w-[420px] max-w-[95vw] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--fg-border)] bg-[var(--fg-card)]">
          <DialogTitle>{t('about.title')}</DialogTitle>
          <DialogCloseButton />
        </div>

        <div className="px-6 py-6 space-y-4 text-center bg-[var(--fg-card)]">
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 rounded-2xl bg-[var(--fg-accent-muted)] flex items-center justify-center">
              <Compass size={28} className="text-[var(--fg-accent)]" />
            </div>
          </div>
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

        <div className="flex justify-end px-6 py-4 border-t border-[var(--fg-border)] bg-[var(--fg-card)]">
          <Button onClick={onClose}>{t('settings.cancel')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
