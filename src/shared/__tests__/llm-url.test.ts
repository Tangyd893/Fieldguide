import { describe, expect, it } from 'vitest'
import { joinLlmUrl } from '../../shared/llm-url'

describe('joinLlmUrl', () => {
  it('appends path when base has no /v1', () => {
    expect(joinLlmUrl('https://api.example.com', '/v1/chat/completions'))
      .toBe('https://api.example.com/v1/chat/completions')
  })

  it('does not double /v1 when base already ends with /v1', () => {
    expect(joinLlmUrl('https://api.deepseek.com/v1', '/v1/chat/completions'))
      .toBe('https://api.deepseek.com/v1/chat/completions')
    expect(joinLlmUrl('https://api.openai.com/v1/', '/v1/embeddings'))
      .toBe('https://api.openai.com/v1/embeddings')
  })

  it('trims trailing slashes on base', () => {
    expect(joinLlmUrl('https://api.example.com/', '/v1/chat/completions'))
      .toBe('https://api.example.com/v1/chat/completions')
  })
})
