/**
 * Path input with native folder picker — used in onboarding, settings, project library.
 */
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
        className="fg-input flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={browse}
        disabled={disabled}
        className="shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 transition-colors"
        title={browseLabel}
      >
        📁 {browseLabel}
      </button>
    </div>
  )
}
