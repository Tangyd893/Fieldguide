/**
 * SettingsPanel — 设置面板 (ui-spec §3.5)
 * Phase 2: LLM 配置 + 语言切换 + 主题
 * Phase 4: 诊断日志查看
 */
import { useState, useEffect } from 'react'
import { Cpu, FolderOpen, Globe, Palette, Wrench, ZoomIn, Plug, Check, X } from 'lucide-react'
import { applyTheme, applyZoom, applyFonts } from '../App'
import FolderPathField from '../components/FolderPathField'
import { syncDashboardTheme } from '@/lib/dashboard-theme'
import { Dialog, DialogContent, DialogTitle, DialogCloseButton, DialogBody } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  open: boolean
  t: (key: string) => string
  onClose: () => void
  onAbout?: () => void
}

export default function SettingsPanel({ open, t, onClose, onAbout }: Props) {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [chatModel, setChatModel] = useState('')
  const [projectsRoot, setProjectsRoot] = useState('')
  const [locale, setLocale] = useState('zh-CN')
  const [theme, setTheme] = useState('system')
  const [themePreset, setThemePreset] = useState('parchment')
  const [zoom, setZoom] = useState(100)
  const [uiFont, setUiFont] = useState('Segoe UI')
  const [monoFont, setMonoFont] = useState('Cascadia Code')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [logContent, setLogContent] = useState('')
  const [logLoading, setLogLoading] = useState(false)

  useEffect(() => {
    window.fieldguide.configGet().then((r) => {
      if (r.ok && r.data) {
        const c = r.data as Record<string, unknown>
        const llm = (c.llm as Record<string, string>) || {}
        setBaseUrl(llm.baseUrl || '')
        setApiKey(llm.apiKey || '')
        setChatModel(llm.chatModel || '')
        setProjectsRoot((c.projectsRoot as string) || '')
        setLocale((c.locale as string) || 'zh-CN')
        setTheme((c.theme as string) || 'system')
        const appearance = c.appearance as Record<string, string> | undefined
        setThemePreset(appearance?.themePreset || 'parchment')
        setZoom(appearance?.zoom ? Number(appearance.zoom) : 100)
        setUiFont(appearance?.uiFont || 'Segoe UI')
        setMonoFont(appearance?.monoFont || 'Cascadia Code')
      }
    })
  }, [])

  async function save() {
    setSaving(true)
    await window.fieldguide.configSet({
      llm: { baseUrl, apiKey, chatModel, embedModel: '' },
      projectsRoot,
      locale,
      theme,
      appearance: { themePreset, zoom, uiFont, monoFont },
    })
    // Apply theme immediately (keep current preset)
    applyTheme(theme, themePreset === 'none' ? undefined : themePreset)
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
    // Save first so the backend has the latest config
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
        setLogContent(result.data.content || '')
        setShowLogs(true)
      }
    } catch { /* ignore */ }
    setLogLoading(false)
  }

  async function openLogDir() {
    await window.fieldguide.diagnosticsOpenLogDir()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="flex flex-col w-[520px] max-w-[95vw] max-h-[80vh] p-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--fg-border)] shrink-0 bg-[var(--fg-card)]">
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogCloseButton />
        </div>

        <DialogBody className="px-6 py-4 space-y-6">
          {/* LLM */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--fg-text-secondary)] mb-3 flex items-center gap-1.5"><Cpu size={14} /> {t('settings.llm')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">Base URL</label>
                <Input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com/v1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">API Key</label>
                <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">Chat Model</label>
                <Input type="text" value={chatModel} onChange={e => setChatModel(e.target.value)}
                  placeholder="deepseek-chat" />
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}>
                  {!testing && <Plug size={12} />}
                  {testing ? t('settings.testing') : t('settings.testConnection')}
                </Button>
                {testResult === 'success' && <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-status-success)]"><Check size={12} /> {t('settings.testSuccess')}</span>}
                {testResult === 'fail' && <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-status-error)]"><X size={12} /> {t('settings.testFail')}</span>}
              </div>
            </div>
          </section>

          {/* Projects Root */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--fg-text-secondary)] mb-3 flex items-center gap-1.5"><FolderOpen size={14} /> {t('settings.projectsRoot')}</h3>
            <div>
              <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">Git clone 目标路径</label>
              <FolderPathField
                value={projectsRoot}
                onChange={setProjectsRoot}
                placeholder="D:\Projects"
                browseLabel={t('common.browseFolder')}
              />
              <p className="text-xs text-[var(--fg-text-tertiary)] mt-1.5">{t('settings.projectsRootHint')}</p>
            </div>
          </section>

          {/* Language */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--fg-text-secondary)] mb-3 flex items-center gap-1.5"><Globe size={14} /> {t('settings.language')}</h3>
            <div className="flex gap-2">
              {[
                { v: 'zh-CN', l: '简体中文' },
                { v: 'zh-TW', l: '繁體中文' },
                { v: 'en-US', l: 'English' },
              ].map((opt) => (
                <button key={opt.v} onClick={() => setLocale(opt.v)}
                  className={`px-4 py-2 rounded-lg text-sm border-2 transition-all ${
                    locale === opt.v ? 'border-[var(--fg-accent)] bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] font-medium' : 'border-[var(--fg-border)] text-[var(--fg-text-secondary)] hover:border-[var(--fg-text-tertiary)]'
                  }`}>{opt.l}</button>
              ))}
            </div>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--fg-text-secondary)] mb-3 flex items-center gap-1.5"><Palette size={14} /> {t('settings.theme')}</h3>
            <div className="flex gap-2">
              {[
                { v: 'system', l: '跟随系统' },
                { v: 'light', l: '浅色' },
                { v: 'dark', l: '深色' },
              ].map((opt) => (
                <button key={opt.v} onClick={() => { setTheme(opt.v); applyTheme(opt.v, themePreset === 'none' ? undefined : themePreset); syncDashboardTheme() }}
                  className={`px-4 py-2 rounded-lg text-sm border-2 transition-all ${
                    theme === opt.v ? 'border-[var(--fg-accent)] bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] font-medium' : 'border-[var(--fg-border)] text-[var(--fg-text-secondary)] hover:border-[var(--fg-text-tertiary)]'
                  }`}>{opt.l}</button>
              ))}
            </div>
          </section>

          {/* Theme Presets */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--fg-text-secondary)] mb-3 flex items-center gap-1.5"><Palette size={14} /> {t('settings.themePreset')}</h3>
            <div className="flex gap-2 flex-wrap">
              {([
                { v: 'parchment', l: t('settings.themePreset.parchment'), bg: '#FDFCF8', accent: '#4A8B71' },
                { v: 'forest', l: t('settings.themePreset.forest'), bg: '#1B2E1E', accent: '#7DBF6E' },
                { v: 'slate', l: t('settings.themePreset.slate'), bg: '#F0F2F5', accent: '#6366F1' },
                { v: 'midnight', l: t('settings.themePreset.midnight'), bg: '#0D1117', accent: '#79C0FF' },
                { v: 'paper-dark', l: t('settings.themePreset.paper-dark'), bg: '#2D2420', accent: '#D4A76A' },
                { v: 'none', l: t('settings.themePreset.none'), bg: '#fafafa', accent: '#2563eb' },
              ] as const).map((opt) => {
                const isActive = themePreset === opt.v
                return (
                  <button key={opt.v}
                    onClick={() => {
                      setThemePreset(opt.v)
                      applyTheme(theme, opt.v === 'none' ? undefined : opt.v)
                      syncDashboardTheme()
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border-2 transition-all ${
                      isActive ? 'border-[var(--fg-accent)] bg-[var(--fg-accent-muted)] font-medium' : 'border-[var(--fg-border)] hover:border-[var(--fg-text-tertiary)]'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full border border-[var(--fg-border)] shrink-0" style={{ background: opt.accent }} />
                    <span className="w-3 h-3 rounded-sm shrink-0 border border-[var(--fg-border)]" style={{ background: opt.bg }} />
                    <span>{opt.l}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Zoom */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--fg-text-secondary)] mb-3 flex items-center gap-1.5"><ZoomIn size={14} /> 界面缩放</h3>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={50}
                max={200}
                step={10}
                value={zoom}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setZoom(v)
                  applyZoom(v)
                }}
                className="flex-1 h-1.5 rounded-full appearance-none bg-[var(--fg-input-border)] cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--fg-accent)]"
              />
              <input
                type="number"
                min={50}
                max={200}
                step={10}
                value={zoom}
                onChange={(e) => {
                  const v = Math.max(50, Math.min(200, Number(e.target.value) || 100))
                  setZoom(v)
                  applyZoom(v)
                }}
                className="w-16 px-2 py-1 text-xs text-center border border-[var(--fg-input-border)] rounded bg-[var(--fg-input-bg)] text-[var(--fg-input-text)] focus:outline-none focus:ring-1 focus:ring-[var(--fg-accent)]"
              />
              <span className="text-xs text-[var(--fg-text-tertiary)] min-w-[2.5rem]">{zoom}%</span>
            </div>
          </section>

          {/* Fonts */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--fg-text-secondary)] mb-3 flex items-center gap-1.5"><ZoomIn size={14} /> 字体</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">UI 字体</label>
                <select
                  value={uiFont}
                  onChange={(e) => {
                    setUiFont(e.target.value)
                    applyFonts(e.target.value, monoFont)
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-[var(--fg-input-border)] rounded bg-[var(--fg-input-bg)] text-[var(--fg-input-text)] focus:outline-none focus:ring-1 focus:ring-[var(--fg-accent)]"
                >
                  <option>Segoe UI</option>
                  <option>Inter</option>
                  <option>System UI</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fg-text-tertiary)] mb-1">代码字体</label>
                <select
                  value={monoFont}
                  onChange={(e) => {
                    setMonoFont(e.target.value)
                    applyFonts(uiFont, e.target.value)
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-[var(--fg-input-border)] rounded bg-[var(--fg-input-bg)] text-[var(--fg-input-text)] focus:outline-none focus:ring-1 focus:ring-[var(--fg-accent)]"
                >
                  <option>Cascadia Code</option>
                  <option>Consolas</option>
                  <option>Fira Code</option>
                  <option>JetBrains Mono</option>
                  <option>Source Code Pro</option>
                  <option>monospace</option>
                </select>
              </div>
            </div>
          </section>

          {/* Diagnostics */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--fg-text-secondary)] mb-3 flex items-center gap-1.5"><Wrench size={14} /> {t('settings.diagnostics')}</h3>
            <div className="flex gap-2 mb-2">
              <button onClick={loadLogs} disabled={logLoading}
                className="px-4 py-1.5 border border-[var(--fg-input-border)] text-[var(--fg-text-secondary)] rounded-lg text-xs font-medium hover:bg-[var(--fg-tree-hover)] disabled:opacity-40 transition-colors">
                {logLoading ? '…' : t('settings.viewLogs')}
              </button>
              <button onClick={openLogDir}
                className="px-4 py-1.5 border border-[var(--fg-input-border)] text-[var(--fg-text-secondary)] rounded-lg text-xs font-medium hover:bg-[var(--fg-tree-hover)] transition-colors">
                {t('settings.openLogDir')}
              </button>
            </div>
            {showLogs && (
              <pre className="text-xs text-[var(--fg-text-secondary)] bg-[var(--fg-tree-hover)] rounded-lg p-3 max-h-48 overflow-auto border border-[var(--fg-border)] whitespace-pre-wrap break-all font-mono">
                {logContent || '(empty)'}
              </pre>
            )}
          </section>
        </DialogBody>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-[var(--fg-border)] shrink-0 bg-[var(--fg-card)]">
          <div className="flex gap-2">
            {onAbout && (
              <Button variant="ghost" size="sm" onClick={onAbout}>
                {t('about.title')}
              </Button>
            )}
          </div>
          <div className="flex gap-3 items-center">
            {saved && <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-status-success)]"><Check size={12} /> {t('settings.saved')}</span>}
            <Button variant="ghost" onClick={onClose}>{t('settings.cancel')}</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t('settings.saving') : t('settings.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
