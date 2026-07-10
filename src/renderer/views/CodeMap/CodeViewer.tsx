import { useState, useEffect } from 'react'
import { detectLanguage, highlightLine } from './syntax'

interface Props { projectId?: string; filePath?: string; t: (key: string, opts?: Record<string, unknown>) => string }

export default function CodeViewer({ projectId, filePath, t }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (!projectId || !filePath) { setContent(''); return }; loadFile() }, [projectId, filePath])

  async function loadFile() {
    if (!projectId || !filePath) return
    setLoading(true); setError(null)
    try {
      const result = await window.fieldguide.fileRead(projectId, filePath)
      if (result.ok && result.data) setContent((result.data as { content: string }).content)
      else setError(result.error?.message ?? t('codeMap.readError'))
    } catch (err) { setError(String(err)) }
    finally { setLoading(false) }
  }

  if (!filePath) return <div className="h-full flex items-center justify-center text-[var(--fg-text-tertiary)] text-sm">{t('codeMap.clickToOpen')}</div>
  if (loading) return <div className="h-full flex items-center justify-center text-[var(--fg-text-tertiary)] text-sm">{t('codeMap.loading')}</div>
  if (error) return <div className="h-full flex items-center justify-center text-red-500 text-sm">{error}</div>

  const lines = content.split('\n')
  const lang = detectLanguage(filePath)
  const langLabel = { go: 'Go', typescript: 'TypeScript', javascript: 'JavaScript', python: 'Python', rust: 'Rust', java: 'Java', plaintext: 'Text' }[lang] ?? lang

  return (
    <div className="h-full overflow-auto bg-[var(--fg-bg)]">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-[var(--fg-card)] border-b border-[var(--fg-border)] text-xs text-[var(--fg-text-tertiary)] font-mono">
        <span className="text-[var(--fg-text-secondary)]">{filePath}</span>
        <span className="px-1.5 py-0.5 rounded bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] text-[11px] font-medium">{langLabel}</span>
        <span className="flex-1" />
        <span>{t('codeMap.lines', { count: lines.length })}</span>
      </div>
      <div className="font-mono text-[13px] leading-5" style={{ fontFamily: 'var(--fg-font-mono)' }}>
        {lines.map((line, i) => (
          <div key={i} className="flex hover:bg-blue-50/30 group">
            <span className="w-12 flex-shrink-0 text-right pr-3 text-[var(--fg-text-tertiary)] select-none text-xs leading-5 py-px border-r border-[var(--fg-border)]">
              {i + 1}
            </span>
            <span className="flex-1 pl-3 whitespace-pre text-[var(--fg-text-primary)] py-px min-w-0 overflow-x-auto">
              {highlightLine(line, lang)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
