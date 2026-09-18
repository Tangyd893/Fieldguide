/**
 * ShortcutsDialog — the keyboard reference the UI never had.
 *
 * The shortcuts were scattered between `menu.ts` accelerators, App's Ctrl+K and
 * the in-pane handlers (Ctrl+F in the code viewer, arrow keys on the split
 * separator), so this dialog is also the place that documents the newer ones.
 */
import { Dialog, DialogContent, DialogTitle, DialogCloseButton } from '@/components/ui/dialog'

interface Props {
  open: boolean
  onClose: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

interface Shortcut {
  keys: string
  labelKey: string
}

/** Grouped so the dialog reads as "navigation / panels / view". */
const GROUPS: Array<{ titleKey: string; items: Shortcut[] }> = [
  {
    titleKey: 'shortcuts.groupGlobal',
    items: [
      { keys: 'Ctrl+K', labelKey: 'shortcuts.commandPalette' },
      { keys: 'Ctrl+Shift+F', labelKey: 'shortcuts.contentSearch' },
      { keys: 'Ctrl+O', labelKey: 'shortcuts.openProject' },
      { keys: 'Ctrl+R', labelKey: 'shortcuts.reload' },
      { keys: 'Ctrl+Shift+I', labelKey: 'shortcuts.devtools' },
      { keys: 'Ctrl+Q / Alt+F4', labelKey: 'shortcuts.quit' },
    ],
  },
  {
    titleKey: 'shortcuts.groupView',
    items: [
      { keys: 'Ctrl+=', labelKey: 'shortcuts.zoomIn' },
      { keys: 'Ctrl+-', labelKey: 'shortcuts.zoomOut' },
      { keys: 'Ctrl+0', labelKey: 'shortcuts.zoomReset' },
      { keys: 'Ctrl+滚轮', labelKey: 'shortcuts.zoomWheel' },
    ],
  },
  {
    titleKey: 'shortcuts.groupPanels',
    items: [
      { keys: 'Tab', labelKey: 'shortcuts.panelTabs' },
      { keys: '← →', labelKey: 'shortcuts.separatorResize' },
      { keys: 'Shift+← →', labelKey: 'shortcuts.separatorResizeFast' },
      { keys: 'Home / End', labelKey: 'shortcuts.separatorMinMax' },
      { keys: 'Enter', labelKey: 'shortcuts.separatorReset' },
      { keys: '中键单击页签', labelKey: 'shortcuts.closeTab' },
    ],
  },
  {
    titleKey: 'shortcuts.groupCode',
    items: [
      { keys: 'Ctrl+F', labelKey: 'shortcuts.findInFile' },
      { keys: 'Enter / Shift+Enter', labelKey: 'shortcuts.nextPrevMatch' },
      { keys: 'Esc', labelKey: 'shortcuts.clearFind' },
      { keys: 'Enter', labelKey: 'shortcuts.goToLine' },
    ],
  },
  {
    titleKey: 'shortcuts.groupChat',
    items: [
      { keys: 'Enter', labelKey: 'shortcuts.send' },
      { keys: 'Shift+Enter', labelKey: 'shortcuts.newline' },
    ],
  },
]

export default function ShortcutsDialog({ open, onClose, t }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="w-[560px] max-w-[95vw] p-6 bg-[var(--fg-card)] max-h-[80vh] overflow-auto">
        <div className="flex items-start justify-between mb-4">
          <DialogTitle className="pr-8">{t('shortcuts.title')}</DialogTitle>
          <DialogCloseButton />
        </div>

        <div className="space-y-5">
          {GROUPS.map((group) => (
            <section key={group.titleKey}>
              <h3 className="text-[11px] uppercase tracking-wide text-[var(--fg-text-tertiary)] mb-2">
                {t(group.titleKey)}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.keys + item.labelKey} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[var(--fg-text-secondary)]">{t(item.labelKey)}</span>
                    <kbd className="shrink-0 px-2 py-0.5 rounded border border-[var(--fg-border)] bg-[var(--fg-tree-hover)] font-mono text-[11px] text-[var(--fg-text-primary)]">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
