import { useState, useEffect } from 'react'

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

  if (!filePath) return <div className="h-full flex items-center justify-center text-gray-400 text-sm">{t('codeMap.clickToOpen')}</div>
  if (loading) return <div className="h-full flex items-center justify-center text-gray-400 text-sm">{t('codeMap.loading')}</div>
  if (error) return <div className="h-full flex items-center justify-center text-red-500 text-sm">{error}</div>

  const lines = content.split('\n')
  return (
    <div className="h-full overflow-auto bg-[var(--fg-bg)]">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-[var(--fg-card)] border-b border-[var(--fg-border)] text-xs text-gray-400 font-mono">
        <span>{filePath}</span><span className="flex-1" /><span>{t('codeMap.lines', { count: lines.length })}</span>
      </div>
      <div className="font-mono text-[13px] leading-5">
        {lines.map((line, i) => (
          <div key={i} className="flex hover:bg-blue-50/50">
            <span className="w-12 flex-shrink-0 text-right pr-3 text-gray-300 select-none text-xs leading-5 py-px border-r border-[var(--fg-border)]">{i + 1}</span>
            <span className="flex-1 pl-3 whitespace-pre text-[var(--fg-text-primary)] py-px">{line || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
