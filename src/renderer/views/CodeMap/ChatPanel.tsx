/**
 * ChatPanel — Fieldguide Coach Agent 问答面板 (ui-spec §3.2.5)
 */
import { useState, useRef, useEffect } from 'react'

interface AgentStep {
  type: 'thought' | 'action' | 'observation' | 'answer' | 'context'
  content: string
  tool?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  steps?: AgentStep[]
  nodeRefs?: string[]
}

interface Props {
  t: (key: string, opts?: Record<string, unknown>) => string
  projectId?: string
  projectName?: string
  focusedNodeId?: string | null
  tourStepIndex?: number | null
  onNodeRefClick?: (nodeId: string) => void
}

export default function ChatPanel({
  t,
  projectId,
  projectName,
  focusedNodeId,
  tourStepIndex,
  onNodeRefClick,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const messagesEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!projectId) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: t('chat.noProject'),
        timestamp: new Date().toISOString(),
      }])
      return
    }

    window.fieldguide.chatHistory(projectId).then((result) => {
      if (result.ok && result.data && Array.isArray(result.data) && result.data.length > 0) {
        setMessages((result.data as Message[]).map(m => ({
          id: m.id || Date.now().toString(),
          role: m.role as Message['role'],
          content: m.content,
          timestamp: m.timestamp || new Date().toISOString(),
          steps: m.steps,
        })))
      } else {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: t('chat.welcomeWithProject', { name: projectName }),
          timestamp: new Date().toISOString(),
        }])
      }
    }).catch(() => {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: t('chat.welcomeWithProject', { name: projectName }),
        timestamp: new Date().toISOString(),
      }])
    })
  }, [projectId, projectName, t])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function toggleSteps(id: string) {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function send() {
    const text = input.trim()
    if (!text || !projectId) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    const history = messages.filter(m => m.role !== 'system' && m.id !== 'welcome')
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)
    setError(null)

    try {
      const result = await window.fieldguide.chatSend(
        projectId,
        [...history, userMsg].map(m => ({ role: m.role, content: m.content })),
        {
          focusedNodeId: focusedNodeId ?? null,
          tourStepIndex: tourStepIndex ?? null,
        },
      )

      if (result.ok && result.data) {
        const data = result.data as { content: string; steps?: AgentStep[]; nodeRefs?: string[] }
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content || t('chat.noReply'),
          timestamp: new Date().toISOString(),
          steps: data.steps,
          nodeRefs: data.nodeRefs,
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

  async function clearHistory() {
    if (!projectId) return
    await window.fieldguide.chatClear(projectId)
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: t('chat.welcomeWithProject', { name: projectName }),
      timestamp: new Date().toISOString(),
    }])
  }

  function stepLabel(step: AgentStep): string {
    switch (step.type) {
      case 'context': return t('chat.stepContext')
      case 'thought': return t('chat.stepThought')
      case 'action': return step.tool ? `${t('chat.stepAction')}: ${step.tool}` : t('chat.stepAction')
      case 'observation': return t('chat.stepObservation')
      case 'answer': return t('chat.stepAnswer')
      default: return step.type
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--fg-bg)]">
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-[var(--fg-border)]">
        <button
          onClick={clearHistory}
          disabled={!projectId}
          className="text-xs text-[var(--fg-text-tertiary)] hover:text-[var(--fg-accent)] disabled:opacity-40"
        >
          {t('chat.clearHistory')}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] space-y-2">
              <div
                className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[var(--fg-accent)] text-white'
                    : msg.role === 'system'
                      ? 'bg-[var(--fg-status-warning-bg)] border border-[var(--fg-status-warning)] text-[var(--fg-status-warning)]'
                      : 'bg-[var(--fg-card)] border border-[var(--fg-border)] text-[var(--fg-text-primary)]'
                }`}
              >
                {msg.content}
                <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70' : 'text-[var(--fg-text-tertiary)]'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {msg.steps && msg.steps.length > 0 && (
                <div className="text-xs">
                  <button
                    onClick={() => toggleSteps(msg.id)}
                    className="text-[var(--fg-accent)] hover:underline"
                  >
                    {expandedSteps.has(msg.id) ? t('chat.hideSteps') : t('chat.showSteps', { count: msg.steps.length })}
                  </button>
                  {expandedSteps.has(msg.id) && (
                    <div className="mt-1 space-y-1 pl-2 border-l-2 border-[var(--fg-border)]">
                      {msg.steps.map((step, i) => (
                        <div key={i} className="text-[var(--fg-text-tertiary)]">
                          <span className="font-medium text-[var(--fg-text-secondary)]">{stepLabel(step)}</span>
                          <pre className="whitespace-pre-wrap break-words mt-0.5 max-h-24 overflow-auto">{step.content.slice(0, 400)}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {msg.nodeRefs && msg.nodeRefs.length > 0 && onNodeRefClick && (
                <div className="flex flex-wrap gap-1">
                  {msg.nodeRefs.map(ref => (
                    <button
                      key={ref}
                      onClick={() => onNodeRefClick(ref)}
                      className="text-xs px-2 py-0.5 rounded-full bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] hover:opacity-80"
                    >
                      {ref.split('/').pop() || ref}
                    </button>
                  ))}
                </div>
              )}
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
