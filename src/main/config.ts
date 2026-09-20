/**
 * Config service — reads/writes %APPDATA%/Fieldguide/config.json.
 * See architecture.md §四 for schema.
 *
 * The LLM API key is encrypted at rest with Electron's safeStorage (DPAPI on
 * Windows, Keychain on macOS, libsecret on Linux). It used to be written to
 * config.json in plaintext. The in-memory shape is unchanged (`llm.apiKey`), so
 * callers do not care which form is on disk.
 *
 * If the OS keyring is unavailable, the key is stored in plaintext as before and
 * `llm.apiKeyPlaintext` is set so the UI can say so.
 */
import { app, safeStorage } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { atomicWriteFileSync } from './fs-atomic'
import { migrateLegacyChatModel } from '../shared/llm-catalog'

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  chatModel: string
  embedModel: string
  /** Set when the key had to be persisted unencrypted (no OS keyring). */
  apiKeyPlaintext?: boolean
  /**
   * Where the in-memory key came from. Derived on every load, never persisted:
   * a key taken from the environment must not be copied into config.json.
   */
  apiKeySource?: 'config' | 'env'
  /** Name of the environment variable that supplied the key, when source is 'env'. */
  apiKeyEnvVar?: string
}

/**
 * Environment variables that supply an API key, most specific first.
 *
 * A developer-machine and CI convenience: the key is already exported by the shell
 * or the OS, so the app works without pasting a secret into a settings field (and
 * without that secret ever reaching disk). `FIELDGUIDE_API_KEY` is the generic
 * escape hatch for any OpenAI-compatible provider.
 */
const API_KEY_ENV_VARS: Array<{ match: RegExp; vars: string[] }> = [
  { match: /deepseek/i, vars: ['DEEPSEEK_API_KEY'] },
  { match: /openai\.com/i, vars: ['OPENAI_API_KEY'] },
  { match: /moonshot/i, vars: ['MOONSHOT_API_KEY'] },
  { match: /siliconflow/i, vars: ['SILICONFLOW_API_KEY'] },
  { match: /openrouter/i, vars: ['OPENROUTER_API_KEY'] },
]
const GENERIC_API_KEY_VARS = ['FIELDGUIDE_API_KEY']

/**
 * The key the environment offers for this base URL, or null.
 *
 * Provider-specific variables are only consulted when they plausibly belong to the
 * configured endpoint — a `DEEPSEEK_API_KEY` must not be sent to OpenAI.
 */
export function envApiKey(baseUrl: string, env: NodeJS.ProcessEnv = process.env): { key: string; name: string } | null {
  const forProvider = API_KEY_ENV_VARS.find((entry) => entry.match.test(baseUrl))
  const names = [...(forProvider?.vars ?? []), ...GENERIC_API_KEY_VARS]
  for (const name of names) {
    const value = env[name]?.trim()
    if (value) return { key: value, name }
  }
  return null
}

export interface UAConfig {
  language: 'zh' | 'zh-TW' | 'en'
  incremental: boolean
}

/**
 * Obsidian vault integration (docs/product-spec F-17).
 *
 * Everything here is opt-in: an empty `vaultPath` means "integration off" and no
 * code outside `main/obsidian/` should touch the filesystem for a vault. The
 * user's vault is somebody else's data directory, so the binding is explicit,
 * single, and validated before it is persisted (see `validateVaultDirectory`).
 */
export interface ObsidianConfig {
  /** Absolute vault directory; '' disables the integration. */
  vaultPath: string
  /** Vault name as Obsidian knows it (used for CLI `vault=`); may be ''. */
  vaultName: string
  /** Explicit CLI path override; '' = auto-resolve from PATH / install dirs. */
  cliPath: string
  /** Root folder Fieldguide owns inside the vault. */
  folder: string
  /** Sync automatically once an index run completes. */
  autoSyncOnIndex: boolean
  /** Mirror in-app code notes into the vault. */
  mirrorNotes: boolean
  /** Let the coach agent create/update cards inside the project folder. */
  agentWrite: boolean
  /** Open the index note in Obsidian after a sync. */
  openAfterSync: boolean
}

export interface AppearanceConfig {
  themePreset: 'parchment' | 'forest' | 'slate' | 'midnight' | 'paper-dark' | 'none'
  /** Shell / chrome zoom (50–200). Legacy field `zoom` is migrated on load. */
  shellZoom: number
  /** UA Dashboard iframe zoom (50–200), independent of shellZoom. */
  dashboardZoom: number
  uiFont: string
  monoFont: string
  /** Base UI font size in px (before shell zoom). */
  uiFontSize: number
  /** Code / mono font size in px (independent of UI size). */
  monoFontSize: number
  sidebarWidth: number
  /** @deprecated Migrated to shellZoom */
  zoom?: number
}

export interface AppConfig {
  llm: LLMConfig
  locale: 'zh-CN' | 'zh-TW' | 'en-US'
  theme: 'system' | 'light' | 'dark'
  appearance: AppearanceConfig
  projectsRoot: string
  onboardingCompleted: boolean
  ua: UAConfig
  obsidian: ObsidianConfig
}

const DEFAULT_CONFIG: AppConfig = {
  llm: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    chatModel: 'deepseek-v4-flash',
    embedModel: '',
  },
  locale: 'zh-CN',
  theme: 'system',
  appearance: {
    themePreset: 'parchment',
    shellZoom: 100,
    dashboardZoom: 100,
    uiFont: 'Segoe UI',
    monoFont: 'Cascadia Code',
    uiFontSize: 14,
    monoFontSize: 13,
    sidebarWidth: 260,
  },
  projectsRoot: '',
  onboardingCompleted: false,
  ua: {
    language: 'zh',
    incremental: true,
  },
  obsidian: {
    vaultPath: '',
    vaultName: '',
    cliPath: '',
    folder: 'Fieldguide',
    autoSyncOnIndex: false,
    mirrorNotes: true,
    agentWrite: true,
    openAfterSync: false,
  },
}

/** Fresh copy of the defaults, so a caller mutating one cannot poison the constant. */
function freshDefaults(): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    llm: { ...DEFAULT_CONFIG.llm },
    appearance: { ...DEFAULT_CONFIG.appearance },
    ua: { ...DEFAULT_CONFIG.ua },
    obsidian: { ...DEFAULT_CONFIG.obsidian },
  }
}

/**
 * Root directory for all app data (config, SQLite, exports, logs).
 *
 * Defaults to `%APPDATA%/Fieldguide`. `FIELDGUIDE_DATA_DIR` overrides it, which
 * gives two real use cases: a portable install (data next to the binary), and
 * end-to-end tests that must not touch the developer's own library — Electron
 * resolves `appData` through the OS API, so pointing APPDATA at a temp dir does
 * not isolate anything.
 */
export function dataDir(): string {
  const override = process.env.FIELDGUIDE_DATA_DIR?.trim()
  const dir = override ? override : join(app.getPath('appData'), 'Fieldguide')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function configDir(): string {
  return dataDir()
}

function configPath(): string {
  return join(configDir(), 'config.json')
}

function normalizeAppearance(raw: Partial<AppearanceConfig> | undefined): AppearanceConfig {
  const base = { ...DEFAULT_CONFIG.appearance }
  if (!raw) return base
  const legacyZoom = raw.zoom != null ? Number(raw.zoom) : undefined
  const shellZoom = Number(raw.shellZoom ?? legacyZoom ?? base.shellZoom)
  return {
    themePreset: raw.themePreset ?? base.themePreset,
    shellZoom: Math.max(50, Math.min(200, Number.isFinite(shellZoom) ? shellZoom : 100)),
    dashboardZoom: Math.max(50, Math.min(200, Number(raw.dashboardZoom ?? base.dashboardZoom) || 100)),
    uiFont: raw.uiFont || base.uiFont,
    monoFont: raw.monoFont || base.monoFont,
    uiFontSize: Math.max(10, Math.min(28, Number(raw.uiFontSize ?? base.uiFontSize) || 14)),
    monoFontSize: Math.max(10, Math.min(28, Number(raw.monoFontSize ?? base.monoFontSize) || 13)),
    sidebarWidth: Math.max(160, Math.min(400, Number(raw.sidebarWidth ?? base.sidebarWidth) || 260)),
  }
}

/**
 * The vault folder is a path segment Fieldguide appends to the user's vault, so
 * it must never be able to escape it: absolute paths, drive letters and `..`
 * segments are stripped rather than "fixed up", and an unusable value falls back
 * to the default.
 */
export function normalizeVaultFolder(raw: unknown): string {
  const fallback = DEFAULT_CONFIG.obsidian.folder
  if (typeof raw !== 'string') return fallback
  const cleaned = raw
    .trim()
    .replace(/^[a-zA-Z]:/, '')
    .split(/[/\\]+/)
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..' && !/[\0<>:"|?*]/.test(part))
    .join('/')
  return cleaned || fallback
}

function normalizeObsidian(raw: Partial<ObsidianConfig> | undefined): ObsidianConfig {
  const base = { ...DEFAULT_CONFIG.obsidian }
  if (!raw) return base
  return {
    vaultPath: typeof raw.vaultPath === 'string' ? raw.vaultPath.trim() : base.vaultPath,
    vaultName: typeof raw.vaultName === 'string' ? raw.vaultName.trim() : base.vaultName,
    cliPath: typeof raw.cliPath === 'string' ? raw.cliPath.trim() : base.cliPath,
    folder: normalizeVaultFolder(raw.folder ?? base.folder),
    autoSyncOnIndex: raw.autoSyncOnIndex ?? base.autoSyncOnIndex,
    mirrorNotes: raw.mirrorNotes ?? base.mirrorNotes,
    agentWrite: raw.agentWrite ?? base.agentWrite,
    openAfterSync: raw.openAfterSync ?? base.openAfterSync,
  }
}

function mergeConfig(raw: Partial<AppConfig>): AppConfig {
  const llm = { ...DEFAULT_CONFIG.llm, ...(raw.llm || {}) }
  llm.chatModel = migrateLegacyChatModel(llm.chatModel || DEFAULT_CONFIG.llm.chatModel)
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    llm,
    appearance: normalizeAppearance(raw.appearance),
    ua: { ...DEFAULT_CONFIG.ua, ...(raw.ua || {}) },
    obsidian: normalizeObsidian(raw.obsidian),
  }
}

/**
 * Overlay the environment key when — and only when — nothing was configured in-app.
 *
 * Precedence matters: a key the user typed is an explicit choice and must win, so
 * an exported variable cannot silently redirect their API calls. The source is
 * recorded so the UI can explain *why* the field is empty yet the app is
 * "configured", and so `saveConfig` knows not to write the secret to disk.
 */
function applyEnvApiKey(config: AppConfig): AppConfig {
  const stored = config.llm.apiKey?.trim() ?? ''
  if (stored) return { ...config, llm: { ...config.llm, apiKeySource: 'config', apiKeyEnvVar: undefined } }

  const fromEnv = envApiKey(config.llm.baseUrl)
  if (!fromEnv) return { ...config, llm: { ...config.llm, apiKeySource: undefined, apiKeyEnvVar: undefined } }
  return {
    ...config,
    llm: { ...config.llm, apiKey: fromEnv.key, apiKeySource: 'env', apiKeyEnvVar: fromEnv.name },
  }
}

export function loadConfig(): AppConfig {
  const p = configPath()
  if (!existsSync(p)) {
    saveConfig(DEFAULT_CONFIG)
    return applyEnvApiKey(freshDefaults())
  }
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as Partial<AppConfig> & {
      llm?: Partial<LLMConfig> & { apiKeyEnc?: string }
    }
    const encrypted = parsed.llm?.apiKeyEnc
    if (encrypted && parsed.llm) {
      parsed.llm.apiKey = decryptApiKey(encrypted) ?? ''
    }
    const merged = mergeConfig(parsed as Partial<AppConfig>)
    // Persist legacy DeepSeek model id migration once, and re-save so a
    // plaintext key gets encrypted by the writer below.
    const needsRewrite =
      (parsed.llm?.chatModel && parsed.llm.chatModel !== merged.llm.chatModel)
      || (!!parsed.llm?.apiKey && !encrypted)
    if (needsRewrite) {
      saveConfig(merged)
    }
    return applyEnvApiKey(merged)
  } catch {
    return applyEnvApiKey(freshDefaults())
  }
}

/** Encrypt for disk, or null when the OS keyring is unusable. */
function encryptApiKey(apiKey: string): string | null {
  if (!apiKey) return null
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.encryptString(apiKey).toString('base64')
  } catch {
    return null
  }
}

function decryptApiKey(encoded: string): string | null {
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch (err) {
    console.warn('[config] could not decrypt stored API key:', err)
    return null
  }
}

export function saveConfig(config: AppConfig): void {
  const dir = configDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const toSave = mergeConfig(config)
  // Drop deprecated zoom from persisted file
  const { zoom: _z, ...appearance } = toSave.appearance as AppearanceConfig & { zoom?: number }

  // `apiKeySource`/`apiKeyEnvVar` are derived on load, never persisted — and an
  // env-supplied key must not be written to disk at all, which is the whole point
  // of reading it from the environment.
  const {
    apiKey,
    apiKeySource: _s,
    apiKeyEnvVar: _e,
    ...llmWithoutKey
  } = toSave.llm
  const fromEnv = toSave.llm.apiKeySource === 'env'
  const apiKeyEnc = fromEnv ? null : encryptApiKey(apiKey)
  const llm: Record<string, unknown> = { ...llmWithoutKey }

  if (fromEnv) {
    delete llm.apiKeyEnc
    llm.apiKeyPlaintext = false
  } else if (apiKeyEnc) {
    llm.apiKeyEnc = apiKeyEnc
    llm.apiKeyPlaintext = false
  } else if (apiKey) {
    // No OS keyring (e.g. a bare Linux session): keep working, but say so.
    delete llm.apiKeyEnc
    llm.apiKey = apiKey
    llm.apiKeyPlaintext = true
  } else {
    // Key cleared: drop both forms so a stale encrypted value cannot resurrect it.
    delete llm.apiKeyEnc
    llm.apiKeyPlaintext = false
  }

  // Atomic: a half-written config would lose the user's settings and key.
  atomicWriteFileSync(configPath(), `${JSON.stringify({ ...toSave, appearance, llm }, null, 2)}\n`)
}

export function updateConfig(patch: Partial<AppConfig>): AppConfig {
  const current = loadConfig()
  const next = mergeConfig({
    ...current,
    ...patch,
    llm: patch.llm ? { ...current.llm, ...patch.llm } : current.llm,
    appearance: patch.appearance
      ? { ...current.appearance, ...patch.appearance }
      : current.appearance,
    ua: patch.ua ? { ...current.ua, ...patch.ua } : current.ua,
    obsidian: patch.obsidian ? { ...current.obsidian, ...patch.obsidian } : current.obsidian,
  })
  saveConfig(next)
  // Re-derive the key source so the returned config matches what the next
  // `loadConfig()` would produce (e.g. clearing the field must fall back to the
  // environment key rather than reporting "not configured" until a restart).
  return applyEnvApiKey(next)
}

export function ensureLogDir(): string {
  const dir = join(configDir(), 'logs')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}
