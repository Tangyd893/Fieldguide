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
  /**
   * Receive content incrementally (enables `stream: true`).
   *
   * Retry policy changes when this is set: once a delta has been handed to the
   * caller, retrying would replay text the reader has already seen, so a failure
   * after the first delta is final. Before the first delta, retries behave exactly
   * as in the non-streaming path.
   */
  onDelta?: (text: string) => void
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
  // Some OpenAI-compatible gateways reject `stream_options`; the first 400 turns
  // streaming off for the remaining attempts. Falling back to a non-streamed call
  // keeps the provider's token usage (and therefore the cost meter) intact, which
  // matters more than incremental rendering.
  let disableStreaming = false

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.signal?.aborted) {
      throw new LlmError('aborted', { retriable: false, attempts: attempt })
    }
    if (attempt > 0) meter.retries += 1

    // Fresh timeout per attempt: a 90s ceiling should bound each request, not the
    // whole retry sequence.
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout

    // Whether the reader has already seen streamed text in *this* attempt (see the
    // retry rule below).
    let streamedAnyDelta = false

    try {
      const streaming = Boolean(opts.onDelta) && !disableStreaming
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
          ...(streaming ? { stream: true } : {}),
          ...(streaming ? { stream_options: { include_usage: true } } : {}),
        }),
        signal,
      })

      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        // Ask for usage, not for permission: degrade instead of failing the question.
        if (resp.status === 400 && streaming && /stream_options/i.test(body)) {
          disableStreaming = true
          continue
        }
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

      if (streaming) {
        const streamed = await readStreamedCompletion(resp, (text) => {
          streamedAnyDelta = true
          opts.onDelta!(text)
        })
        const usage = readUsage(streamed.usage)
        meter.promptTokens += usage.promptTokens
        meter.completionTokens += usage.completionTokens
        meter.totalTokens += usage.totalTokens
        meter.calls += 1
        const hasToolCalls = Boolean(streamed.message.tool_calls?.length)
        if (!streamed.message.content && !hasToolCalls) {
          meter.failedCalls += 1
          throw new LlmError('empty LLM response', { retriable: false, attempts: attempt + 1 })
        }
        return { message: streamed.message, usage, attempts: attempt + 1 }
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

      // Once text has reached the reader, a retry would duplicate what they saw.
      const partialExposed = Boolean(streamedAnyDelta)
      if (attempt === maxAttempts - 1 || partialExposed) {
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

/* ──────────── Streaming (SSE) ──────────── */

/**
 * Accumulated state of one streamed completion.
 *
 * Exposed as pure state + a pure reducer so the messy part (SSE framing, split
 * chunks, tool-call fragment merging) is unit-testable without a network or a
 * running Electron app.
 */
export interface StreamAccumulator {
  content: string
  /** Tool calls arrive as fragments keyed by index; arguments concatenate. */
  toolCalls: Map<number, { id?: string; name?: string; args: string }>
  usage?: unknown
  done: boolean
}

export function createStreamAccumulator(): StreamAccumulator {
  return { content: '', toolCalls: new Map(), done: false }
}

/**
 * Fold one SSE `data:` payload into the accumulator.
 *
 * Returns the text delta of this payload (empty when it carries only tool-call
 * fragments, usage, or the terminator), which is exactly what a UI needs to append.
 */
export function consumeStreamPayload(acc: StreamAccumulator, payload: string): string {
  const trimmed = payload.trim()
  if (!trimmed) return ''
  if (trimmed === '[DONE]') {
    acc.done = true
    return ''
  }

  let parsed: {
    choices?: Array<{ delta?: { content?: string | null; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> } }>
    usage?: unknown
  }
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    // A malformed frame is not worth failing the whole answer over.
    return ''
  }

  if (parsed.usage) acc.usage = parsed.usage
  const delta = parsed.choices?.[0]?.delta
  if (!delta) return ''

  for (const fragment of delta.tool_calls ?? []) {
    const index = fragment.index ?? acc.toolCalls.size
    const current = acc.toolCalls.get(index) ?? { args: '' }
    if (fragment.id) current.id = fragment.id
    if (fragment.function?.name) current.name = fragment.function.name
    if (fragment.function?.arguments) current.args += fragment.function.arguments
    acc.toolCalls.set(index, current)
  }

  const text = delta.content ?? ''
  if (text) acc.content += text
  return text
}

/** Turn the accumulated fragments into the same message shape the non-streaming path returns. */
export function streamAccumulatorToMessage(acc: StreamAccumulator): ChatMessage {
  const toolCalls: ToolCall[] = [...acc.toolCalls.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, fragment], i) => ({
      id: fragment.id ?? `call_${i}`,
      type: 'function' as const,
      function: { name: fragment.name ?? '', arguments: fragment.args || '{}' },
    }))
    .filter((call) => call.function.name)

  return {
    role: 'assistant',
    content: acc.content || null,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  }
}

/**
 * Read an SSE response body to completion, forwarding text deltas as they arrive.
 *
 * Chunk boundaries do not respect line boundaries, so a partial line is buffered
 * until its newline arrives — the single most common bug in hand-written SSE readers.
 */
export async function readStreamedCompletion(
  resp: Response,
  onDelta: (text: string) => void,
): Promise<{ message: ChatMessage; usage?: unknown }> {
  const acc = createStreamAccumulator()
  const body = resp.body
  if (!body) return { message: streamAccumulatorToMessage(acc) }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, '')
      buffer = buffer.slice(newline + 1)
      if (line.startsWith('data:')) {
        const delta = consumeStreamPayload(acc, line.slice(5))
        if (delta) onDelta(delta)
      }
      newline = buffer.indexOf('\n')
    }
  }

  // A final frame may arrive without a trailing newline.
  if (buffer.trim().startsWith('data:')) {
    const delta = consumeStreamPayload(acc, buffer.trim().slice(5))
    if (delta) onDelta(delta)
  }

  return { message: streamAccumulatorToMessage(acc), usage: acc.usage }
}
