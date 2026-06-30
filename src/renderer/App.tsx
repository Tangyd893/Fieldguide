/**
 * Renderer entry — top-level App shell.
 *
 * Phase 1: placeholder layout with tab bar and project library.
 * Full layout per ui-spec.md §2.2 comes in 1.2.
 */
import { useState } from 'react'

type Tab = 'library' | 'codemap' | 'theory' | 'bridge'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('library')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'library', label: '项目库' },
    { id: 'codemap', label: '代码地图' },
    { id: 'theory', label: '理论' },
    { id: 'bridge', label: '桥接' },
  ]

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      {/* Top bar */}
      <header className="h-12 flex items-center px-4 border-b border-gray-200 bg-white select-none">
        <span className="font-bold text-lg mr-8">Fieldguide</span>
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">Phase 1 · 脚手架</span>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-auto p-8">
        {activeTab === 'library' && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">项目库</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-400">
              <p className="text-lg mb-2">添加你的第一个项目</p>
              <div className="flex gap-3 justify-center mt-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  选择本地文件夹
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                  从 Git URL 克隆
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'codemap' && (
          <PlaceholderView title="代码地图" desc="UA Dashboard 嵌入区域（Phase 1.7）" />
        )}
        {activeTab === 'theory' && (
          <PlaceholderView title="理论学习" desc="arXiv / PDF / RAG（Phase 3）" disabled />
        )}
        {activeTab === 'bridge' && (
          <PlaceholderView title="概念桥接" desc="论文 ↔ 代码节点（Phase 3）" disabled />
        )}
      </main>

      {/* Status bar */}
      <footer className="h-6 flex items-center px-4 border-t border-gray-200 bg-white text-xs text-gray-400 select-none">
        <span>就绪</span>
        <span className="flex-1" />
        <span>Fieldguide v0.1.0</span>
      </footer>
    </div>
  )
}

function PlaceholderView({
  title,
  desc,
  disabled,
}: {
  title: string
  desc: string
  disabled?: boolean
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center ${
          disabled
            ? 'border-gray-200 text-gray-300'
            : 'border-gray-300 text-gray-400'
        }`}
      >
        <p className="text-lg mb-2">{desc}</p>
        {disabled && <p className="text-sm">（Phase 3 开放）</p>}
      </div>
    </div>
  )
}
