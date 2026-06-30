/**
 * SettingsPanel — 设置面板 (ui-spec §3.5)
 * Phase 2: LLM 配置 + 语言切换 + 主题
 */
import { useState, useEffect } from 'react'

interface Props {
  t: (key: string) => string
  onClose: () => void
}

export default function SettingsPanel({ t, onClose }: Props) {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [chatModel, setChatModel] = useState('')
  const [locale, setLocale] = useState('zh-CN')
  const [theme, setTheme] = useState('system')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.fieldguide.configGet().then((r) => {
      if (r.ok && r.data) {
        const c = r.data as Record<string, unknown>
        const llm = (c.llm as Record<string, string>) || {}
        setBaseUrl(llm.baseUrl || '')
        setApiKey(llm.apiKey || '')
        setChatModel(llm.chatModel || '')
        setLocale((c.locale as string) || 'zh-CN')
        setTheme((c.theme as string) || 'system')
      }
    })
  }, [])

  async function save() {
    setSaving(true)
    await window.fieldguide.configSet({
      llm: { baseUrl, apiKey, chatModel, embedModel: '' },
      locale,
      theme,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-h-[80vh] bg-white rounded-xl shadow-2xl z-50 overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">设置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* LLM */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🤖 LLM 配置</h3>
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
            </div>
          </section>

          {/* Language */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🌐 界面语言</h3>
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
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🎨 主题</h3>
            <div className="flex gap-2">
              {[
                { v: 'system', l: '跟随系统' },
                { v: 'light', l: '浅色' },
                { v: 'dark', l: '深色' },
              ].map((opt) => (
                <button key={opt.v} onClick={() => setTheme(opt.v)}
                  className={`px-4 py-2 rounded-lg text-sm border-2 transition-all ${
                    theme === opt.v ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>{opt.l}</button>
              ))}
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          {saved && <span className="text-xs text-green-600 self-center mr-2">✅ 已保存</span>}
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </>
  )
}
