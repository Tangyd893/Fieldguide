/**
 * Shared LLM helpers for the understanding stages.
 *
 * Previously `callLLM` and `extractJson` were copy-pasted into architecture.ts,
 * knowledge.ts and interview.ts (flagged by the code review in docs/OCR-report.md).
 * Any change to the endpoint, timeout or error handling had to be made three
 * times, so they live here.
 */
import { joinLlmUrl } from '../../shared/llm-url'

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  chatModel: string
}

export interface CallLlmOptions {
  /** System prompt; defaults to a JSON-only instruction in the target language. */
  system?: string
  /** Sampling temperature (default 0.4). */
  temperature?: number
  /** Response cap (default 4096). */
  maxTokens?: number
  /** Request timeout in ms (default 120s — these stages run on whole projects). */
  timeoutMs?: number
}

/** Instruction used when a stage needs structured output. */
export function jsonSystemPrompt(language?: string): string {
  return language === 'en'
    ? 'You answer with JSON only. No prose, no markdown fences.'
    : '只输出 JSON，不要任何解释文字，不要 markdown 代码块围栏。'
}

/**
 * One chat-completions call. Throws on transport/HTTP failure so callers can
 * decide whether to fall back to their heuristic path.
 */
export async function callLLM(
  prompt: string,
  config: LLMConfig,
  language?: string,
  opts: CallLlmOptions = {},
): Promise<string> {
  const url = joinLlmUrl(config.baseUrl, '/v1/chat/completions')
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.chatModel,
      messages: [
        { role: 'system', content: opts.system ?? jsonSystemPrompt(language) },
        { role: 'user', content: prompt },
      ],
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 4096,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`LLM error ${resp.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }

  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('empty LLM response')
  return content
}

/**
 * Parse a JSON payload out of a model response, tolerating prose or a fenced
 * code block around it. Throws when no JSON object can be recovered.
 */
export function extractJson(text: string): unknown {
  const trimmed = String(text ?? '').trim()

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fence ? fence[1].trim() : trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    // Fall back to the outermost {...} or [...] span.
    const start = candidate.search(/[[{]/)
    const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'))
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1))
    }
    throw new Error('no JSON found in LLM response')
  }
}
