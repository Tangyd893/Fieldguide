/**
 * VS Code–style custom title bar (Windows frameless).
 * Hosts File/Edit/View/Help, project switcher, tools, and window controls.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown, Minus, Search, Square, Copy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { useWorkspaceLayout } from '@/hooks/useWorkspaceLayout'

type MenuId = 'file' | 'edit' | 'view' | 'help'

interface Props {
  selectedProject: { id: string; name: string } | null
  projects: Array<{ id: string; name: string }>
  showProjectMenu: boolean
  setShowProjectMenu: (v: boolean) => void
  onSelectProject: (p: { id: string; name: string } | null) => void
  onOpenLibrary: () => void
  onSearch: () => void
  showLayout: boolean
  workspaceLayout: ReturnType<typeof useWorkspaceLayout>
  t: (k: string) => string
  customChrome: boolean
  menuLabels: Record<MenuId, string>
}

const MENU_ORDER: MenuId[] = ['file', 'edit', 'view', 'help']

export default function AppTitleBar({
  selectedProject,
  projects,
  showProjectMenu,
  setShowProjectMenu,
  onSelectProject,
  onOpenLibrary,
  onSearch,
  showLayout,
  workspaceLayout,
  t,
  customChrome,
  menuLabels,
}: Props) {
  const { setNumPanels, setSplitDirection, swapPanels, layout } = workspaceLayout
  const hasTwo = layout.panels.length === 2
  const [maximized, setMaximized] = useState(false)
  const menuRefs = useRef<Partial<Record<MenuId, HTMLButtonElement | null>>>({})

  useEffect(() => {
    if (!customChrome) return
    window.fieldguide.windowIsMaximized().then((r) => {
      if (r.ok && r.data) setMaximized(!!r.data.maximized)
    }).catch(() => {})
    return window.fieldguide.onWindowMaximizeChange(setMaximized)
  }, [customChrome])

  function openMenu(id: MenuId) {
    const el = menuRefs.current[id]
    if (!el) return
    const rect = el.getBoundingClientRect()
    window.fieldguide.menuPopupTopLevel(id, Math.round(rect.left), Math.round(rect.bottom)).catch(() => {})
  }

  const dragStyle = customChrome ? ({ WebkitAppRegion: 'drag' } as CSSProperties) : undefined
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

  return (
    <header
      className={cn(
        'h-9 flex items-center pl-2 border-b border-[var(--fg-chrome-border,var(--fg-border))] bg-[var(--fg-chrome-bg,var(--fg-card))] shrink-0 select-none',
        customChrome ? 'pr-0' : 'pr-2 gap-1',
      )}
      style={dragStyle}
      data-fg-surface
      onDoubleClick={() => {
        if (customChrome) window.fieldguide.windowMaximize().catch(() => {})
      }}
    >
      {customChrome && (
        <div className="flex items-center gap-0.5 shrink-0" style={noDragStyle}>
          {MENU_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              ref={(el) => { menuRefs.current[id] = el }}
              onClick={() => openMenu(id)}
              className="h-7 px-2.5 rounded-sm text-[12px] text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)] hover:text-[var(--fg-text-primary)]"
            >
              {menuLabels[id]}
            </button>
          ))}
        </div>
      )}

      {customChrome && <span className="text-[var(--fg-border)] mx-1.5 shrink-0">·</span>}

      <div className="relative shrink-0" style={noDragStyle}>
        <button
          type="button"
          onClick={() => setShowProjectMenu(!showProjectMenu)}
          className="flex items-center gap-1 max-w-[240px] px-2 py-1 rounded-md text-[12px] hover:bg-[var(--fg-tree-hover)] text-[var(--fg-text-primary)]"
        >
          <span className="truncate">{selectedProject?.name || t('titleBar.noProject')}</span>
          <ChevronDown size={14} className="shrink-0 text-[var(--fg-text-tertiary)]" />
        </button>
        {showProjectMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowProjectMenu(false)} />
            <div className="absolute top-full left-0 mt-1 z-50 min-w-[220px] max-h-64 overflow-auto rounded-lg border border-[var(--fg-border)] bg-[var(--fg-card)] shadow-[var(--fg-dialog-shadow)] py-1">
              {projects.length === 0 ? (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]"
                  onClick={() => { setShowProjectMenu(false); onOpenLibrary() }}
                >
                  {t('titleBar.openLibrary')}
                </button>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm truncate hover:bg-[var(--fg-tree-hover)]',
                      selectedProject?.id === p.id && 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)]',
                    )}
                    onClick={() => onSelectProject(p)}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 min-w-2" />

      <div className="flex items-center gap-0.5 shrink-0" style={noDragStyle}>
        {showLayout && (
          <div className="flex items-center gap-0.5 mr-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setNumPanels(1)} title={t('split.singlePanel')} className="text-[10px]">▣</Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setNumPanels(2); setSplitDirection('horizontal') }} title={t('split.horizontal')} className="text-[10px]">◫</Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setNumPanels(2); setSplitDirection('vertical') }} title={t('split.vertical')} className="text-[10px]">◰</Button>
            {hasTwo && (
              <Button variant="ghost" size="icon-sm" onClick={swapPanels} title={t('split.swap')} className="text-[10px]">⇄</Button>
            )}
          </div>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="icon" size="icon-sm" onClick={onSearch} aria-label={t('tooltip.search')}>
              <Search size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ctrl+K</TooltipContent>
        </Tooltip>
      </div>

      {customChrome && (
        <div className="flex items-stretch h-full ml-1 shrink-0" style={noDragStyle}>
          <WindowBtn
            ariaLabel={t('window.minimize')}
            onClick={() => window.fieldguide.windowMinimize().catch(() => {})}
          >
            <Minus size={14} strokeWidth={1.5} />
          </WindowBtn>
          <WindowBtn
            ariaLabel={maximized ? t('window.restore') : t('window.maximize')}
            onClick={() => window.fieldguide.windowMaximize().catch(() => {})}
          >
            {maximized ? <Copy size={12} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
          </WindowBtn>
          <WindowBtn
            ariaLabel={t('window.close')}
            danger
            onClick={() => window.fieldguide.windowClose().catch(() => {})}
          >
            <X size={14} strokeWidth={1.5} />
          </WindowBtn>
        </div>
      )}
    </header>
  )
}

function WindowBtn({
  children,
  onClick,
  ariaLabel,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  ariaLabel: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'w-[46px] h-full flex items-center justify-center text-[var(--fg-text-secondary)] transition-colors',
        danger
          ? 'hover:bg-[#e81123] hover:text-white'
          : 'hover:bg-[var(--fg-tree-hover)] hover:text-[var(--fg-text-primary)]',
      )}
    >
      {children}
    </button>
  )
}
