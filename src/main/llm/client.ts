/**
 * Unified LLM transport for the main process.
 *
 * Why this module exists: `fetch` to `/v1/chat/completions` used to be hand-rolled
 * in four places (`understand/*` via llm-utils, `ua/client.ts` summaries,
 * `agent/react.ts` ReAct loop, `ipc/index.ts` connectivity test). Each copy had its
 * own timeout (15s/90s/120s), its own error wording and its own idea of what a
 * usable response is — and none of them retried, even though 429/5xx from a chat
 * endpoint are routine. The code review in docs/OCR-report.md flagged this as the
 * single highest-ROI cleanup; this is it.
 *
 * What every caller now gets for free:
 *   - one endpoint/URL rule (`joinLlmUrl`, so `/v1` is never doubled)
 *   - retry with exponential backoff + jitter on 429/5xx/timeout/network errors,
 *     honouring `Retry-After` when the provider sends it
 *   - token metering (`usage`) so cost is observable instead of guessed
 *   - typed tool-calling (`tools` / `tool_calls`) for the ReAct loop
 *
 * Non-retryable failures (401/403/404, malformed payload) fail fast: retrying a
 * bad API key just burns user time.
 */
import { joinLlmUrl } from '../../shared/llm-url'

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  chatModel: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ChatOptions {
  messages: ChatMessage[]
  /** Sampling temperature (default 0.4). */
  temperature?: number
  /** Response cap (default 4096). */
  maxTokens?: number
  /** Per-attempt timeout in ms (default 120s — these calls run on whole projects). */
  timeoutMs?: number
  /** Tool schemas for function calling. */
  tools?: ToolSchema[]
  /** Tool selection mode; omitted together with `tools` (the API rejects `none` alone). */
  toolChoice?: 'auto' | 'none'
  /** Attempts *after* the first failure (default 2). */
  retries?: number
  /** Base backoff in ms (default 500); doubled per attempt, capped, jittered. */
  backoffBaseMs?: number
  /** Caller cancellation, combined with the per-attempt timeout. */
  signal?: AbortSignal
}

export interface LlmUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ChatResult {
  message: ChatMessage
  usage: LlmUsage
  /** Total attempts made (1 = succeeded first try). */
  attempts: number
}

/** HTTP statuses worth a second attempt. */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])

export const DEFAULT_RETRIES = 2
const MAX_BACKOFF_MS = 8_000

export class LlmError extends Error {
  readonly status?: number
  readonly retriable: boolean
  readonly attempts: number

  constructor(message: string, options: { status?: number; retriable: boolean; attempts: number }) {
    super(message)
    this.name = 'LlmError'
    this.status = options.status
    this.retriable = options.retriable
    this.attempts = options.attempts
  }
}

// ─── Token metering ───
// Process-lifetime counters. The cost dialog and the FAQ both need to say
// something true about usage, and inventing a price table we cannot verify is
// worse than reporting the tokens the provider actually billed.

interface LlmMeter extends LlmUsage {
  calls: number
  failedCalls: number
  retries: number
}

const meter: LlmMeter = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  calls: 0,
  failedCalls: 0,
  retries: 0,
}

export function llmUsageTotals(): Readonly<LlmMeter> {
  return { ...meter }
}

export function resetLlmUsage(): void {
  meter.promptTokens = 0
  meter.completionTokens = 0
  meter.totalTokens = 0
  meter.calls = 0
  meter.failedCalls = 0
  meter.retries = 0
}

// ─── Backoff ───

/** `Retry-After` may be a delay in seconds or an HTTP date. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | null {
  if (!header) return null
  const seconds = Number(header.trim())
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_BACKOFF_MS)
  const date = Date.parse(header)
  if (Number.isNaN(date)) return null
  return Math.max(0, Math.min(date - now, MAX_BACKOFF_MS))
}

/**
 * Exponential backoff with full jitter, capped. Pure so it can be pinned by tests
 * (the retry loop itself is timing-based and unpleasant to assert on).
 */
export function computeBackoffMs(
  attempt: number,
  options: { baseMs?: number; retryAfterMs?: number | null; random?: () => number } = {},
): number {
  const base = options.baseMs ?? 500
  const capped = Math.min(base * 2 ** attempt, MAX_BACKOFF_MS)
  // Jitter avoids a thundering herd when a whole project's stages hit a 429 together.
  const jittered = capped / 2 + (options.random ?? Math.random)() * (capped / 2)
  // A provider-specified delay wins, but still respects our cap.
  if (options.retryAfterMs != null) return Math.max(jittered, Math.min(options.retryAfterMs, MAX_BACKOFF_MS))
  return jittered
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new Error('aborted'))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message === 'aborted')
}

function readUsage(raw: unknown): LlmUsage {
  const u = (raw ?? {}) as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  const promptTokens = Number(u.prompt_tokens) || 0
  const completionTokens = Number(u.completion_tokens) || 0
  return {
    promptTokens,
    completionTokens,
    // Some providers omit total_tokens; the sum is the honest fallback.
    totalTokens: Number(u.total_tokens) || promptTokens + completionTokens,
  }
}

/**
 * One chat completion, with retries. Throws `LlmError` when every attempt failed
 * so callers can fall back to their heuristic path knowing whether a retry by a
 * human would help (`retriable`).
 */
export async function chatCompletion(config: LLMConfig, opts: ChatOptions): Promise<ChatResult> {
  const url = joinLlmUrl(config.baseUrl, '/v1/chat/completions')
  const maxAttempts = Math.max(1, (opts.retries ?? DEFAULT_RETRIES) + 1)
  const timeoutMs = opts.timeoutMs ?? 120_000
  let lastError: LlmError | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.signal?.aborted) {
      throw new LlmError('aborted', { retriable: false, attempts: attempt })
    }
    if (attempt > 0) meter.retries += 1

    // Fresh timeout per attempt: a 90s ceiling should bound each request, not the
    // whole retry sequence.
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.chatModel,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? 4096,
          ...(opts.tools?.length ? { tools: opts.tools, tool_choice: opts.toolChoice ?? 'auto' } : {}),
        }),
        signal,
      })

      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        const retriable = RETRYABLE_STATUS.has(resp.status)
        lastError = new LlmError(
          `LLM error ${resp.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
          { status: resp.status, retriable, attempts: attempt + 1 },
        )
        if (!retriable || attempt === maxAttempts - 1) throw lastError
        await sleep(
          computeBackoffMs(attempt, {
            baseMs: opts.backoffBaseMs,
            retryAfterMs: parseRetryAfter(resp.headers?.get?.('retry-after') ?? null),
          }),
          opts.signal,
        )
        continue
      }

      const data = await resp.json() as {
        choices?: Array<{ message?: ChatMessage }>
        usage?: unknown
      }
      const message = data.choices?.[0]?.message
      const hasToolCalls = Boolean(message?.tool_calls?.length)
      // A tool-call turn legitimately has no text content, so only *neither* is empty.
      if (!message || (!message.content && !hasToolCalls)) {
        lastError = new LlmError('empty LLM response', { retriable: false, attempts: attempt + 1 })
        throw lastError
      }

      const usage = readUsage(data.usage)
      meter.promptTokens += usage.promptTokens
      meter.completionTokens += usage.completionTokens
      meter.totalTokens += usage.totalTokens
      meter.calls += 1

      return { message, usage, attempts: attempt + 1 }
    } catch (err) {
      if (err instanceof LlmError) {
        // Already classified above (HTTP status or empty payload).
        if (!err.retriable) {
          meter.failedCalls += 1
          throw err
        }
        lastError = err
      } else if (isAbortError(err)) {
        // A caller abort must propagate immediately; our own timeout is retriable.
        if (opts.signal?.aborted) {
          meter.failedCalls += 1
          throw new LlmError('aborted', { retriable: false, attempts: attempt + 1 })
        }
        lastError = new LlmError(`LLM timeout after ${timeoutMs}ms`, {
          retriable: true,
          attempts: attempt + 1,
        })
      } else {
        // Network/DNS/TLS: the commonest transient failure on a flaky connection.
        lastError = new LlmError(
          `LLM request failed: ${err instanceof Error ? err.message : String(err)}`,
          { retriable: true, attempts: attempt + 1 },
        )
      }

      if (attempt === maxAttempts - 1) {
        meter.failedCalls += 1
        throw lastError
      }
      await sleep(computeBackoffMs(attempt, { baseMs: opts.backoffBaseMs }), opts.signal)
    }
  }

  // Unreachable: the loop either returns or throws on its last attempt.
  meter.failedCalls += 1
  throw lastError ?? new LlmError('LLM request failed', { retriable: false, attempts: maxAttempts })
}

export interface CallLlmOptions {
  /** System prompt; defaults to a JSON-only instruction in the target language. */
  system?: string
  /** Sampling temperature (default 0.4). */
  temperature?: number
  /** Response cap (default 4096). */
  maxTokens?: number
  /** Per-attempt timeout in ms (default 120s). */
  timeoutMs?: number
  /** Attempts after the first failure (default 2). */
  retries?: number
}

/** Instruction used when a stage needs structured output. */
export function jsonSystemPrompt(language?: string): string {
  return language === 'en'
    ? 'You answer with JSON only. No prose, no markdown fences.'
    : '只输出 JSON，不要任何解释文字，不要 markdown 代码块围栏。'
}

/**
 * Text-in/text-out convenience wrapper for the prompt→JSON stages.
 *
 * Throws on transport/HTTP failure so callers can decide whether to fall back to
 * their heuristic path.
 */
export async function callLLM(
  prompt: string,
  config: LLMConfig,
  language?: string,
  opts: CallLlmOptions = {},
): Promise<string> {
  const { message } = await chatCompletion(config, {
    messages: [
      { role: 'system', content: opts.system ?? jsonSystemPrompt(language) },
      { role: 'user', content: prompt },
    ],
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    timeoutMs: opts.timeoutMs,
    retries: opts.retries,
  })
  const content = message.content
  if (!content) throw new LlmError('empty LLM response', { retriable: false, attempts: 1 })
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
