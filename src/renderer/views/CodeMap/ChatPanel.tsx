/**
 * ChatPanel — LLM 问答面板 (ui-spec §3.2.5)
 * Phase 2: connected to real LLM backend via chat:send IPC.
 */
import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

interface Props {
  t: (key: string) => string
  projectId?: string
  projectName?: string
}

export default function ChatPanel({ t, projectId, projectName }: Props) {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: projectName
        ? `你好！我是 Fieldguide AI 助手。我可以帮你理解「${projectName}」的代码结构。\n\n试试问我：\n- 这个项目的入口在哪里？\n- 认证逻辑是怎么实现的？\n- 有哪些核心模块？`
        : '你好！请先在项目库中选择一个项目，然后我可以帮你分析代码。',
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || !projectId) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)
    setError(null)

    try {
      const result = await window.fieldguide.chatSend(
        projectId,
        messages.concat(userMsg).map(m => ({ role: m.role, content: m.content }))
      )

      if (result.ok && result.data) {
        const data = result.data as { content: string }
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content || '（未获得回复）',
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } else {
        setError(result.error?.message ?? '请求失败')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--fg-bg)]">
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.role === 'system'
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                    : 'bg-white border border-gray-200 text-gray-800'
              }`}
            >
              {msg.content}
              <div
                className={`text-xs mt-1 ${
                  msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--fg-border)] bg-[var(--fg-card)]">
        {error && (
          <div className="mb-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline hover:text-red-800">关闭</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={projectId ? '输入问题… (Enter 发送)' : '请先选择项目'}
            disabled={sending || !projectId}
            className="flex-1 px-3 py-2 border border-[var(--fg-border)] rounded-lg text-sm bg-[var(--fg-bg)] focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending || !projectId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
