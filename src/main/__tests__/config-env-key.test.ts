import { describe, it, expect } from 'vitest'
import { envApiKey } from '../config'

/**
 * Environment-supplied API keys.
 *
 * The rules that matter: a provider-specific variable must only be used for that
 * provider (never sent to someone else's endpoint), the generic variable is the
 * fallback, and blanks/whitespace count as "not set".
 */
describe('envApiKey', () => {
  it('reads the provider variable matching the base URL', () => {
    expect(envApiKey('https://api.deepseek.com/v1', { DEEPSEEK_API_KEY: 'sk-ds' }))
      .toEqual({ key: 'sk-ds', name: 'DEEPSEEK_API_KEY' })
    expect(envApiKey('https://api.openai.com/v1', { OPENAI_API_KEY: 'sk-oa' }))
      .toEqual({ key: 'sk-oa', name: 'OPENAI_API_KEY' })
  })

  it('never sends one provider\'s key to another provider', () => {
    // A stray DEEPSEEK_API_KEY in the environment must not be forwarded to OpenAI.
    expect(envApiKey('https://api.openai.com/v1', { DEEPSEEK_API_KEY: 'sk-ds' })).toBeNull()
    expect(envApiKey('https://api.moonshot.cn/v1', { DEEPSEEK_API_KEY: 'sk-ds' })).toBeNull()
  })

  it('accepts the generic variable for any endpoint', () => {
    expect(envApiKey('http://localhost:11434/v1', { FIELDGUIDE_API_KEY: 'sk-any' }))
      .toEqual({ key: 'sk-any', name: 'FIELDGUIDE_API_KEY' })
    // …and it also works for a known provider when the specific one is absent.
    expect(envApiKey('https://api.deepseek.com/v1', { FIELDGUIDE_API_KEY: 'sk-any' })?.name)
      .toBe('FIELDGUIDE_API_KEY')
  })

  it('prefers the provider variable over the generic one', () => {
    const env = { DEEPSEEK_API_KEY: 'sk-ds', FIELDGUIDE_API_KEY: 'sk-any' }
    expect(envApiKey('https://api.deepseek.com/v1', env)?.name).toBe('DEEPSEEK_API_KEY')
  })

  it('treats blank and whitespace values as unset', () => {
    expect(envApiKey('https://api.deepseek.com/v1', { DEEPSEEK_API_KEY: '' })).toBeNull()
    expect(envApiKey('https://api.deepseek.com/v1', { DEEPSEEK_API_KEY: '   ' })).toBeNull()
    expect(envApiKey('https://api.deepseek.com/v1', {})).toBeNull()
  })

  it('trims a value that came with padding', () => {
    expect(envApiKey('https://api.deepseek.com/v1', { DEEPSEEK_API_KEY: ' sk-ds ' })?.key).toBe('sk-ds')
  })

  it('does not match an unrelated host that merely contains the word', () => {
    // 'deepseek' inside a self-hosted hostname is still DeepSeek-compatible, so it
    // matches on purpose — but an unrelated provider must not.
    expect(envApiKey('https://my-proxy.example.com/v1', { DEEPSEEK_API_KEY: 'sk-ds' })).toBeNull()
  })
})
