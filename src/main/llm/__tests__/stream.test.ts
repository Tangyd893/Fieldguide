/**
 * Streaming transport: SSE framing, tool-call fragment merging, cancel semantics.
 *
 * The awkward parts of streaming are exactly the ones that only show up in
 * production — a JSON frame split across two network chunks, a tool call whose
 * arguments arrive in three pieces, a provider that rejects `stream_options`, and a
 * retry that would replay text the reader has already seen. Each is pinned here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  chatCompletion,
  consumeStreamPayload,
  createStreamAccumulator,
  readStreamedCompletion,
  streamAccumulatorToMessage,
} from '../client'

const CONFIG = { baseUrl: 'https://api.example.com/v1', apiKey: 'k', chatModel: 'm' }

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('consumeStreamPayload', () => {
  it('accumulates content deltas and reports each delta', () => {
    const acc = createStreamAccumulator()
    const frame = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`
    expect(consumeStreamPayload(acc, frame('Hel').slice(6))).toBe('Hel')
    expect(consumeStreamPayload(acc, frame('lo').slice(6))).toBe('lo')
    expect(acc.content).toBe('Hello')
  })

  it('merges tool-call fragments by index instead of overwriting', () => {
    const acc = createStreamAccumulator()
    consumeStreamPayload(acc, JSON.stringify({
      choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'search_nodes', arguments: '{"qu' } }] } }],
    }))
    consumeStreamPayload(acc, JSON.stringify({
      choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ery":"cache"}' } }] } }],
    }))

    const message = streamAccumulatorToMessage(acc)
    expect(message.tool_calls).toHaveLength(1)
    expect(message.tool_calls?.[0].function.name).toBe('search_nodes')
    expect(JSON.parse(message.tool_calls![0].function.arguments)).toEqual({ query: 'cache' })
  })

  it('keeps several tool calls apart by index', () => {
    const acc = createStreamAccumulator()
    consumeStreamPayload(acc, JSON.stringify({
      choices: [{ delta: { tool_calls: [
        { index: 0, id: 'a', function: { name: 'list_layers', arguments: '{}' } },
        { index: 1, id: 'b', function: { name: 'list_concept_links', arguments: '{}' } },
      ] } }],
    }))
    expect(streamAccumulatorToMessage(acc).tool_calls?.map((c) => c.function.name)).toEqual([
      'list_layers', 'list_concept_links',
    ])
  })

  it('records usage, marks [DONE], and ignores malformed frames', () => {
    const acc = createStreamAccumulator()
    expect(consumeStreamPayload(acc, '[DONE]')).toBe('')
    expect(acc.done).toBe(true)
    expect(consumeStreamPayload(acc, '{not json')).toBe('')
    consumeStreamPayload(acc, JSON.stringify({ choices: [], usage: { total_tokens: 42 } }))
    expect(acc.usage).toEqual({ total_tokens: 42 })
  })
})

describe('readStreamedCompletion', () => {
  it('reassembles frames split across network chunks', async () => {
    // One JSON frame deliberately cut in the middle of the word.
    const resp = sseResponse([
      'data: {"choices":[{"delta":{"content":"队列"',
      '}}]}\n\ndata: {"choices":[{"delta":{"content":"满了"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    const deltas: string[] = []
    const { message } = await readStreamedCompletion(resp, (t) => deltas.push(t))
    expect(deltas.join('')).toBe('队列满了')
    expect(message.content).toBe('队列满了')
  })

  it('handles a final frame without a trailing newline', async () => {
    const resp = sseResponse(['data: {"choices":[{"delta":{"content":"tail"}}]}'])
    const { message } = await readStreamedCompletion(resp, () => {})
    expect(message.content).toBe('tail')
  })
})

describe('chatCompletion streaming', () => {
  it('streams deltas and returns the assembled message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      'data: {"choices":[{"delta":{"content":"一半"}}]}\n',
      'data: {"choices":[{"delta":{"content":"一半"}}]}\n',
      'data: [DONE]\n',
    ])))

    const deltas: string[] = []
    const result = await chatCompletion(CONFIG, {
      messages: [{ role: 'user', content: 'hi' }],
      onDelta: (t) => deltas.push(t),
      retries: 0,
    })
    expect(deltas).toEqual(['一半', '一半'])
    expect(result.message.content).toBe('一半一半')
  })

  it('retries a failure that happens before any delta reached the reader', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1
      if (call === 1) return new Response('boom', { status: 503 })
      return sseResponse(['data: {"choices":[{"delta":{"content":"ok"}}]}\n'])
    }))

    const result = await chatCompletion(CONFIG, {
      messages: [{ role: 'user', content: 'hi' }],
      onDelta: () => {},
      retries: 1,
      backoffBaseMs: 1,
    })
    expect(call).toBe(2)
    expect(result.message.content).toBe('ok')
  })

  it('does not retry once text has been shown (it would duplicate the answer)', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1
      if (call === 1) {
        // Stream one delta, then die mid-stream.
        const encoder = new TextEncoder()
        let sent = false
        const stream = new ReadableStream<Uint8Array>({
          pull(controller) {
            if (!sent) {
              sent = true
              controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"part"}}]}\n'))
              return
            }
            controller.error(new Error('connection reset'))
          },
        })
        return new Response(stream, { status: 200 })
      }
      return sseResponse(['data: {"choices":[{"delta":{"content":"retry"}}]}\n'])
    }))

    const deltas: string[] = []
    await expect(
      chatCompletion(CONFIG, {
        messages: [{ role: 'user', content: 'hi' }],
        onDelta: (t) => deltas.push(t),
        retries: 2,
        backoffBaseMs: 1,
      }),
    ).rejects.toThrow()
    expect(deltas).toEqual(['part'])
    expect(call).toBe(1) // the retry never happened
  })

  it('falls back to non-streaming when the gateway rejects stream_options', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      call += 1
      const body = JSON.parse(String(init?.body ?? '{}'))
      if (body.stream_options) {
        return new Response('unknown field stream_options', { status: 400 })
      }
      return new Response(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
        usage: { total_tokens: 3 },
      }), { status: 200 })
    }))

    const result = await chatCompletion(CONFIG, {
      messages: [{ role: 'user', content: 'hi' }],
      onDelta: () => {},
      retries: 1,
    })
    expect(call).toBe(2)
    expect(result.message.content).toBe('ok')
  })

  it('reports a caller abort as non-retriable', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn(async () => {
      controller.abort()
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    }))

    await expect(
      chatCompletion(CONFIG, {
        messages: [{ role: 'user', content: 'hi' }],
        onDelta: () => {},
        signal: controller.signal,
        retries: 2,
      }),
    ).rejects.toMatchObject({ message: 'aborted', retriable: false })
  })
})
