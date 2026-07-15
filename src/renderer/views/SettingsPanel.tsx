/**
 * Settings — VS Code–style full page with left category nav.
 */
import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Cpu, FolderOpen, Globe, Palette, Wrench, ZoomIn, Type, Plug, Check, X, Database, Info,
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
import { getProvider, LLM_PROVIDERS, matchProviderId } from '../lib/llm-providers'
import { syncDashboardTheme } from '@/lib/dashboard-theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Category = 'general' | 'appearance' | 'llm' | 'data' | 'about'

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
  const [providerId, setProviderId] = useState('deepseek')
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

  useEffect(() => {
    window.fieldguide.configGet().then((r) => {
      if (r.ok && r.data) {
        const c = r.data as Record<string, unknown>
        const llm = (c.llm as Record<string, string>) || {}
        setBaseUrl(llm.baseUrl || '')
        setApiKey(llm.apiKey || '')
        setChatModel(llm.chatModel || '')
        const pid = matchProviderId(llm.baseUrl || '')
        setProviderId(pid)
        const preset = getProvider(pid)
        setCustomModel(
          pid === 'custom'
          || (!!llm.chatModel && preset.models.length > 0 && !preset.models.includes(llm.chatModel))
          || !!preset.customModel && !!llm.chatModel && !preset.models.includes(llm.chatModel),
        )
        setProjectsRoot((c.projectsRoot as string) || '')
        setLocale((c.locale as string) || 'zh-CN')
        setTheme((c.theme as string) || 'system')
        setAppearance(normalizeAppearance(c.appearance as Record<string, unknown> | undefined))
      }
    })
  }, [])

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
    await window.fieldguide.configSet({
      llm: { baseUrl, apiKey, chatModel, embedModel: '' },
      projectsRoot,
      locale,
      theme,
      appearance,
    })
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
    await window.fieldguide.configSet({
      llm: { baseUrl, apiKey, chatModel, embedModel: '' },
      projectsRoot,
      locale,
      theme,
    })
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

  const nav: { id: Category; label: string; icon: ReactNode }[] = [
    { id: 'general', label: t('settings.nav.general'), icon: <Globe size={16} /> },
    { id: 'appearance', label: t('settings.nav.appearance'), icon: <Palette size={16} /> },
    { id: 'llm', label: t('settings.nav.llm'), icon: <Cpu size={16} /> },
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
                      setCustomModel(!!p.customModel && p.models.length === 0)
                      if (p.baseUrl) setBaseUrl(p.baseUrl)
                      if (p.models.length > 0) {
                        setChatModel(p.models[0])
                        setCustomModel(false)
                      } else {
                        setCustomModel(true)
                      }
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-[var(--fg-input-border)] rounded bg-[var(--fg-input-bg)] text-[var(--fg-input-text)]"
                  >
                    {LLM_PROVIDERS.map((p) => (
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
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">{t('settings.chatModel')}</label>
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
                      </div>
                    )
                  })()}
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
