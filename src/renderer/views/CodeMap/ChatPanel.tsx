/**
 * ChatPanel — Fieldguide Coach Agent 问答面板 (ui-spec §3.2.5)
 *
 * Answers render as Markdown (see lib/markdown) and keep their cited code nodes:
 * the references are persisted with the message, so the jump-to-graph chips work
 * again after a restart instead of vanishing with the in-memory state.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Copy, Check, RotateCw } from 'lucide-react'
import { renderMarkdown } from '@/lib/markdown'

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
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEnd = useRef<HTMLDivElement>(null)

  const welcome = useCallback((): Message => {
    return {
      id: 'welcome',
      role: 'assistant',
      content: t('chat.welcomeWithProject', { name: projectName }),
      timestamp: new Date().toISOString(),
    }
  }, [projectName, t])

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
          // Citations are persisted with the answer, so restore them too.
          nodeRefs: Array.isArray(m.nodeRefs) ? m.nodeRefs : [],
        })))
      } else {
        setMessages([welcome()])
      }
    }).catch(() => {
      setMessages([welcome()])
    })
  }, [projectId, projectName, t, welcome])

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

  /** Run one turn against the coach agent; `history` excludes the placeholder welcome. */
  async function ask(history: Message[], userMsg: Message, assistantId: string) {
    if (!projectId) return
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
          id: assistantId,
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

  async function send() {
    const text = input.trim()
    if (!text || !projectId) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    const history = messages.filter(m => m.role !== 'system' && m.id !== 'welcome')
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    await ask(history, userMsg, `a-${Date.now()}`)
  }

  /** Drop the trailing exchange and ask the last question again. */
  async function regenerate() {
    if (!projectId || sending) return

    let lastUserId = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserId = i; break }
    }
    if (lastUserId === -1) return

    const userMsg = messages[lastUserId]
    const history = messages
      .slice(0, lastUserId)
      .filter(m => m.role !== 'system' && m.id !== 'welcome')

    setMessages(messages.slice(0, lastUserId + 1))
    await ask(history, userMsg, `a-${Date.now()}`)
  }

  async function copyAnswer(msg: Message) {
    try {
      await navigator.clipboard.writeText(msg.content)
      setCopiedId(msg.id)
      setTimeout(() => setCopiedId(prev => (prev === msg.id ? null : prev)), 1500)
    } catch {
      /* clipboard unavailable (e.g. no permission) — ignore silently */
    }
  }

  async function clearHistory() {
    if (!projectId) return
    await window.fieldguide.chatClear(projectId)
    setMessages([welcome()])
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

  const hasUserMessage = messages.some(m => m.role === 'user')

  return (
    <div className="h-full flex flex-col bg-[var(--fg-bg)]">
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-[var(--fg-border)]">
        <button
          onClick={regenerate}
          disabled={!projectId || sending || !hasUserMessage}
          title={t('chat.regenerateHint')}
          className="inline-flex items-center gap-1 text-xs text-[var(--fg-text-tertiary)] hover:text-[var(--fg-accent)] disabled:opacity-40"
        >
          <RotateCw size={12} />
          {t('chat.regenerate')}
        </button>
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
            <div className="max-w-[85%] space-y-2 min-w-0">
              <div
                className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--fg-accent)] text-white whitespace-pre-wrap'
                    : msg.role === 'system'
                      ? 'bg-[var(--fg-status-warning-bg)] border border-[var(--fg-status-warning)] text-[var(--fg-status-warning)] whitespace-pre-wrap'
                      : 'bg-[var(--fg-card)] border border-[var(--fg-border)] text-[var(--fg-text-primary)]'
                }`}
              >
                {msg.role === 'assistant' && msg.id !== 'welcome'
                  ? renderMarkdown(msg.content)
                  : msg.content}
                <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70' : 'text-[var(--fg-text-tertiary)]'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {msg.role === 'assistant' && msg.id !== 'welcome' && (
                <div className="flex items-center gap-3 text-xs">
                  <button
                    onClick={() => copyAnswer(msg)}
                    aria-label={t('chat.copyAnswer')}
                    className="inline-flex items-center gap-1 text-[var(--fg-text-tertiary)] hover:text-[var(--fg-accent)]"
                  >
                    {copiedId === msg.id
                      ? <><Check size={12} />{t('chat.copied')}</>
                      : <><Copy size={12} />{t('chat.copyAnswer')}</>}
                  </button>
                </div>
              )}

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
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-[var(--fg-text-tertiary)]">
                    {t('chat.citations')}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {msg.nodeRefs.map(ref => (
                      <button
                        key={ref}
                        onClick={() => onNodeRefClick(ref)}
                        title={ref}
                        className="text-xs px-2 py-0.5 rounded-full bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] hover:opacity-80 max-w-[220px] truncate"
                      >
                        {ref.split('/').pop() || ref}
                      </button>
                    ))}
                  </div>
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
            aria-label={t('chat.placeholder')}
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
