/**
 * Built-in LLM provider catalog — base URLs + known-good model IDs.
 * Live `/models` fetch (main process) can override `models` / `embedModels`.
 */
export interface LlmProviderCatalogEntry {
  id: string
  /** i18n key under settings.providers.* */
  labelKey: string
  baseUrl: string
  /** Chat / completion model IDs shown in the dropdown */
  models: string[]
  /** Embedding model IDs (empty if provider has none or unknown) */
  embedModels: string[]
  /** Allow typing a free-form model id */
  customModel?: boolean
  /** How models were resolved */
  source?: 'builtin' | 'live'
}

/** Current DeepSeek V4 IDs (legacy deepseek-chat / deepseek-reasoner retire 2026-07-24). */
export const DEEPSEEK_CHAT_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const
export const DEEPSEEK_LEGACY_MODELS = ['deepseek-chat', 'deepseek-reasoner'] as const

export const BUILTIN_LLM_PROVIDERS: LlmProviderCatalogEntry[] = [
  {
    id: 'deepseek',
    labelKey: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [...DEEPSEEK_CHAT_MODELS],
    embedModels: [],
  },
  {
    id: 'openai',
    labelKey: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
    embedModels: ['text-embedding-3-small', 'text-embedding-3-large'],
  },
  {
    id: 'moonshot',
    labelKey: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.5', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-latest'],
    embedModels: ['moonshot-v1-embedding'],
  },
  {
    id: 'siliconflow',
    labelKey: 'siliconflow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/Qwen2.5-Coder-32B-Instruct',
    ],
    embedModels: ['BAAI/bge-m3', 'netease-youdao/bce-embedding-base_v1'],
  },
  {
    id: 'openrouter',
    labelKey: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-chat-v3-0324',
    ],
    embedModels: ['openai/text-embedding-3-small'],
    customModel: true,
  },
  {
    id: 'ollama',
    labelKey: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3.2', 'qwen2.5-coder', 'deepseek-r1'],
    embedModels: ['nomic-embed-text', 'mxbai-embed-large'],
    customModel: true,
  },
  {
    id: 'custom',
    labelKey: 'custom',
    baseUrl: '',
    models: [],
    embedModels: [],
    customModel: true,
  },
]

export function matchProviderId(baseUrl: string, providers: LlmProviderCatalogEntry[] = BUILTIN_LLM_PROVIDERS): string {
  const normalized = (baseUrl || '').replace(/\/+$/, '').toLowerCase()
  if (!normalized) return 'custom'
  for (const p of providers) {
    if (p.id === 'custom') continue
    const u = p.baseUrl.replace(/\/+$/, '').toLowerCase()
    if (!u) continue
    if (normalized === u || normalized.startsWith(u + '/')) return p.id
    // DeepSeek docs also use https://api.deepseek.com without /v1
    if (p.id === 'deepseek' && (normalized === 'https://api.deepseek.com' || normalized.startsWith('https://api.deepseek.com/'))) {
      return 'deepseek'
    }
  }
  return 'custom'
}

export function getBuiltinProvider(id: string): LlmProviderCatalogEntry {
  return BUILTIN_LLM_PROVIDERS.find((p) => p.id === id) ?? BUILTIN_LLM_PROVIDERS[BUILTIN_LLM_PROVIDERS.length - 1]
}

/** Map retired DeepSeek aliases → current default chat model. */
export function migrateLegacyChatModel(model: string): string {
  if ((DEEPSEEK_LEGACY_MODELS as readonly string[]).includes(model)) {
    return 'deepseek-v4-flash'
  }
  return model
}

export function looksLikeEmbeddingModel(id: string): boolean {
  const n = id.toLowerCase()
  return (
    n.includes('embed')
    || n.includes('bge-')
    || n.includes('e5-')
    || n.includes('bce-embedding')
    || n.includes('nomic-embed')
    || n.includes('mxbai-embed')
  )
}
