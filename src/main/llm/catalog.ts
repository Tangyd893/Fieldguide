/**
 * LLM provider catalog — builtin presets + optional live GET /models.
 */
import {
  BUILTIN_LLM_PROVIDERS,
  getBuiltinProvider,
  looksLikeEmbeddingModel,
  type LlmProviderCatalogEntry,
} from '../../shared/llm-catalog'
import { joinLlmUrl } from '../../shared/llm-url'
import { loadConfig } from '../config'

let catalog: LlmProviderCatalogEntry[] = BUILTIN_LLM_PROVIDERS.map((p) => ({ ...p, source: 'builtin' as const }))

export function getLlmProviderCatalog(): LlmProviderCatalogEntry[] {
  return catalog.map((p) => ({ ...p, models: [...p.models], embedModels: [...p.embedModels] }))
}

export function getCatalogProvider(id: string): LlmProviderCatalogEntry {
  return catalog.find((p) => p.id === id) ?? { ...getBuiltinProvider(id), source: 'builtin' }
}

/**
 * Warm catalog at startup: refresh Ollama if reachable (no key needed).
 * Remote providers stay on builtin lists until the user has a key / refreshes.
 */
export async function warmLlmProviderCatalog(): Promise<void> {
  catalog = BUILTIN_LLM_PROVIDERS.map((p) => ({ ...p, source: 'builtin' as const }))
  try {
    const ollama = await fetchProviderModels({
      providerId: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: '',
    })
    if (ollama.ok && ollama.models.length > 0) {
      patchCatalog('ollama', ollama.models, ollama.embedModels, 'live')
    }
  } catch {
    /* Ollama optional */
  }
}

function patchCatalog(
  id: string,
  models: string[],
  embedModels: string[],
  source: 'builtin' | 'live',
): void {
  catalog = catalog.map((p) => {
    if (p.id !== id) return p
    return {
      ...p,
      models: models.length > 0 ? models : p.models,
      embedModels: embedModels.length > 0 ? embedModels : p.embedModels,
      source,
    }
  })
}

export interface FetchModelsResult {
  ok: boolean
  models: string[]
  embedModels: string[]
  error?: string
  source: 'live' | 'builtin'
}

/**
 * Fetch OpenAI-compatible GET /models and classify chat vs embed.
 * Updates in-memory catalog for that provider when successful.
 */
export async function fetchProviderModels(opts: {
  providerId?: string
  baseUrl: string
  apiKey?: string
}): Promise<FetchModelsResult> {
  const baseUrl = (opts.baseUrl || '').trim()
  if (!baseUrl) {
    return { ok: false, models: [], embedModels: [], error: '缺少 Base URL', source: 'builtin' }
  }

  const providerId = opts.providerId || 'custom'
  const builtin = getBuiltinProvider(providerId)
  const url = joinLlmUrl(baseUrl, '/v1/models')
  const headers: Record<string, string> = { Accept: 'application/json' }
  const key = (opts.apiKey ?? '').trim()
  if (key) headers.Authorization = `Bearer ${key}`

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(12_000),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return {
        ok: false,
        models: [...builtin.models],
        embedModels: [...builtin.embedModels],
        error: `GET /models ${resp.status}: ${text.slice(0, 160)}`,
        source: 'builtin',
      }
    }
    const json = (await resp.json()) as { data?: Array<{ id?: string }> }
    const ids = (json.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    if (ids.length === 0) {
      return {
        ok: false,
        models: [...builtin.models],
        embedModels: [...builtin.embedModels],
        error: '供应商未返回模型列表',
        source: 'builtin',
      }
    }

    const embedModels = ids.filter(looksLikeEmbeddingModel)
    const models = ids.filter((id) => !looksLikeEmbeddingModel(id))
    // Prefer builtin order when ids overlap (stable UX)
    const orderedChat = mergePreferBuiltin(builtin.models, models)
    const orderedEmbed = mergePreferBuiltin(builtin.embedModels, embedModels)

    if (providerId !== 'custom') {
      patchCatalog(providerId, orderedChat, orderedEmbed, 'live')
    }

    return {
      ok: true,
      models: orderedChat,
      embedModels: orderedEmbed,
      source: 'live',
    }
  } catch (err) {
    return {
      ok: false,
      models: [...builtin.models],
      embedModels: [...builtin.embedModels],
      error: err instanceof Error ? err.message : String(err),
      source: 'builtin',
    }
  }
}

function mergePreferBuiltin(preferred: string[], live: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  // Always keep builtin recommendations first (may be ahead of provider catalog lag)
  for (const id of preferred) {
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  for (const id of live) {
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

/** Fetch models for current saved config (settings “刷新模型列表”). */
export async function fetchModelsForSavedConfig(): Promise<FetchModelsResult> {
  const config = loadConfig()
  const { matchProviderId } = await import('../../shared/llm-catalog')
  const providerId = matchProviderId(config.llm.baseUrl)
  return fetchProviderModels({
    providerId,
    baseUrl: config.llm.baseUrl,
    apiKey: config.llm.apiKey,
  })
}
