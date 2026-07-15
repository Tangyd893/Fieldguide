/**
 * ReAct Agent — tool-calling loop for cross-source Q&A.
 * Max 4 iterations; returns thought/action/observation/answer steps.
 */
import { loadConfig } from '../config'
import { listPapers } from '../db'
import { AGENT_TOOLS, executeTool, extractNodeRefsFromObservation, buildGraphOverview } from './tools'
import type { AgentContext, AgentResult, AgentStep } from './types'

const MAX_ITERATIONS = 4

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl}/v1/chat/completions`
    .replace(/\/+$/, '')
    .replace(/\/v1\/chat\/completions\/v1\/chat\/completions/, '/v1/chat/completions')
}

function localeHint(locale: string): string {
  if (locale === 'zh-TW') return 'Reply in Traditional Chinese.'
  if (locale === 'en-US') return 'Reply in English.'
  return 'Reply in Simplified Chinese.'
}

export async function runAgent(
  ctx: AgentContext,
  userMessages: Array<{ role: string; content: string }>,
): Promise<AgentResult> {
  const config = loadConfig()
  const steps: AgentStep[] = []
  const nodeRefs = new Set<string>()

  const overview = buildGraphOverview(ctx.projectRoot)
  const papers = listPapers().slice(0, 8).map(p =>
    `${p.title} (arxiv:${p.arxiv_id})`
  ).join('\n')

  const systemPrompt = [
    'You are Fieldguide AI — a learning coach connecting code maps and research papers.',
    `Project: "${ctx.projectName}".`,
    overview ? `\n## Graph overview\n${overview}` : '',
    papers ? `\n## Saved papers\n${papers}` : '',
    '\nUse tools when you need specific nodes, paper excerpts, source code, or concept bridges.',
    'For pure structural code navigation, you may suggest using the UA Dashboard graph view.',
    'When referencing code nodes, include their node id in brackets like [node:fn:handleRequest].',
    localeHint(ctx.locale),
  ].filter(Boolean).join('\n')

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...userMessages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  const url = chatCompletionsUrl(config.llm.baseUrl)

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: config.llm.chatModel,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(90_000),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`LLM API ${resp.status}: ${text.slice(0, 200)}`)
    }

    const data = await resp.json() as {
      choices?: Array<{
        message?: {
          content?: string | null
          tool_calls?: Array<{
            id: string
            type: 'function'
            function: { name: string; arguments: string }
          }>
        }
      }>
    }

    const choice = data.choices?.[0]?.message
    if (!choice) throw new Error('Empty LLM response')

    if (choice.content?.trim()) {
      steps.push({ type: 'thought', content: choice.content.trim() })
    }

    const toolCalls = choice.tool_calls
    if (!toolCalls?.length) {
      const answer = choice.content?.trim() || 'No response.'
      steps.push({ type: 'answer', content: answer })
      return { content: answer, steps, nodeRefs: [...nodeRefs] }
    }

    messages.push({
      role: 'assistant',
      content: choice.content ?? '',
      tool_calls: toolCalls,
    })

    for (const tc of toolCalls) {
      const toolName = tc.function.name
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.function.arguments || '{}')
      } catch { /* empty args */ }

      steps.push({
        type: 'action',
        content: JSON.stringify(args),
        tool: toolName,
      })

      const observation = await executeTool(toolName, args, ctx)
      steps.push({ type: 'observation', content: observation, tool: toolName })

      for (const ref of extractNodeRefsFromObservation(observation)) {
        nodeRefs.add(ref)
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: observation,
      })
    }
  }

  const fallback = 'Reached maximum reasoning steps. Please try a more specific question.'
  steps.push({ type: 'answer', content: fallback })
  return { content: fallback, steps, nodeRefs: [...nodeRefs] }
}
