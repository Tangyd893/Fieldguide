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
  t: (key: string, opts?: Record<string, unknown>) => string
  projectId?: string
  projectName?: string
}

export default function ChatPanel({ t, projectId, projectName }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: projectName
        ? t('chat.welcomeWithProject', { name: projectName })
        : t('chat.noProject'),
      timestamp: new Date().toISOString(),
    }])
  }, [projectId, projectName, t])

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
          content: data.content || t('chat.noReply'),
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } else {
        setError(result.error?.message ?? t('chat.requestFailed'))
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--fg-bg)]">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[var(--fg-accent)] text-white'
                  : msg.role === 'system'
                    ? 'bg-[var(--fg-status-warning-bg)] border border-[var(--fg-status-warning)] text-[var(--fg-status-warning)]'
                    : 'bg-[var(--fg-card)] border border-[var(--fg-border)] text-[var(--fg-text-primary)]'
              }`}
            >
              {msg.content}
              <div
                className={`text-xs mt-1 ${
                  msg.role === 'user' ? 'text-white/70' : 'text-[var(--fg-text-tertiary)]'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-[var(--fg-card)] border border-[var(--fg-border)] rounded-xl px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[var(--fg-text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[var(--fg-text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[var(--fg-text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      <div className="p-3 border-t border-[var(--fg-border)] bg-[var(--fg-card)]">
        {error && (
          <div className="mb-2 px-3 py-1.5 bg-[var(--fg-status-error-bg)] border border-[var(--fg-status-error)] rounded text-xs text-[var(--fg-status-error)]">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline hover:opacity-80">{t('chat.close')}</button>
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
            placeholder={projectId ? t('chat.placeholder') : t('chat.noProject')}
            disabled={sending || !projectId}
            className="flex-1 px-3 py-2 border border-[var(--fg-border)] rounded-lg text-sm bg-[var(--fg-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--fg-accent)] disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending || !projectId}
            className="px-4 py-2 bg-[var(--fg-accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-colors"
          >
            {t('chat.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
