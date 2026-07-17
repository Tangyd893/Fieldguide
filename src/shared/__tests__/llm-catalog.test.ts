import { describe, expect, it } from 'vitest'
import {
  BUILTIN_LLM_PROVIDERS,
  getBuiltinProvider,
  matchProviderId,
  migrateLegacyChatModel,
  looksLikeEmbeddingModel,
} from '../llm-catalog'
import { joinLlmUrl } from '../llm-url'

describe('llm-catalog', () => {
  it('lists DeepSeek V4 chat models (not retired aliases)', () => {
    const ds = getBuiltinProvider('deepseek')
    expect(ds.models).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro'])
    expect(ds.baseUrl).toBe('https://api.deepseek.com/v1')
  })

  it('migrates legacy DeepSeek model ids', () => {
    expect(migrateLegacyChatModel('deepseek-chat')).toBe('deepseek-v4-flash')
    expect(migrateLegacyChatModel('deepseek-reasoner')).toBe('deepseek-v4-flash')
    expect(migrateLegacyChatModel('deepseek-v4-pro')).toBe('deepseek-v4-pro')
  })

  it('matches DeepSeek base URLs with or without /v1', () => {
    expect(matchProviderId('https://api.deepseek.com/v1')).toBe('deepseek')
    expect(matchProviderId('https://api.deepseek.com')).toBe('deepseek')
    expect(matchProviderId('https://api.openai.com/v1')).toBe('openai')
  })

  it('exposes builtin catalog entries for all default providers', () => {
    const ids = BUILTIN_LLM_PROVIDERS.map((p) => p.id)
    expect(ids).toContain('deepseek')
    expect(ids).toContain('openai')
    expect(ids).toContain('ollama')
    expect(ids).toContain('custom')
  })

  it('classifies embedding model ids', () => {
    expect(looksLikeEmbeddingModel('text-embedding-3-small')).toBe(true)
    expect(looksLikeEmbeddingModel('deepseek-v4-flash')).toBe(false)
  })

  it('joins /v1/models without doubling /v1', () => {
    expect(joinLlmUrl('https://api.deepseek.com/v1', '/v1/models')).toBe(
      'https://api.deepseek.com/v1/models',
    )
  })
})
