/**
 * Path input with native folder picker — used in onboarding, settings, project library.
 */
import { FolderOpen } from 'lucide-react'
interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  browseLabel?: string
  autoFocus?: boolean
}

export default function FolderPathField({
  value,
  onChange,
  placeholder,
  disabled,
  browseLabel = '浏览…',
  autoFocus,
}: Props) {
  async function browse() {
    if (disabled) return
    try {
      const result = await window.fieldguide.openFolderDialog()
      if (result?.ok && result.data) onChange(result.data)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="fg-input flex-1 min-w-0 px-3 py-2 border border-[var(--fg-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fg-accent)]"
      />
      <button
        type="button"
        onClick={browse}
        disabled={disabled}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--fg-input-border)] rounded-lg text-sm font-medium text-[var(--fg-text-secondary)] bg-[var(--fg-tree-hover)] hover:bg-[var(--fg-input-border)] disabled:opacity-40 transition-colors"
        title={browseLabel}
      >
        <FolderOpen size={14} />
        {browseLabel}
      </button>
    </div>
  )
}
