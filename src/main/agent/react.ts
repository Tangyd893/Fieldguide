/**
 * Fieldguide Coach Agent — context-first ReAct loop.
 * Injects packed project context, forces a final answer on the last round,
 * and deduplicates identical tool calls.
 */
import { loadConfig } from '../config'
import { buildAgentTools, executeTool, extractNodeRefsFromObservation, toolCallKey } from './tools'
import { packCoachContext, coachPolicyHints } from './context-packer'
import { vaultToolContext } from '../obsidian/agent'
import type { AgentContext, AgentResult, AgentStep } from './types'
import { chatCompletion, type ChatMessage, type ToolCall } from '../llm/client'

const MAX_ITERATIONS = 6

interface LLMMessage extends ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  tool_calls?: ToolCall[]
}

function localeHint(locale: string): string {
  if (locale === 'zh-TW') return 'Reply in Traditional Chinese.'
  if (locale === 'en-US') return 'Reply in English.'
  return 'Reply in Simplified Chinese.'
}

function fallbackMessage(locale: string): string {
  if (locale === 'en-US') {
    return 'I reached the tool-call limit. Based on the injected project context above, please ask a follow-up if you need more detail on a specific module.'
  }
  if (locale === 'zh-TW') {
    return '已達工具呼叫上限。請根據已注入的專案上下文追問具體模組，我會繼續說明。'
  }
  return '已达到工具调用上限。请基于已注入的项目上下文追问具体模块，我会继续说明。'
}

export async function runAgent(
  ctx: AgentContext,
  userMessages: Array<{ role: string; content: string }>,
): Promise<AgentResult> {
  const config = loadConfig()
  const steps: AgentStep[] = []
  const nodeRefs = new Set<string>()
  const seenToolCalls = new Set<string>()

  const lastUser = [...userMessages].reverse().find((m) => m.role === 'user')
  const userQuery = lastUser?.content?.trim() || ''

  const packed = await packCoachContext(ctx, userQuery)
  steps.push({
    type: 'context',
    content: `intent=${packed.intent}; seeded ${packed.seedNodeIds.length} nodes`,
  })
  for (const id of packed.seedNodeIds) nodeRefs.add(id)

  // The vault tool set is decided once per turn: a tool list that changes mid-loop
  // would invalidate the cached prefix of the conversation for no benefit.
  const vaultBound = Boolean(vaultToolContext(ctx.projectId))
  const tools = buildAgentTools({ vault: vaultBound })

  const systemPrompt = [
    coachPolicyHints(packed.intent),
    `Project: "${ctx.projectName}".`,
    '\n# Injected project context (use this first)',
    packed.markdown,
    '\n# Tool policy',
    'Use tools only when the injected context is insufficient.',
    'Never call the same tool with the same arguments twice.',
    'When referencing code nodes, include their node id like [node:fn:handleRequest].',
    vaultBound
      ? 'Obsidian vault tools are available: the reader keeps their own notes next to the synced cards, so check vault_list_cards / vault_read_note before writing, and cite the note path when you use something from it.'
      : '',
    localeHint(ctx.locale),
  ].filter(Boolean).join('\n')

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...userMessages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const isLast = i === MAX_ITERATIONS - 1
    if (isLast) {
      messages.push({
        role: 'user',
        content:
          'SYSTEM: This is your final turn. Do not call tools. Synthesize a complete, helpful answer from the injected context and prior tool observations.',
      })
    }

    // Shared transport: retries on 429/5xx/timeouts. A long tool loop is exactly
    // where a single transient failure used to kill the whole answer.
    const { message: choice } = await chatCompletion(
      { baseUrl: config.llm.baseUrl, apiKey: config.llm.apiKey, chatModel: config.llm.chatModel },
      {
        messages,
        tools: isLast ? undefined : tools,
        toolChoice: isLast ? undefined : 'auto',
        temperature: 0.3,
        maxTokens: 2048,
        timeoutMs: 90_000,
      },
    )

    if (choice.content?.trim()) {
      steps.push({ type: 'thought', content: choice.content.trim() })
    }

    const toolCalls = isLast ? undefined : choice.tool_calls
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

    let anyNewTool = false
    for (const tc of toolCalls) {
      const toolName = tc.function.name
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.function.arguments || '{}')
      } catch { /* empty args */ }

      const key = toolCallKey(toolName, args)
      steps.push({
        type: 'action',
        content: JSON.stringify(args),
        tool: toolName,
      })

      let observation: string
      if (seenToolCalls.has(key)) {
        observation = JSON.stringify({
          skipped: true,
          reason: 'Duplicate tool call — reuse prior observation; answer now if possible.',
        })
      } else {
        seenToolCalls.add(key)
        anyNewTool = true
        observation = await executeTool(toolName, args, ctx)
      }

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

    // If every tool call was a duplicate, nudge the model to answer next round
    if (!anyNewTool) {
      messages.push({
        role: 'user',
        content:
          'SYSTEM: All tool calls were duplicates. Stop calling tools and give your final answer now.',
      })
    }
  }

  const fallback = fallbackMessage(ctx.locale)
  steps.push({ type: 'answer', content: fallback })
  return { content: fallback, steps, nodeRefs: [...nodeRefs] }
}
