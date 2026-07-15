/**
 * VS Code–style activity bar — primary module navigation.
 */
import type { ReactNode } from 'react'
import {
  BookOpen,
  FolderKanban,
  GitBranch,
  Link2,
  Settings as SettingsIcon,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ShellModule = 'library' | 'codemap' | 'theory' | 'bridge' | 'settings'

interface Item {
  id: ShellModule
  icon: ReactNode
  label: string
  disabled?: boolean
}

interface Props {
  active: ShellModule
  onChange: (id: ShellModule) => void
  items: Item[]
  settingsLabel: string
}

export default function ActivityBar({ active, onChange, items, settingsLabel }: Props) {
  const primary = items.filter((i) => i.id !== 'settings')
  const settings = items.find((i) => i.id === 'settings')

  return (
    <nav
      className="w-12 shrink-0 flex flex-col items-center py-2 gap-1 border-r border-[var(--fg-border)] bg-[var(--fg-card)] select-none"
      aria-label="Activity bar"
      data-fg-surface
    >
      {primary.map((item) => (
        <ActivityButton
          key={item.id}
          item={item}
          active={active === item.id}
          onClick={() => onChange(item.id)}
        />
      ))}
      <div className="flex-1" />
      {settings && (
        <ActivityButton
          item={{ ...settings, label: settingsLabel || settings.label, icon: <SettingsIcon size={20} /> }}
          active={active === 'settings'}
          onClick={() => onChange('settings')}
        />
      )}
    </nav>
  )
}

function ActivityButton({
  item,
  active,
  onClick,
}: {
  item: Item
  active: boolean
  onClick: () => void
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={item.disabled}
          onClick={onClick}
          aria-label={item.label}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative w-10 h-10 flex items-center justify-center rounded-md transition-colors',
            'text-[var(--fg-text-secondary)] hover:text-[var(--fg-text-primary)] hover:bg-[var(--fg-tree-hover)]',
            'disabled:opacity-35 disabled:pointer-events-none',
            active && 'text-[var(--fg-accent-text)] bg-[var(--fg-accent-muted)]',
          )}
        >
          {active && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-[var(--fg-accent)]" />
          )}
          {item.icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

export function defaultActivityIcons(): Record<Exclude<ShellModule, 'settings'>, ReactNode> {
  return {
    library: <FolderKanban size={20} />,
    codemap: <GitBranch size={20} />,
    theory: <BookOpen size={20} />,
    bridge: <Link2 size={20} />,
  }
}
