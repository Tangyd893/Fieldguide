/**
 * SettingsPanel — 设置面板 (ui-spec §3.5)
 * Phase 2: LLM 配置 + 语言切换 + 主题
 * Phase 4: 诊断日志查看
 */
import { useState, useEffect } from 'react'
import { applyTheme } from '../App'

interface Props {
  t: (key: string) => string
  onClose: () => void
  onAbout?: () => void
}

export default function SettingsPanel({ t, onClose, onAbout }: Props) {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [chatModel, setChatModel] = useState('')
  const [projectsRoot, setProjectsRoot] = useState('')
  const [locale, setLocale] = useState('zh-CN')
  const [theme, setTheme] = useState('system')
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
    })
    // Apply theme immediately
    applyTheme(theme)
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
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-h-[80vh] bg-white rounded-xl shadow-2xl z-50 overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* LLM */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🤖 {t('settings.llm')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Base URL</label>
                <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com/v1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Chat Model</label>
                <input type="text" value={chatModel} onChange={e => setChatModel(e.target.value)}
                  placeholder="deepseek-chat"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={testConnection} disabled={testing}
                  className="px-4 py-1.5 border border-blue-300 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-50 disabled:opacity-40 transition-colors">
                  {testing ? t('settings.testing') : '🔌 ' + t('settings.testConnection')}
                </button>
                {testResult === 'success' && <span className="text-xs text-green-600">✅ {t('settings.testSuccess')}</span>}
                {testResult === 'fail' && <span className="text-xs text-red-500">❌ {t('settings.testFail')}</span>}
              </div>
            </div>
          </section>

          {/* Projects Root */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">📁 {t('settings.projectsRoot')}</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Git clone 目标路径</label>
              <input type="text" value={projectsRoot} onChange={e => setProjectsRoot(e.target.value)}
                placeholder="D:\Projects"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1.5">{t('settings.projectsRootHint')}</p>
            </div>
          </section>

          {/* Language */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🌐 {t('settings.language')}</h3>
            <div className="flex gap-2">
              {[
                { v: 'zh-CN', l: '简体中文' },
                { v: 'zh-TW', l: '繁體中文' },
                { v: 'en-US', l: 'English' },
              ].map((opt) => (
                <button key={opt.v} onClick={() => setLocale(opt.v)}
                  className={`px-4 py-2 rounded-lg text-sm border-2 transition-all ${
                    locale === opt.v ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>{opt.l}</button>
              ))}
            </div>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🎨 {t('settings.theme')}</h3>
            <div className="flex gap-2">
              {[
                { v: 'system', l: '跟随系统' },
                { v: 'light', l: '浅色' },
                { v: 'dark', l: '深色' },
              ].map((opt) => (
                <button key={opt.v} onClick={() => { setTheme(opt.v); applyTheme(opt.v) }}
                  className={`px-4 py-2 rounded-lg text-sm border-2 transition-all ${
                    theme === opt.v ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>{opt.l}</button>
              ))}
            </div>
          </section>

          {/* Diagnostics */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🩺 {t('settings.diagnostics')}</h3>
            <div className="flex gap-2 mb-2">
              <button onClick={loadLogs} disabled={logLoading}
                className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors">
                {logLoading ? '…' : t('settings.viewLogs')}
              </button>
              <button onClick={openLogDir}
                className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
                {t('settings.openLogDir')}
              </button>
            </div>
            {showLogs && (
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 max-h-48 overflow-auto border border-gray-200 whitespace-pre-wrap break-all font-mono">
                {logContent || '(empty)'}
              </pre>
            )}
          </section>
        </div>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-gray-200">
          <div className="flex gap-2">
            {onAbout && (
              <button onClick={onAbout} className="px-3 py-2 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                ℹ️ {t('about.title')}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {saved && <span className="text-xs text-green-600 self-center mr-2">✅ {t('settings.saved')}</span>}
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">{t('settings.cancel')}</button>
            <button onClick={save} disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
              {saving ? t('settings.saving') : t('settings.save')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
