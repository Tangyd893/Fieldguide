/**
 * Config service — reads/writes %APPDATA%/Fieldguide/config.json.
 * See architecture.md §四 for schema.
 */
import { app } from 'electron'
import { join, dirname } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  chatModel: string
  embedModel: string
}

export interface UAConfig {
  language: 'zh' | 'zh-TW' | 'en'
  incremental: boolean
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
}

const DEFAULT_CONFIG: AppConfig = {
  llm: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    chatModel: 'deepseek-chat',
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
}

function configDir(): string {
  const dir = join(app.getPath('appData'), 'Fieldguide')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
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

function mergeConfig(raw: Partial<AppConfig>): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    llm: { ...DEFAULT_CONFIG.llm, ...(raw.llm || {}) },
    appearance: normalizeAppearance(raw.appearance),
    ua: { ...DEFAULT_CONFIG.ua, ...(raw.ua || {}) },
  }
}

export function loadConfig(): AppConfig {
  const p = configPath()
  if (!existsSync(p)) {
    saveConfig(DEFAULT_CONFIG)
    return { ...DEFAULT_CONFIG, llm: { ...DEFAULT_CONFIG.llm }, appearance: { ...DEFAULT_CONFIG.appearance }, ua: { ...DEFAULT_CONFIG.ua } }
  }
  try {
    const raw = readFileSync(p, 'utf-8')
    return mergeConfig(JSON.parse(raw) as Partial<AppConfig>)
  } catch {
    return { ...DEFAULT_CONFIG, llm: { ...DEFAULT_CONFIG.llm }, appearance: { ...DEFAULT_CONFIG.appearance }, ua: { ...DEFAULT_CONFIG.ua } }
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
  writeFileSync(configPath(), JSON.stringify({ ...toSave, appearance }, null, 2), 'utf-8')
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
  })
  saveConfig(next)
  return next
}

export function ensureLogDir(): string {
  const dir = join(configDir(), 'logs')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}
