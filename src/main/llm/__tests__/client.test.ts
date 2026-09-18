/**
 * Unified LLM transport (`src/main/llm/client.ts`).
 *
 * `callLLM` used to be copy-pasted into architecture/knowledge/interview, plus a
 * fourth, differently-worded copy in `ua/client.ts` and two raw `fetch` calls (the
 * ReAct loop and the connectivity test). This suite pins what every caller now
 * shares: endpoint joining, auth, error surfacing, retry policy, backoff maths and
 * token metering. The retry tests are the point — none of the copies retried, so a
 * single 429 could silently degrade a whole index to structure-only.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  callLLM,
  chatCompletion,
  computeBackoffMs,
  extractJson,
  jsonSystemPrompt,
  llmUsageTotals,
  parseRetryAfter,
  resetLlmUsage,
  LlmError,
  type LLMConfig,
} from '../client'

const CONFIG: LLMConfig = {
  baseUrl: 'https://api.example.com',
  apiKey: 'sk-test',
  chatModel: 'test-model',
}

function okResponse(payload: unknown): Partial<Response> {
  return { ok: true, status: 200, json: async () => payload }
}

function completion(content: string | null, usage?: unknown) {
  return { choices: [{ message: { content } }], ...(usage ? { usage } : {}) }
}

/** `fetch` stub returning the queued responses in order. */
function mockFetchSequence(...responses: Array<Partial<Response>>) {
  const fn = vi.fn(async () => responses.shift() as unknown as Response)
  vi.stubGlobal('fetch', fn)
  return fn
}

function mockFetch(response: Partial<Response>) {
  return mockFetchSequence(response, response, response, response, response)
}

function httpError(status: number, body: string): Partial<Response> {
  return {
    ok: false,
    status,
    headers: { get: () => null } as unknown as Headers,
    text: async () => body,
  }
}

beforeEach(() => {
  resetLlmUsage()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('unwraps a fenced code block', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('recovers JSON surrounded by prose (a common model failure mode)', () => {
    const text = 'Sure! Here is the result:\n{"stack":["go"],"layers":[]}\nLet me know if you need more.'
    expect(extractJson(text)).toEqual({ stack: ['go'], layers: [] })
  })

  it('recovers a top-level array', () => {
    expect(extractJson('Here you go: [{"id":1},{"id":2}]')).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('throws when there is no JSON at all', () => {
    expect(() => extractJson('I cannot help with that.')).toThrow(/no JSON found/)
  })

  it('throws on malformed JSON rather than guessing', () => {
    expect(() => extractJson('{"a": }')).toThrow()
  })
})

describe('jsonSystemPrompt', () => {
  it('asks for JSON in the requested language', () => {
    expect(jsonSystemPrompt('en')).toMatch(/JSON/)
    expect(jsonSystemPrompt('en')).toMatch(/No prose/)
    expect(jsonSystemPrompt('zh')).toContain('只输出 JSON')
    // default (no language) is the Chinese project default
    expect(jsonSystemPrompt()).toContain('只输出 JSON')
  })
})

describe('computeBackoffMs', () => {
  it('grows exponentially but stays capped', () => {
    // random()=1 → the jitter term reaches the full capped delay.
    const at = (attempt: number) => computeBackoffMs(attempt, { baseMs: 100, random: () => 1 })
    expect(at(0)).toBe(100)
    expect(at(1)).toBe(200)
    expect(at(2)).toBe(400)
    // 100 * 2^10 = 102400 → capped at 8s
    expect(at(10)).toBe(8_000)
  })

  it('jitters below the cap so parallel stages do not retry in lockstep', () => {
    const low = computeBackoffMs(3, { baseMs: 100, random: () => 0 })
    const high = computeBackoffMs(3, { baseMs: 100, random: () => 1 })
    expect(low).toBe(400)
    expect(high).toBe(800)
    expect(low).toBeLessThan(high)
  })

  it('prefers a provider Retry-After over our own backoff', () => {
    expect(computeBackoffMs(0, { baseMs: 500, random: () => 0, retryAfterMs: 5_000 })).toBe(5_000)
    // but never beyond the cap
    expect(computeBackoffMs(0, { baseMs: 500, retryAfterMs: 60_000 })).toBe(8_000)
  })
})

describe('parseRetryAfter', () => {
  it('reads a delay in seconds', () => {
    expect(parseRetryAfter('2')).toBe(2_000)
    expect(parseRetryAfter('0')).toBe(0)
  })

  it('reads an HTTP date', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:03 GMT', now)).toBe(3_000)
  })

  it('ignores junk and clamps dates in the past', () => {
    expect(parseRetryAfter('soon')).toBeNull()
    expect(parseRetryAfter(null)).toBeNull()
    const now = Date.parse('2026-01-01T00:00:10Z')
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:00 GMT', now)).toBe(0)
  })
})

describe('callLLM', () => {
  it('posts to /v1/chat/completions with auth and the model name', async () => {
    const fetchMock = mockFetch(okResponse(completion('{"ok":true}')))

    const out = await callLLM('do it', CONFIG, 'en', { temperature: 0.1, maxTokens: 128 })
    expect(out).toBe('{"ok":true}')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-test')

    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('test-model')
    expect(body.temperature).toBe(0.1)
    expect(body.max_tokens).toBe(128)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1]).toEqual({ role: 'user', content: 'do it' })
    // No tools requested → the API must not receive an empty tools array.
    expect(body.tools).toBeUndefined()
  })

  it('does not double a /v1 suffix already present in baseUrl', async () => {
    const fetchMock = mockFetch(okResponse(completion('x')))
    await callLLM('hi', { ...CONFIG, baseUrl: 'https://api.example.com/v1' })
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
  })

  it('surfaces HTTP failures with the status and a body excerpt', async () => {
    mockFetch(httpError(400, 'bad request'))
    await expect(callLLM('hi', CONFIG, undefined, { retries: 0 })).rejects.toThrow(/400.*bad request/)
  })

  it('rejects an empty completion instead of returning an empty string', async () => {
    mockFetch(okResponse(completion(null)))
    await expect(callLLM('hi', CONFIG, undefined, { retries: 0 })).rejects.toThrow(/empty LLM response/)
  })

  it('retries a 429 and succeeds on the next attempt', async () => {
    const fetchMock = mockFetchSequence(
      {
        ok: false,
        status: 429,
        headers: { get: () => '0' } as unknown as Headers,
        text: async () => 'rate limited',
      },
      okResponse(completion('{"ok":true}')),
    )

    const out = await callLLM('hi', CONFIG, undefined, { retries: 2, backoffBaseMs: 1 })
    expect(out).toBe('{"ok":true}')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(llmUsageTotals().retries).toBe(1)
  })

  it('retries a 5xx but gives up after the configured attempts', async () => {
    const fetchMock = mockFetchSequence(
      httpError(503, 'unavailable'),
      httpError(503, 'unavailable'),
      httpError(503, 'unavailable'),
    )

    await expect(callLLM('hi', CONFIG, undefined, { retries: 2, backoffBaseMs: 1 }))
      .rejects.toThrow(/503/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry an auth failure — a bad key stays bad', async () => {
    const fetchMock = mockFetchSequence(httpError(401, 'invalid api key'))

    await expect(callLLM('hi', CONFIG, undefined, { retries: 3, backoffBaseMs: 1 }))
      .rejects.toThrow(/401/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a transport failure (connection reset) rather than failing the stage', async () => {
    let calls = 0
    const fn = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw new Error('ECONNRESET')
      return okResponse(completion('{"ok":true}')) as unknown as Response
    })
    vi.stubGlobal('fetch', fn)

    await expect(callLLM('hi', CONFIG, undefined, { retries: 1, backoffBaseMs: 1 }))
      .resolves.toBe('{"ok":true}')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('marks a non-retriable failure so callers know a retry will not help', async () => {
    mockFetch(httpError(403, 'forbidden'))

    const err = await callLLM('hi', CONFIG, undefined, { retries: 0 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect((err as LlmError).retriable).toBe(false)
    expect((err as LlmError).status).toBe(403)
  })
})

describe('chatCompletion', () => {
  it('passes tool schemas through and returns tool_calls with no text content', async () => {
    const fetchMock = mockFetch(okResponse({
      choices: [{
        message: {
          content: null,
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'search_code', arguments: '{"q":"x"}' } }],
        },
      }],
    }))

    const { message, attempts } = await chatCompletion(CONFIG, {
      messages: [{ role: 'user', content: 'where is auth' }],
      tools: [{
        type: 'function',
        function: { name: 'search_code', description: 'search', parameters: { type: 'object', properties: {} } },
      }],
      temperature: 0.3,
      maxTokens: 2048,
    })

    // A tool-call turn has no prose; treating that as "empty response" would break
    // the ReAct loop on its very first step.
    expect(message.tool_calls).toHaveLength(1)
    expect(message.tool_calls?.[0].function.name).toBe('search_code')
    expect(attempts).toBe(1)

    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.tools).toHaveLength(1)
    expect(body.tool_choice).toBe('auto')
  })

  it('meters reported tokens across calls', async () => {
    mockFetch(okResponse(completion('hello', { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 })))
    await chatCompletion(CONFIG, { messages: [{ role: 'user', content: 'hi' }] })
    mockFetch(okResponse(completion('again', { prompt_tokens: 10, completion_tokens: 5 })))
    await chatCompletion(CONFIG, { messages: [{ role: 'user', content: 'hi' }] })

    const totals = llmUsageTotals()
    expect(totals.calls).toBe(2)
    expect(totals.promptTokens).toBe(130)
    expect(totals.completionTokens).toBe(35)
    // The provider omitted total_tokens on the second call; the sum is the fallback.
    expect(totals.totalTokens).toBe(165)
  })

  it('counts a failed call so the failure rate is observable', async () => {
    mockFetch(httpError(400, 'nope'))
    await chatCompletion(CONFIG, { messages: [{ role: 'user', content: 'hi' }], retries: 0 })
      .catch(() => undefined)
    expect(llmUsageTotals().failedCalls).toBe(1)
    expect(llmUsageTotals().calls).toBe(0)
  })

  it('honours caller cancellation without retrying', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchMock = mockFetch(okResponse(completion('never used')))

    await expect(chatCompletion(CONFIG, {
      messages: [{ role: 'user', content: 'hi' }],
      signal: controller.signal,
      retries: 3,
    })).rejects.toThrow(/aborted/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
