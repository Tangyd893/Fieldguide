/**
 * Tests for config-bridge.ts — locale mapping and LLM config helpers.
 *
 * Vitest mocks the Electron `app` module since we run in Node, not Electron.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Electron app module before any imports that use it
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/appdata'),
  },
}))

import { toUALanguage, fromUALanguage } from '../config-bridge'

describe('toUALanguage', () => {
  it('maps zh-CN → zh', () => {
    expect(toUALanguage('zh-CN')).toBe('zh')
  })

  it('maps zh-TW → zh-TW', () => {
    expect(toUALanguage('zh-TW')).toBe('zh-TW')
  })

  it('maps en-US → en', () => {
    expect(toUALanguage('en-US')).toBe('en')
  })

  it('falls back to zh for unknown locales', () => {
    expect(toUALanguage('ja-JP' as never)).toBe('zh')
  })
})

describe('fromUALanguage', () => {
  it('maps zh → zh-CN', () => {
    expect(fromUALanguage('zh')).toBe('zh-CN')
  })

  it('maps zh-TW → zh-TW', () => {
    expect(fromUALanguage('zh-TW')).toBe('zh-TW')
  })

  it('maps en → en-US', () => {
    expect(fromUALanguage('en')).toBe('en-US')
  })

  it('falls back to zh-CN for unknown', () => {
    expect(fromUALanguage('fr')).toBe('zh-CN')
  })
})

// isLLMConfigured and maskedApiKey depend on loadConfig() which reads from disk.
// Skip in unit tests — covered by integration tests.
describe('isLLMConfigured', () => {
  it.skip('returns false when no config exists (requires Electron or mock fs)', () => {
    // Covered by integration tests with real Electron
  })
})

describe('maskedApiKey', () => {
  it.skip('returns "未配置" when no key is set (requires Electron or mock fs)', () => {
    // Covered by integration tests with real Electron
  })
})
