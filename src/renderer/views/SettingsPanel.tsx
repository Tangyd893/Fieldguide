/**
 * Settings — VS Code–style full page with left category nav.
 */
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Cpu, FolderOpen, Globe, Palette, Wrench, ZoomIn, Type, Plug, Check, X, Database, Info, RefreshCw,
  NotebookPen, Library, Copy, FolderPlus, Play, Unlink,
} from 'lucide-react'
import { applyTheme } from '../App'
import {
  applyAppearance,
  applyDashboardZoom,
  applyFonts,
  applyShellZoom,
  clampFontSize,
  normalizeAppearance,
  type AppearanceState,
} from '../lib/appearance'
import FolderPathField from '../components/FolderPathField'
import SteppedSlider from '../components/SteppedSlider'
import {
  LLM_PROVIDERS,
  matchProviderId,
  migrateLegacyChatModel,
  type LlmProviderPreset,
} from '../lib/llm-providers'
import { syncDashboardTheme } from '@/lib/dashboard-theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { VaultBinding, VaultCliStatus, VaultInfo } from '@shared/obsidian'

type Category = 'general' | 'appearance' | 'llm' | 'obsidian' | 'data' | 'about'

/** Obsidian config as this page edits it. */
interface ObsidianState {
  vaultPath: string
  vaultName: string
  cliPath: string
  folder: string
  autoSyncOnIndex: boolean
  mirrorNotes: boolean
  agentWrite: boolean
  openAfterSync: boolean
}

const DEFAULT_OBSIDIAN: ObsidianState = {
  vaultPath: '',
  vaultName: '',
  cliPath: '',
  folder: 'Fieldguide',
  autoSyncOnIndex: false,
  mirrorNotes: true,
  agentWrite: true,
  openAfterSync: false,
}

/**
 * Same directory, ignoring separator style and case.
 *
 * The vault list comes back from the CLI with whatever casing the OS reported, so
 * a naive comparison would keep reporting "not registered" for a vault that is.
 */
function sameVaultPath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase()
  return norm(a) === norm(b)
}

/** Registration polling budget after creating a vault. */
const REGISTER_POLL_MS = 2_500
const REGISTER_POLL_TRIES = 12

interface Props {
  t: (key: string, opts?: Record<string, unknown>) => string
  onAbout: () => void
  selectedProjectId?: string
  onAppearanceLive?: (a: AppearanceState) => void
}

export default function SettingsView({ t, onAbout, selectedProjectId, onAppearanceLive }: Props) {
  const { i18n } = useTranslation()
  const [category, setCategory] = useState<Category>('general')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [chatModel, setChatModel] = useState('')
  const [embedModel, setEmbedModel] = useState('')
  const [providerId, setProviderId] = useState('deepseek')
  const [providers, setProviders] = useState<LlmProviderPreset[]>(() => [...LLM_PROVIDERS])
  const [modelsSource, setModelsSource] = useState<'builtin' | 'live'>('builtin')
  const [apiKeySource, setApiKeySource] = useState<'config' | 'env' | 'none'>('none')
  const [apiKeyEnvVar, setApiKeyEnvVar] = useState<string | undefined>(undefined)
  const [modelsHint, setModelsHint] = useState<string | null>(null)
  const [refreshingModels, setRefreshingModels] = useState(false)
  const [customModel, setCustomModel] = useState(false)
  const [projectsRoot, setProjectsRoot] = useState('')
  const [locale, setLocale] = useState('zh-CN')
  const [theme, setTheme] = useState('system')
  const [appearance, setAppearance] = useState<AppearanceState>(() => normalizeAppearance())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [logContent, setLogContent] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [dataMsg, setDataMsg] = useState<string | null>(null)
  const [exportingReport, setExportingReport] = useState(false)

  // ── Obsidian vault integration (F-17) ──
  const [obsidian, setObsidian] = useState<ObsidianState>(() => ({ ...DEFAULT_OBSIDIAN }))
  const [cliStatus, setCliStatus] = useState<VaultCliStatus | null>(null)
  const [cliBusy, setCliBusy] = useState(false)
  const [vaults, setVaults] = useState<VaultInfo[]>([])
  const [vaultBinding, setVaultBinding] = useState<VaultBinding | null>(null)
  const [newVaultOpen, setNewVaultOpen] = useState(false)
  const [newVaultParent, setNewVaultParent] = useState('')
  const [newVaultName, setNewVaultName] = useState('')
  const [vaultBusy, setVaultBusy] = useState(false)
  const [vaultMsg, setVaultMsg] = useState<string | null>(null)
  const [unbindOpen, setUnbindOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  /** Path produced by 「新建 vault」, watched until Obsidian registers it. */
  const [pendingVault, setPendingVault] = useState<string | null>(null)
  const [registerState, setRegisterState] = useState<'idle' | 'waiting' | 'done' | 'timeout'>('idle')
  const registerTries = useRef(0)

  const patchObsidian = useCallback((patch: Partial<ObsidianState>) => {
    setObsidian((prev) => ({ ...prev, ...patch }))
  }, [])

  /** One patch object shared by save()/testConnection() so a new field cannot be wired into only one. */
  const configPatch = useCallback(() => ({
    llm: { baseUrl, apiKey, chatModel, embedModel },
    projectsRoot,
    locale,
    theme,
    appearance,
    obsidian,
  }), [baseUrl, apiKey, chatModel, embedModel, projectsRoot, locale, theme, appearance, obsidian])

  const refreshVaults = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setCliBusy(true)
    try {
      const result = await window.fieldguide.obsidianListVaults()
      if (result.ok && result.data) {
        const data = result.data as { cli: VaultCliStatus; vaults: VaultInfo[] }
        setCliStatus(data.cli)
        setVaults(Array.isArray(data.vaults) ? data.vaults : [])
        if (data.cli.state === 'ok' && obsidian.vaultPath) {
          const hit = data.vaults.find((v) => sameVaultPath(v.path, obsidian.vaultPath))
          setVaultBinding(hit ? { path: hit.path, name: hit.name, kind: 'registered' } : null)
        }
        return data
      }
      return null
    } finally {
      if (!opts?.silent) setCliBusy(false)
    }
  }, [obsidian.vaultPath])

  const detectCli = useCallback(async (cliPathOverride?: string) => {
    setCliBusy(true)
    try {
      const result = await window.fieldguide.obsidianDetectCli(cliPathOverride ?? obsidian.cliPath)
      if (result.ok && result.data) {
        setCliStatus(result.data as VaultCliStatus)
        await refreshVaults({ silent: true })
      } else if (!result.ok) {
        setCliStatus({
          state: 'error', cliPath: '', version: '', detail: result.error?.message ?? '',
          cached: false, checkedAt: new Date().toISOString(),
        })
      }
    } finally {
      setCliBusy(false)
    }
  }, [obsidian.cliPath, refreshVaults])

  const launchObsidian = useCallback(async () => {
    setCliBusy(true)
    setCliStatus((prev) => (prev ? { ...prev, state: 'app-not-running', detail: '' } : prev))
    try {
      const result = await window.fieldguide.obsidianLaunchApp()
      if (result.ok && result.data) setCliStatus(result.data as VaultCliStatus)
      await refreshVaults({ silent: true })
    } finally {
      setCliBusy(false)
    }
  }, [refreshVaults])

  async function chooseVault() {
    setVaultBusy(true)
    setVaultMsg(null)
    try {
      const result = await window.fieldguide.obsidianChooseVault()
      if (!result.ok) { setVaultMsg(result.error?.message ?? null); return }
      if (!result.data) return // cancelled
      const binding = result.data as VaultBinding
      patchObsidian({ vaultPath: binding.path, vaultName: binding.name })
      setVaultBinding(binding)
      setPendingVault(null)
      setRegisterState('idle')
    } finally {
      setVaultBusy(false)
    }
  }

  async function createVault() {
    setVaultBusy(true)
    setVaultMsg(null)
    try {
      const result = await window.fieldguide.obsidianCreateVault(newVaultParent, newVaultName)
      if (!result.ok) { setVaultMsg(result.error?.message ?? null); return }
      const data = result.data as VaultBinding & { created?: boolean }
      patchObsidian({ vaultPath: data.path, vaultName: data.name })
      setVaultBinding(data)
      setNewVaultOpen(false)
      setNewVaultName('')
      setPendingVault(data.path)
      registerTries.current = 0
      setRegisterState('waiting')
    } finally {
      setVaultBusy(false)
    }
  }

  /**
   * A freshly created folder is not a vault until Obsidian opens it as one, which
   * only the user can confirm. Poll the registry instead of pretending it worked.
   */
  useEffect(() => {
    if (registerState !== 'waiting' || !pendingVault) return
    const timer = setTimeout(async () => {
      const data = await refreshVaults({ silent: true })
      const registered = data?.vaults.some((v) => sameVaultPath(v.path, pendingVault))
      if (registered) {
        setRegisterState('done')
        const hit = data!.vaults.find((v) => sameVaultPath(v.path, pendingVault))
        if (hit) {
          patchObsidian({ vaultPath: hit.path, vaultName: hit.name })
          setVaultBinding({ path: hit.path, name: hit.name, kind: 'registered' })
        }
        return
      }
      registerTries.current += 1
      if (registerTries.current >= REGISTER_POLL_TRIES) setRegisterState('timeout')
    }, REGISTER_POLL_MS)
    return () => clearTimeout(timer)
  }, [registerState, pendingVault, refreshVaults, patchObsidian])

  /**
   * Unbind the vault.
   *
   * The main process clears the binding itself (it owns the config), so the local
   * state is reset to match instead of relying on a later Save. `cleanup` only
   * removes notes that are still byte-identical to what Fieldguide wrote — the
   * reader's own edits are reported back as "kept" rather than deleted.
   */
  async function unbindVault(mode: 'keep' | 'cleanup') {
    setVaultBusy(true)
    setVaultMsg(null)
    try {
      const result = await window.fieldguide.obsidianUnbind(mode)
      if (!result.ok) { setVaultMsg(result.error?.message ?? null); return }
      patchObsidian({ vaultPath: '', vaultName: '' })
      setVaultBinding(null)
      setPendingVault(null)
      setRegisterState('idle')
      setUnbindOpen(false)
      const removed = result.data?.removed ?? 0
      const kept = result.data?.kept.length ?? 0
      setVaultMsg(mode === 'cleanup'
        ? t('settings.obsidian.unbindCleaned', { removed, kept })
        : t('settings.obsidian.unbindDone'))
      setTimeout(() => setVaultMsg(null), 6000)
    } finally {
      setVaultBusy(false)
    }
  }

  async function copyPath(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* clipboard unavailable — ignore */ }
  }

  /**
   * Manual CLI override picker.
   *
   * Registering the CLI edits the *user* PATH, which an already-running Explorer
   * never reloads — so an app launched from Explorer can miss a CLI that works
   * fine in a fresh terminal. Picking the file explicitly is the way out.
   */
  async function pickCliFile() {
    const result = await window.fieldguide.openFileDialog({
      title: t('settings.obsidian.cliPathLabel'),
      filters: [{ name: 'Obsidian CLI', extensions: ['com', 'exe', 'cmd', 'bat'] }],
    })
    if (result.ok && result.data) {
      patchObsidian({ cliPath: result.data })
      await detectCli(result.data)
    }
  }

  // Probe once when the section is first opened; the main process caches the answer.
  useEffect(() => {
    if (category !== 'obsidian' || cliStatus !== null) return
    void refreshVaults()
  }, [category, cliStatus, refreshVaults])

  const getProvider = useCallback(
    (id: string) => providers.find((p) => p.id === id) ?? providers[providers.length - 1] ?? LLM_PROVIDERS[LLM_PROVIDERS.length - 1],
    [providers],
  )

  const applyFetchedModels = useCallback(
    (pid: string, models: string[], embedModels: string[], source: 'builtin' | 'live') => {
      setProviders((prev) =>
        prev.map((p) => (p.id === pid ? { ...p, models: [...models], embedModels: [...embedModels], source } : p)),
      )
      setModelsSource(source)
      if (models.length > 0) {
        setChatModel((cur) => (models.includes(cur) ? cur : models[0]))
        setCustomModel(false)
      }
      if (embedModels.length > 0) {
        setEmbedModel((cur) => (cur === '' || embedModels.includes(cur) ? cur : embedModels[0]))
      }
    },
    [],
  )

  const refreshModels = useCallback(
    async (opts?: { providerId?: string; baseUrl?: string; apiKey?: string; silent?: boolean }) => {
      const pid = opts?.providerId ?? providerId
      const url = opts?.baseUrl ?? baseUrl
      const key = opts?.apiKey ?? apiKey
      if (!url) return
      if (!opts?.silent) setRefreshingModels(true)
      setModelsHint(null)
      try {
        const result = await window.fieldguide.llmFetchModels({
          providerId: pid,
          baseUrl: url,
          apiKey: key,
        })
        if (result.ok && result.data) {
          const data = result.data
          applyFetchedModels(pid, data.models, data.embedModels, data.source)
          if (!data.ok && data.error) {
            setModelsHint(t('settings.modelsFetchFailed'))
          } else if (data.source === 'live') {
            setModelsHint(null)
          }
        }
      } catch {
        setModelsHint(t('settings.modelsFetchFailed'))
      } finally {
        if (!opts?.silent) setRefreshingModels(false)
      }
    },
    [providerId, baseUrl, apiKey, applyFetchedModels, t],
  )

  useEffect(() => {
    void Promise.all([
      window.fieldguide.configGet(),
      window.fieldguide.llmListProviders(),
      window.fieldguide.configLlmStatus(),
    ]).then(([configResult, catalogResult, statusResult]) => {
      if (statusResult.ok && statusResult.data) {
        const status = statusResult.data as { source?: 'config' | 'env' | 'none'; envVar?: string }
        setApiKeySource(status.source ?? 'none')
        setApiKeyEnvVar(status.envVar)
        // The environment supplies the key: keep the field empty so the secret is
        // not echoed into the renderer, and so saving cannot overwrite it.
        if (status.source === 'env') setApiKey('')
      }
      if (catalogResult.ok && Array.isArray(catalogResult.data) && catalogResult.data.length > 0) {
        setProviders(catalogResult.data as LlmProviderPreset[])
      }
      if (configResult.ok && configResult.data) {
        const c = configResult.data as Record<string, unknown>
        const llm = (c.llm as Record<string, string>) || {}
        const url = llm.baseUrl || ''
        const key = llm.apiKey || ''
        const model = migrateLegacyChatModel(llm.chatModel || '')
        setBaseUrl(url)
        setApiKey(key)
        setChatModel(model)
        setEmbedModel(llm.embedModel || '')
        const pid = matchProviderId(url)
        setProviderId(pid)
        const catalog = (catalogResult.ok && Array.isArray(catalogResult.data)
          ? catalogResult.data
          : LLM_PROVIDERS) as LlmProviderPreset[]
        const preset = catalog.find((p) => p.id === pid) ?? catalog[catalog.length - 1]
        setModelsSource(preset?.source === 'live' ? 'live' : 'builtin')
        setCustomModel(
          pid === 'custom'
          || (!!model && (preset?.models?.length ?? 0) > 0 && !preset!.models.includes(model))
          || (!!preset?.customModel && !!model && !(preset.models ?? []).includes(model)),
        )
        setProjectsRoot((c.projectsRoot as string) || '')
        setLocale((c.locale as string) || 'zh-CN')
        setTheme((c.theme as string) || 'system')
        setAppearance(normalizeAppearance(c.appearance as Record<string, unknown> | undefined))
        const obs = (c.obsidian as Partial<ObsidianState>) || {}
        setObsidian({ ...DEFAULT_OBSIDIAN, ...obs })
        if (obs.vaultPath && !obs.vaultName) {
          setVaultBinding({ path: obs.vaultPath, name: '', kind: 'unregistered' })
        }

        // Live models when key present (or Ollama without key)
        if (url && (key || pid === 'ollama')) {
          void window.fieldguide.llmFetchModels({ providerId: pid, baseUrl: url, apiKey: key }).then((r) => {
            if (r.ok && r.data && r.data.models.length > 0) {
              applyFetchedModels(pid, r.data.models, r.data.embedModels, r.data.source)
              if (!r.data.ok && r.data.error) setModelsHint(t('settings.modelsFetchFailed'))
            }
          })
        }
      }
    })
  }, [applyFetchedModels, t])

  const patchAppearance = useCallback((patch: Partial<AppearanceState>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...patch }
      if (patch.shellZoom != null || patch.uiFontSize != null) {
        applyShellZoom(next.shellZoom, next.uiFontSize)
      }
      if (patch.dashboardZoom != null) applyDashboardZoom(next.dashboardZoom)
      if (patch.uiFont != null || patch.monoFont != null || patch.uiFontSize != null || patch.monoFontSize != null) {
        applyFonts(next.uiFont, next.monoFont, next.uiFontSize, next.monoFontSize)
        applyShellZoom(next.shellZoom, next.uiFontSize)
      }
      onAppearanceLive?.(next)
      return next
    })
  }, [onAppearanceLive])

  async function save() {
    setSaving(true)
    await window.fieldguide.configSet(configPatch())
    i18n.changeLanguage(locale)
    applyTheme(theme, appearance.themePreset === 'none' ? undefined : appearance.themePreset)
    applyAppearance(appearance)
    syncDashboardTheme()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testConnection() {
    if (!baseUrl || !apiKey || !chatModel) {
      setTestResult('fail')
      return
    }
    await window.fieldguide.configSet(configPatch())
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.fieldguide.configTestLlm()
      setTestResult(result.ok ? 'success' : 'fail')
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
    }
  }

  async function loadLogs() {
    setLogLoading(true)
    try {
      const result = await window.fieldguide.diagnosticsGetLogs(200)
      if (result.ok && result.data) {
        setLogContent((result.data as { content?: string }).content || '')
        setShowLogs(true)
      }
    } catch { /* ignore */ }
    setLogLoading(false)
  }

  /** The CLI is a hard gate: neither vault action is offered without it. */
  const cliOk = cliStatus?.state === 'ok'

  const nav: { id: Category; label: string; icon: ReactNode }[] = [
    { id: 'general', label: t('settings.nav.general'), icon: <Globe size={16} /> },
    { id: 'appearance', label: t('settings.nav.appearance'), icon: <Palette size={16} /> },
    { id: 'llm', label: t('settings.nav.llm'), icon: <Cpu size={16} /> },
    { id: 'obsidian', label: t('settings.nav.obsidian'), icon: <NotebookPen size={16} /> },
    { id: 'data', label: t('settings.nav.data'), icon: <Database size={16} /> },
    { id: 'about', label: t('settings.nav.about'), icon: <Info size={16} /> },
  ]

  return (
    <div className="h-full flex bg-[var(--fg-bg)]" data-fg-surface>
      {/* Left category nav — fixed rem feel via text-sm; grows with shell zoom naturally */}
      <aside className="w-52 shrink-0 border-r border-[var(--fg-border)] bg-[var(--fg-sidebar-bg,var(--fg-card))] flex flex-col">
        <div className="px-4 py-4 border-b border-[var(--fg-border)]">
          <h1 className="text-base font-semibold text-[var(--fg-text-primary)]">{t('settings.title')}</h1>
          <p className="text-xs text-[var(--fg-text-tertiary)] mt-0.5">{t('settings.subtitle')}</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-auto">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors',
                category === item.id
                  ? 'bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] font-medium'
                  : 'text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-[var(--fg-border)] flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-status-success)]">
              <Check size={12} /> {t('settings.saved')}
            </span>
          )}
          <div className="flex-1" />
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? t('settings.saving') : t('settings.save')}
          </Button>
        </div>
      </aside>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-8">
          {category === 'general' && (
            <>
              <Section icon={<Globe size={16} />} title={t('settings.language')}>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { v: 'zh-CN', l: '简体中文' },
                    { v: 'zh-TW', l: '繁體中文' },
                    { v: 'en-US', l: 'English' },
                  ].map((opt) => (
                    <ChoiceChip key={opt.v} active={locale === opt.v} onClick={() => setLocale(opt.v)} label={opt.l} />
                  ))}
                </div>
              </Section>

              <Section icon={<FolderOpen size={16} />} title={t('settings.projectsRoot')}>
                <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">{t('settings.projectsRootLabel')}</label>
                <FolderPathField
                  value={projectsRoot}
                  onChange={setProjectsRoot}
                  placeholder="D:\\Projects"
                  browseLabel={t('common.browseFolder')}
                />
                <p className="text-xs text-[var(--fg-text-tertiary)] mt-1.5">{t('settings.projectsRootHint')}</p>
              </Section>
            </>
          )}

          {category === 'appearance' && (
            <>
              <Section icon={<Palette size={16} />} title={t('settings.theme')}>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { v: 'system', l: t('settings.themeSystem') },
                    { v: 'light', l: t('settings.themeLight') },
                    { v: 'dark', l: t('settings.themeDark') },
                  ].map((opt) => (
                    <ChoiceChip
                      key={opt.v}
                      active={theme === opt.v}
                      label={opt.l}
                      onClick={() => {
                        setTheme(opt.v)
                        applyTheme(opt.v, appearance.themePreset === 'none' ? undefined : appearance.themePreset)
                        syncDashboardTheme()
                      }}
                    />
                  ))}
                </div>
              </Section>

              <Section icon={<Palette size={16} />} title={t('settings.themePreset')}>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { v: 'parchment', l: t('settings.themePreset.parchment'), bg: '#FDFCF8', accent: '#4A8B71' },
                    { v: 'forest', l: t('settings.themePreset.forest'), bg: '#1B2E1E', accent: '#7DBF6E' },
                    { v: 'slate', l: t('settings.themePreset.slate'), bg: '#F0F2F5', accent: '#6366F1' },
                    { v: 'midnight', l: t('settings.themePreset.midnight'), bg: '#0D1117', accent: '#79C0FF' },
                    { v: 'paper-dark', l: t('settings.themePreset.paper-dark'), bg: '#2D2420', accent: '#D4A76A' },
                    { v: 'none', l: t('settings.themePreset.none'), bg: '#fafafa', accent: '#2563eb' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => {
                        patchAppearance({ themePreset: opt.v })
                        applyTheme(theme, opt.v === 'none' ? undefined : opt.v)
                        syncDashboardTheme()
                      }}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs border-2 transition-all',
                        appearance.themePreset === opt.v
                          ? 'border-[var(--fg-accent)] bg-[var(--fg-accent-muted)] font-medium'
                          : 'border-[var(--fg-border)] hover:border-[var(--fg-text-tertiary)]',
                      )}
                    >
                      <span className="w-4 h-4 rounded-full border border-[var(--fg-border)] shrink-0" style={{ background: opt.accent }} />
                      <span className="w-3 h-3 rounded-sm shrink-0 border border-[var(--fg-border)]" style={{ background: opt.bg }} />
                      <span>{opt.l}</span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section icon={<ZoomIn size={16} />} title={t('settings.shellZoom')} hint={t('settings.shellZoomHint')}>
                <SteppedSlider
                  value={appearance.shellZoom}
                  min={50}
                  max={200}
                  step={10}
                  suffix="%"
                  onCommit={(v) => patchAppearance({ shellZoom: v })}
                />
              </Section>

              <Section icon={<ZoomIn size={16} />} title={t('settings.dashboardZoom')} hint={t('settings.dashboardZoomHint')}>
                <SteppedSlider
                  value={appearance.dashboardZoom}
                  min={50}
                  max={200}
                  step={10}
                  suffix="%"
                  onCommit={(v) => patchAppearance({ dashboardZoom: v })}
                />
              </Section>

              <Section icon={<Type size={16} />} title={t('settings.fonts')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">{t('settings.uiFont')}</label>
                    <select
                      value={appearance.uiFont}
                      onChange={(e) => patchAppearance({ uiFont: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-[var(--fg-input-border)] rounded bg-[var(--fg-input-bg)] text-[var(--fg-input-text)]"
                    >
                      <option>Segoe UI</option>
                      <option>Inter</option>
                      <option>System UI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">{t('settings.monoFont')}</label>
                    <select
                      value={appearance.monoFont}
                      onChange={(e) => patchAppearance({ monoFont: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-[var(--fg-input-border)] rounded bg-[var(--fg-input-bg)] text-[var(--fg-input-text)]"
                    >
                      <option>Cascadia Code</option>
                      <option>Consolas</option>
                      <option>Fira Code</option>
                      <option>JetBrains Mono</option>
                      <option>Source Code Pro</option>
                      <option>monospace</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">{t('settings.uiFontSize')}</label>
                    <SteppedSlider
                      value={appearance.uiFontSize}
                      min={10}
                      max={28}
                      step={1}
                      suffix="px"
                      onCommit={(v) => patchAppearance({ uiFontSize: clampFontSize(v) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">{t('settings.monoFontSize')}</label>
                    <SteppedSlider
                      value={appearance.monoFontSize}
                      min={10}
                      max={28}
                      step={1}
                      suffix="px"
                      onCommit={(v) => patchAppearance({ monoFontSize: clampFontSize(v) })}
                    />
                  </div>
                </div>
              </Section>
            </>
          )}

          {category === 'llm' && (
            <Section icon={<Cpu size={16} />} title={t('settings.llm')} hint={t('settings.llmHint')}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">{t('settings.provider')}</label>
                  <select
                    value={providerId}
                    onChange={(e) => {
                      const id = e.target.value
                      const p = getProvider(id)
                      setProviderId(id)
                      setModelsHint(null)
                      setCustomModel(!!p.customModel && p.models.length === 0)
                      const nextUrl = p.baseUrl || baseUrl
                      if (p.baseUrl) setBaseUrl(p.baseUrl)
                      if (p.models.length > 0) {
                        setChatModel(p.models[0])
                        setCustomModel(false)
                      } else {
                        setCustomModel(true)
                      }
                      if (p.embedModels && p.embedModels.length > 0) {
                        setEmbedModel(p.embedModels[0])
                      } else {
                        setEmbedModel('')
                      }
                      setModelsSource(p.source === 'live' ? 'live' : 'builtin')
                      // Pull live list when possible (Ollama needs no key)
                      if (nextUrl && (apiKey || id === 'ollama')) {
                        void refreshModels({ providerId: id, baseUrl: nextUrl, apiKey, silent: true })
                      }
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-[var(--fg-input-border)] rounded bg-[var(--fg-input-bg)] text-[var(--fg-input-text)]"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{t(`settings.providers.${p.labelKey}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">Base URL</label>
                  <Input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value)
                      setProviderId(matchProviderId(e.target.value))
                    }}
                    placeholder="https://api.deepseek.com/v1"
                    disabled={providerId !== 'custom' && providerId !== 'ollama'}
                  />
                  {providerId !== 'custom' && providerId !== 'ollama' && (
                    <p className="text-[11px] text-[var(--fg-text-tertiary)] mt-1">{t('settings.baseUrlLocked')}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">API Key</label>
                  <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
                  {apiKeySource === 'env' && (
                    <p className="text-[11px] text-[var(--fg-status-success)] mt-1">
                      {t('settings.keyFromEnv', { name: apiKeyEnvVar ?? '' })}
                    </p>
                  )}
                  {apiKeySource === 'env' && (
                    <p className="text-[11px] text-[var(--fg-text-tertiary)] mt-0.5">{t('settings.keyFromEnvHint')}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs font-medium text-[var(--fg-text-tertiary)]">{t('settings.chatModel')}</label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--fg-accent-text)] disabled:opacity-50"
                      disabled={refreshingModels || !baseUrl || (!apiKey && providerId !== 'ollama')}
                      onClick={() => void refreshModels()}
                    >
                      <RefreshCw size={11} className={refreshingModels ? 'animate-spin' : undefined} />
                      {refreshingModels ? t('settings.refreshingModels') : t('settings.refreshModels')}
                    </button>
                  </div>
                  {(() => {
                    const p = getProvider(providerId)
                    const showSelect = p.models.length > 0 && !customModel
                    return (
                      <div className="space-y-2">
                        {showSelect ? (
                          <select
                            value={p.models.includes(chatModel) ? chatModel : p.models[0]}
                            onChange={(e) => {
                              if (e.target.value === '__custom__') {
                                setCustomModel(true)
                                return
                              }
                              setChatModel(e.target.value)
                            }}
                            className="w-full px-2 py-1.5 text-sm border border-[var(--fg-input-border)] rounded bg-[var(--fg-input-bg)] text-[var(--fg-input-text)]"
                          >
                            {p.models.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                            <option value="__custom__">{t('settings.customModel')}</option>
                          </select>
                        ) : (
                          <Input
                            type="text"
                            value={chatModel}
                            onChange={(e) => setChatModel(e.target.value)}
                            placeholder={p.models[0] || 'model-name'}
                          />
                        )}
                        {showSelect === false && p.models.length > 0 && (
                          <button
                            type="button"
                            className="text-xs text-[var(--fg-accent-text)] underline"
                            onClick={() => {
                              setCustomModel(false)
                              if (!p.models.includes(chatModel)) setChatModel(p.models[0])
                            }}
                          >
                            {t('settings.backToModelList')}
                          </button>
                        )}
                        <p className="text-[11px] text-[var(--fg-text-tertiary)]">
                          {modelsHint
                            ?? (modelsSource === 'live'
                              ? t('settings.modelsSourceLive')
                              : t('settings.modelsSourceBuiltin'))}
                        </p>
                      </div>
                    )
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">{t('settings.embedModel')}</label>
                  {(() => {
                    const p = getProvider(providerId)
                    const embeds = p.embedModels ?? []
                    if (embeds.length > 0) {
                      return (
                        <select
                          value={embeds.includes(embedModel) || embedModel === '' ? embedModel : embeds[0]}
                          onChange={(e) => setEmbedModel(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-[var(--fg-input-border)] rounded bg-[var(--fg-input-bg)] text-[var(--fg-input-text)]"
                        >
                          <option value="">{t('settings.embedModelNone')}</option>
                          {embeds.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      )
                    }
                    return (
                      <Input
                        type="text"
                        value={embedModel}
                        onChange={(e) => setEmbedModel(e.target.value)}
                        placeholder={t('settings.embedModelPlaceholder')}
                      />
                    )
                  })()}
                  <p className="text-[11px] text-[var(--fg-text-tertiary)] mt-1">{t('settings.embedModelHint')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}>
                    {!testing && <Plug size={12} />}
                    {testing ? t('settings.testing') : t('settings.testConnection')}
                  </Button>
                  {testResult === 'success' && (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-status-success)]">
                      <Check size={12} /> {t('settings.testSuccess')}
                    </span>
                  )}
                  {testResult === 'fail' && (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-status-error)]">
                      <X size={12} /> {t('settings.testFail')}
                    </span>
                  )}
                </div>
              </div>
            </Section>
          )}

          {category === 'obsidian' && (
            <>
              <Section icon={<NotebookPen size={16} />} title={t('settings.obsidian.cliTitle')} hint={t('settings.obsidian.cliHint')}>
                <div className="flex items-center gap-2 flex-wrap">
                  <CliStatePill state={cliStatus?.state ?? null} t={t} />
                  {cliStatus?.cliPath && (
                    <code className="text-[11px] text-[var(--fg-text-secondary)] bg-[var(--fg-tree-hover)] px-1.5 py-0.5 rounded break-all">
                      {cliStatus.cliPath}
                    </code>
                  )}
                  {cliStatus?.version && (
                    <span className="text-[11px] text-[var(--fg-text-tertiary)]">Obsidian {cliStatus.version}</span>
                  )}
                  <Button variant="outline" size="sm" disabled={cliBusy} onClick={() => void detectCli()}>
                    <RefreshCw size={12} className={cliBusy ? 'animate-spin' : undefined} />
                    {cliBusy ? t('settings.obsidian.detecting') : t('settings.obsidian.recheck')}
                  </Button>
                  {cliStatus?.state === 'app-not-running' && (
                    <Button size="sm" disabled={cliBusy} onClick={() => void launchObsidian()}>
                      <Play size={12} />
                      {cliBusy ? t('settings.obsidian.launching') : t('settings.obsidian.launch')}
                    </Button>
                  )}
                </div>

                {cliStatus && cliStatus.state !== 'ok' && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-[var(--fg-text-secondary)]">{t('settings.obsidian.fixTitle')}</p>
                    <ol className="mt-1 text-xs text-[var(--fg-text-tertiary)] list-decimal pl-5 space-y-0.5">
                      <li>{t('settings.obsidian.fix1')}</li>
                      <li>{t('settings.obsidian.fix2')}</li>
                      <li>{t('settings.obsidian.fix3')}</li>
                      <li>{t('settings.obsidian.fix4')}</li>
                    </ol>
                  </div>
                )}

                {cliStatus?.detail && (
                  <p className="mt-2 text-[11px] text-[var(--fg-text-tertiary)] break-all">
                    {t('settings.obsidian.detailLabel')}: {cliStatus.detail}
                  </p>
                )}

                <div className="mt-3">
                  <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">
                    {t('settings.obsidian.cliPathLabel')}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={obsidian.cliPath}
                      onChange={(e) => patchObsidian({ cliPath: e.target.value })}
                      onBlur={() => { if (obsidian.cliPath) void detectCli(obsidian.cliPath) }}
                      placeholder={t('settings.obsidian.cliPathPlaceholder')}
                    />
                    <Button variant="outline" size="sm" onClick={() => void pickCliFile()}>
                      {t('common.browseFile')}
                    </Button>
                  </div>
                </div>
              </Section>

              <Section icon={<Library size={16} />} title={t('settings.obsidian.vaultTitle')} hint={t('settings.obsidian.vaultHint')}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-[var(--fg-text-tertiary)]">{t('settings.obsidian.currentVault')}</span>
                  {obsidian.vaultPath ? (
                    <>
                      <code className="text-[11px] text-[var(--fg-text-secondary)] bg-[var(--fg-tree-hover)] px-1.5 py-0.5 rounded break-all">
                        {obsidian.vaultPath}
                      </code>
                      <Button variant="ghost" size="sm" onClick={() => void copyPath(obsidian.vaultPath)}>
                        <Copy size={12} />
                        {copied === obsidian.vaultPath ? t('common.copied') : t('settings.obsidian.copyPath')}
                      </Button>
                      <VaultKindBadge kind={vaultBinding?.kind ?? null} t={t} />
                    </>
                  ) : (
                    <span className="text-xs text-[var(--fg-text-tertiary)]">{t('settings.obsidian.noVault')}</span>
                  )}
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" disabled={!cliOk || vaultBusy} onClick={() => void chooseVault()}>
                    <FolderOpen size={12} /> {t('settings.obsidian.chooseDir')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!cliOk || vaultBusy}
                    onClick={() => {
                      setNewVaultOpen((open) => !open)
                      if (!newVaultParent) setNewVaultParent(projectsRoot || '')
                    }}
                  >
                    <FolderPlus size={12} /> {t('settings.obsidian.createVault')}
                  </Button>
                  {obsidian.vaultPath && (
                    <Button variant="outline" size="sm" onClick={() => void window.fieldguide.obsidianOpenVaultManager()}>
                      {t('settings.obsidian.openVaultManager')}
                    </Button>
                  )}
                  {obsidian.vaultPath && (
                    <Button variant="ghost" size="sm" disabled={vaultBusy} onClick={() => setUnbindOpen(true)}>
                      <Unlink size={12} /> {t('settings.obsidian.unbind')}
                    </Button>
                  )}
                </div>

                {unbindOpen && (
                  <div className="mt-3 p-3 rounded-lg border border-[var(--fg-border)] space-y-2">
                    <p className="text-xs text-[var(--fg-text-secondary)]">{t('settings.obsidian.unbindHint')}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={vaultBusy} onClick={() => void unbindVault('keep')}>
                        {t('settings.obsidian.unbindKeep')}
                      </Button>
                      <Button size="sm" variant="outline" disabled={vaultBusy} onClick={() => void unbindVault('cleanup')}>
                        {t('settings.obsidian.unbindCleanup')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setUnbindOpen(false)}>
                        {t('settings.cancel')}
                      </Button>
                    </div>
                  </div>
                )}

                {!cliOk && (
                  <p className="mt-2 text-xs text-[var(--fg-status-error)]">{t('settings.obsidian.gateBlocked')}</p>
                )}

                {newVaultOpen && (
                  <div className="mt-3 p-3 rounded-lg border border-[var(--fg-border)] space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">
                        {t('settings.obsidian.newVaultParent')}
                      </label>
                      <FolderPathField
                        value={newVaultParent}
                        onChange={setNewVaultParent}
                        placeholder="D:\\Obsidian"
                        browseLabel={t('common.browseFolder')}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">
                        {t('settings.obsidian.newVaultName')}
                      </label>
                      <Input
                        type="text"
                        value={newVaultName}
                        onChange={(e) => setNewVaultName(e.target.value)}
                        placeholder={t('settings.obsidian.newVaultNamePlaceholder')}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={vaultBusy || !newVaultParent.trim() || !newVaultName.trim()}
                        onClick={() => void createVault()}
                      >
                        {t('settings.obsidian.newVaultCreate')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setNewVaultOpen(false)}>
                        {t('settings.cancel')}
                      </Button>
                    </div>
                  </div>
                )}

                {registerState !== 'idle' && (
                  <p className={cn(
                    'mt-2 text-xs',
                    registerState === 'done' ? 'text-[var(--fg-status-success)]' : 'text-[var(--fg-text-tertiary)]',
                  )}>
                    {registerState === 'waiting' && t('settings.obsidian.waitingRegister')}
                    {registerState === 'done' && (
                      <span className="inline-flex items-center gap-1"><Check size={12} /> {t('settings.obsidian.registered')}</span>
                    )}
                    {registerState === 'timeout' && t('settings.obsidian.registerTimeout')}
                  </p>
                )}

                {obsidian.vaultPath && vaultBinding?.kind === 'unregistered' && cliOk && (
                  <p className="mt-2 text-xs text-[var(--fg-text-tertiary)]">{t('settings.obsidian.registerHint')}</p>
                )}
                {vaultBinding?.kind === 'nested' && (
                  <p className="mt-2 text-xs text-[var(--fg-text-tertiary)]">
                    {t('settings.obsidian.nestedHint', { name: vaultBinding.parentVault?.name ?? '' })}
                  </p>
                )}
                {obsidian.vaultPath && (
                  <p className="mt-2 text-[11px] text-[var(--fg-text-tertiary)]">{t('settings.obsidian.rebindHint')}</p>
                )}
                {vaultMsg && <p className="mt-2 text-xs text-[var(--fg-status-error)]">{vaultMsg}</p>}

                {vaults.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">
                      {t('settings.obsidian.knownVaults')}
                    </label>
                    <div className="space-y-1">
                      {vaults.map((vault) => {
                        const active = obsidian.vaultPath ? sameVaultPath(vault.path, obsidian.vaultPath) : false
                        return (
                          <button
                            key={vault.path}
                            type="button"
                            onClick={() => {
                              patchObsidian({ vaultPath: vault.path, vaultName: vault.name })
                              setVaultBinding({ path: vault.path, name: vault.name, kind: 'registered' })
                              setPendingVault(null)
                              setRegisterState('idle')
                            }}
                            className={cn(
                              'w-full text-left px-2.5 py-1.5 rounded-md border transition-colors',
                              active
                                ? 'border-[var(--fg-accent)] bg-[var(--fg-accent-muted)]'
                                : 'border-[var(--fg-border)] hover:bg-[var(--fg-tree-hover)]',
                            )}
                          >
                            <span className="text-sm text-[var(--fg-text-primary)]">{vault.name}</span>
                            <span className="block text-[11px] text-[var(--fg-text-tertiary)] break-all">{vault.path}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Section>

              <Section icon={<NotebookPen size={16} />} title={t('settings.obsidian.syncTitle')}>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">
                      {t('settings.obsidian.folderLabel')}
                    </label>
                    <Input
                      type="text"
                      value={obsidian.folder}
                      onChange={(e) => patchObsidian({ folder: e.target.value })}
                      placeholder="Fieldguide"
                    />
                    <p className="text-[11px] text-[var(--fg-text-tertiary)] mt-1">{t('settings.obsidian.folderHint')}</p>
                  </div>
                  <Toggle
                    checked={obsidian.autoSyncOnIndex}
                    onChange={(v) => patchObsidian({ autoSyncOnIndex: v })}
                    label={t('settings.obsidian.autoSync')}
                  />
                  <Toggle
                    checked={obsidian.mirrorNotes}
                    onChange={(v) => patchObsidian({ mirrorNotes: v })}
                    label={t('settings.obsidian.mirrorNotes')}
                  />
                  <Toggle
                    checked={obsidian.agentWrite}
                    onChange={(v) => patchObsidian({ agentWrite: v })}
                    label={t('settings.obsidian.agentWrite')}
                  />
                  <Toggle
                    checked={obsidian.openAfterSync}
                    onChange={(v) => patchObsidian({ openAfterSync: v })}
                    label={t('settings.obsidian.openAfterSync')}
                  />
                  <p className="text-[11px] text-[var(--fg-text-tertiary)]">{t('settings.obsidian.saveHint')}</p>
                </div>
              </Section>
            </>
          )}

          {category === 'data' && (
            <>
              <Section icon={<Database size={16} />} title={t('settings.data')}>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.fieldguide.dataOpenDir()}>{t('settings.openDataDir')}</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const result = await window.fieldguide.dataClearCache()
                      if (result.ok && result.data) {
                        const d = result.data as { removed?: number }
                        setDataMsg(t('settings.cacheCleared', { count: d.removed ?? 0 }))
                        setTimeout(() => setDataMsg(null), 3000)
                      }
                    }}
                  >
                    {t('settings.clearCache')}
                  </Button>
                  {selectedProjectId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await window.fieldguide.projectExportGraph(selectedProjectId)
                        if (result.ok && result.data) {
                          const d = result.data as { exportPath?: string }
                          if (d.exportPath) await window.fieldguide.openFile(d.exportPath)
                        }
                      }}
                    >
                      {t('settings.exportGraph')}
                    </Button>
                  )}
                  {selectedProjectId && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exportingReport}
                      onClick={async () => {
                        setExportingReport(true)
                        try {
                          const result = await window.fieldguide.insightsExportReport(selectedProjectId)
                          if (result.ok && result.data) {
                            setDataMsg(t('insights.exported'))
                            await window.fieldguide.openFile(result.data.exportPath)
                          } else {
                            setDataMsg(result.error?.message ?? t('insights.exportFailed'))
                          }
                          setTimeout(() => setDataMsg(null), 4000)
                        } finally {
                          setExportingReport(false)
                        }
                      }}
                    >
                      {exportingReport ? t('insights.exporting') : t('insights.exportReport')}
                    </Button>
                  )}
                </div>
                {dataMsg && <p className="text-xs text-[var(--fg-status-success)] mt-2">{dataMsg}</p>}
              </Section>

              <Section icon={<Wrench size={16} />} title={t('settings.diagnostics')}>
                <div className="flex gap-2 mb-2">
                  <Button variant="outline" size="sm" onClick={loadLogs} disabled={logLoading}>
                    {logLoading ? '…' : t('settings.viewLogs')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.fieldguide.diagnosticsOpenLogDir()}>
                    {t('settings.openLogDir')}
                  </Button>
                </div>
                {showLogs && (
                  <pre className="text-xs text-[var(--fg-text-secondary)] bg-[var(--fg-tree-hover)] rounded-lg p-3 max-h-64 overflow-auto border border-[var(--fg-border)] whitespace-pre-wrap break-all font-mono">
                    {logContent || '(empty)'}
                  </pre>
                )}
              </Section>
            </>
          )}

          {category === 'about' && (
            <Section icon={<Info size={16} />} title={t('about.title')}>
              <p className="text-sm text-[var(--fg-text-secondary)] leading-relaxed mb-4">{t('about.description')}</p>
              <Button variant="outline" size="sm" onClick={onAbout}>{t('about.title')}</Button>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({
  icon, title, hint, children,
}: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--fg-text-secondary)] mb-1 flex items-center gap-1.5">
        {icon} {title}
      </h2>
      {hint && <p className="text-xs text-[var(--fg-text-tertiary)] mb-3">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  )
}

function ChoiceChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-lg text-sm border-2 transition-all',
        active
          ? 'border-[var(--fg-accent)] bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] font-medium'
          : 'border-[var(--fg-border)] text-[var(--fg-text-secondary)] hover:border-[var(--fg-text-tertiary)]',
      )}
    >
      {label}
    </button>
  )
}

type Translate = (key: string, opts?: Record<string, unknown>) => string

/** CLI gate state, colour-coded: only `ok` unlocks the vault pickers. */
function CliStatePill({ state, t }: { state: VaultCliStatus['state'] | null; t: Translate }) {
  const label = state === null
    ? t('settings.obsidian.detecting')
    : t(`settings.obsidian.state.${STATE_KEY[state]}`)
  const tone = state === 'ok'
    ? 'text-[var(--fg-status-success)] border-[var(--fg-status-success)]'
    : state === null
      ? 'text-[var(--fg-text-tertiary)] border-[var(--fg-border)]'
      : 'text-[var(--fg-status-error)] border-[var(--fg-status-error)]'
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs', tone)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', state === 'ok' ? 'bg-[var(--fg-status-success)]' : 'bg-current')} />
      {label}
    </span>
  )
}

const STATE_KEY: Record<VaultCliStatus['state'], string> = {
  ok: 'ok',
  'cli-missing': 'cliMissing',
  'app-not-running': 'appNotRunning',
  'unsupported-version': 'unsupported',
  error: 'error',
}

/** Whether Obsidian has this folder open as a vault (only known when the CLI answers). */
function VaultKindBadge({ kind, t }: { kind: VaultBinding['kind'] | null; t: Translate }) {
  // The "not registered yet" and "nested" cases get a full explanation under the
  // row, so the badge only marks the good case and stays silent otherwise.
  if (kind !== 'registered') return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded text-[var(--fg-status-success)] bg-[var(--fg-tree-hover)]">
      <Check size={11} /> {t('settings.obsidian.registered')}
    </span>
  )
}

function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 accent-[var(--fg-accent)]"
      />
      <span className="text-sm text-[var(--fg-text-secondary)]">{label}</span>
    </label>
  )
}
