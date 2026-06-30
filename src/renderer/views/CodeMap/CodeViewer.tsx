/**
 * CodeViewer — read-only source code panel with line numbers.
 * ui-spec v0.4 §3.2.4
 */
import { useState, useEffect } from 'react'

interface Props {
  projectId?: string
  filePath?: string
}

export default function CodeViewer({ projectId, filePath }: Props) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !filePath) {
      setContent('')
      return
    }
    loadFile()
  }, [projectId, filePath])

  async function loadFile() {
    if (!projectId || !filePath) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.fieldguide.fileRead(projectId, filePath)
      if (result.ok && result.data) {
        setContent((result.data as { content: string }).content)
      } else {
        setError(result.error?.message ?? '读取失败')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        点击左侧文件树打开文件
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        加载中…
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500 text-sm">
        {error}
      </div>
    )
  }

  const lines = content.split('\n')

  return (
    <div className="h-full overflow-auto bg-[var(--fg-bg)]">
      {/* File header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-[var(--fg-card)] border-b border-[var(--fg-border)] text-xs text-gray-400 font-mono">
        <span>{filePath}</span>
        <span className="flex-1" />
        <span>{lines.length} 行</span>
      </div>

      {/* Code lines */}
      <div className="font-mono text-[13px] leading-5">
        {lines.map((line, i) => (
          <div
            key={i}
            className="flex hover:bg-blue-50/50 group"
          >
            <span className="w-12 flex-shrink-0 text-right pr-3 text-gray-300 select-none text-xs leading-5 py-px border-r border-[var(--fg-border)]">
              {i + 1}
            </span>
            <span className="flex-1 pl-3 whitespace-pre text-[var(--fg-text-primary)] py-px">
              {line || ' '}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
