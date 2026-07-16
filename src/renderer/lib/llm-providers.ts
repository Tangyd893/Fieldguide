/**
 * Common LLM provider presets — pick vendor then model.
 */
export interface LlmProviderPreset {
  id: string
  /** i18n key under settings.providers.* */
  labelKey: string
  baseUrl: string
  models: string[]
  /** Default embedding model (optional — empty if provider has no embeddings) */
  embedModels?: string[]
  /** Allow free-form model name */
  customModel?: boolean
}

export const LLM_PROVIDERS: LlmProviderPreset[] = [
  {
    id: 'deepseek',
    labelKey: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
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
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-latest'],
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
      'deepseek/deepseek-chat',
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

export function matchProviderId(baseUrl: string): string {
  const normalized = (baseUrl || '').replace(/\/+$/, '').toLowerCase()
  if (!normalized) return 'custom'
  for (const p of LLM_PROVIDERS) {
    if (p.id === 'custom') continue
    const u = p.baseUrl.replace(/\/+$/, '').toLowerCase()
    if (normalized === u || normalized.startsWith(u + '/')) return p.id
  }
  return 'custom'
}

export function getProvider(id: string): LlmProviderPreset {
  return LLM_PROVIDERS.find((p) => p.id === id) ?? LLM_PROVIDERS[LLM_PROVIDERS.length - 1]
}
