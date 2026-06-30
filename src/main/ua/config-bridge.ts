/**
 * Config Bridge — syncs Fieldguide config ↔ UA runtime settings.
 *
 * Locale mapping (architecture.md §4.4):
 *   zh-CN → zh, zh-TW → zh-TW, en-US → en
 *
 * LLM config: single source in %APPDATA%/Fieldguide/config.json,
 * bridged to UA runtime when indexing.
 */
import { loadConfig, type AppConfig } from '../config'

/** Fieldguide locale → UA --language flag */
export function toUALanguage(locale: AppConfig['locale']): 'zh' | 'zh-TW' | 'en' {
  const map: Record<string, 'zh' | 'zh-TW' | 'en'> = {
    'zh-CN': 'zh',
    'zh-TW': 'zh-TW',
    'en-US': 'en',
  }
  return map[locale] ?? 'zh'
}

/** UA --language → Fieldguide locale */
export function fromUALanguage(uaLang: string): AppConfig['locale'] {
  const map: Record<string, AppConfig['locale']> = {
    zh: 'zh-CN',
    'zh-TW': 'zh-TW',
    en: 'en-US',
  }
  return map[uaLang] ?? 'zh-CN'
}

/** Build UA-compatible runtime config from Fieldguide config */
export function buildUARuntimeConfig() {
  const config = loadConfig()
  return {
    language: toUALanguage(config.locale),
    incremental: config.ua.incremental,
    llm: {
      baseUrl: config.llm.baseUrl,
      apiKey: config.llm.apiKey,
      chatModel: config.llm.chatModel,
      embedModel: config.llm.embedModel,
    },
  }
}

/** Check if LLM is configured (has API key) */
export function isLLMConfigured(): boolean {
  const config = loadConfig()
  return !!(config.llm.apiKey && config.llm.baseUrl && config.llm.chatModel)
}

/** Get a masked API key for display */
export function maskedApiKey(): string {
  const config = loadConfig()
  const key = config.llm.apiKey
  if (!key) return '未配置'
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '…' + key.slice(-4)
}
