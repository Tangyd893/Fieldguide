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
  zoom: number
  uiFont: string
  monoFont: string
  sidebarWidth: number
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
    zoom: 100,
    uiFont: 'Segoe UI',
    monoFont: 'Cascadia Code',
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

export function loadConfig(): AppConfig {
  const p = configPath()
  if (!existsSync(p)) {
    saveConfig(DEFAULT_CONFIG)
    return { ...DEFAULT_CONFIG }
  }
  try {
    const raw = readFileSync(p, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config: AppConfig): void {
  const dir = configDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf-8')
}

export function updateConfig(patch: Partial<AppConfig>): AppConfig {
  const current = loadConfig()
  const next = { ...current, ...patch }
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
