/**
 * CommandPalette — Ctrl+K 命令面板 (ui-spec v0.4 §4.5)
 *
 * Commands: 切换项目, 重新索引, 打开设置, 切换主题, 跳转文件
 */
import { useState, useEffect, useRef, useCallback } from 'react'

interface Command {
  id: string
  label: string
  shortcut?: string
  action: () => void
}

interface Props {
  commands: Command[]
  onClose: () => void
}

export default function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands

  // Keyboard nav
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selected]) {
          filtered[selected].action()
          onClose()
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [filtered, selected, onClose],
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[560px] bg-white rounded-xl shadow-2xl z-50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
          <span className="text-gray-400">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="搜索命令…"
            className="flex-1 text-sm outline-none text-gray-800"
          />
          <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>
        <div className="max-h-72 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">无匹配命令</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action()
                  onClose()
                }}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                  i === selected ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex-1">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
