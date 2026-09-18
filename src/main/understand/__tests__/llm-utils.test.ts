/**
 * Shared LLM helpers for the understanding stages.
 *
 * `callLLM` was previously duplicated across architecture/knowledge/interview;
 * this suite pins the behaviour that all three now share (URL joining, auth
 * header, error surfacing) plus the JSON extraction fallback that had to be
 * consolidated at the same time.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { callLLM, extractJson, jsonSystemPrompt, type LLMConfig } from '../llm-utils'

const CONFIG: LLMConfig = {
  baseUrl: 'https://api.example.com',
  apiKey: 'sk-test',
  chatModel: 'test-model',
}

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = vi.fn(async () => response as unknown as Response)
  vi.stubGlobal('fetch', fn)
  return fn
}

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

describe('callLLM', () => {
  it('posts to /v1/chat/completions with auth and the model name', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
    })

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
  })

  it('does not double a /v1 suffix already present in baseUrl', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'x' } }] }),
    })
    await callLLM('hi', { ...CONFIG, baseUrl: 'https://api.example.com/v1' })
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
  })

  it('surfaces HTTP failures with the status and a body excerpt', async () => {
    mockFetch({
      ok: false,
      status: 429,
      text: async () => 'rate limited, slow down',
    })
    await expect(callLLM('hi', CONFIG)).rejects.toThrow(/429.*rate limited/)
  })

  it('rejects an empty completion instead of returning an empty string', async () => {
    mockFetch({ ok: true, json: async () => ({ choices: [{ message: {} }] }) })
    await expect(callLLM('hi', CONFIG)).rejects.toThrow(/empty LLM response/)
  })
})
