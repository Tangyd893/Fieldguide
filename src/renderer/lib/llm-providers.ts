/**
 * Renderer-facing LLM provider helpers — backed by shared builtin catalog.
 * Settings prefers live catalog from `llm:listProviders` IPC when available.
 */
export {
  BUILTIN_LLM_PROVIDERS as LLM_PROVIDERS,
  getBuiltinProvider as getProvider,
  matchProviderId,
  migrateLegacyChatModel,
  type LlmProviderCatalogEntry as LlmProviderPreset,
} from '../../shared/llm-catalog'
