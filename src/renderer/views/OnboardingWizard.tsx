/**
 * OnboardingWizard — 首次启动引导 (ui-spec §2.4, onboarding-spec.md)
 *
 * 步骤：欢迎 → 语言 → 项目根目录 → 如何开始
 */
import { useState } from 'react'

interface Props {
  t: (key: string) => string
  onComplete: (locale: string, projectsRoot: string) => void
  /** Called when user picks one of the three start options on the final step */
  onStartOption?: (option: 'demo' | 'local' | 'skip', locale: string, projectsRoot: string) => void
}

const STEPS = ['welcome', 'language', 'projectRoot', 'start'] as const

const LOCALE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
]

export default function OnboardingWizard({ onComplete, onStartOption }: Props) {
  const [step, setStep] = useState(0)
  const [locale, setLocale] = useState('zh-CN')
  const [projectsRoot, setProjectsRoot] = useState('')

  const total = STEPS.length

  function next() {
    if (step < total - 1) {
      setStep(step + 1)
    } else {
      onComplete(locale, projectsRoot)
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1)
  }

  function handleStartOption(option: 'demo' | 'local' | 'skip') {
    if (onStartOption) {
      onStartOption(option, locale, projectsRoot)
    } else {
      // Legacy: just complete
      onComplete(locale, projectsRoot)
    }
  }

  const stepKey = STEPS[step]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/25 z-50" />

      {/* Card */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-xl shadow-2xl z-50 overflow-hidden">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6 pb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i <= step ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-8 py-6">
          {stepKey === 'welcome' && (
            <div className="text-center">
              <div className="text-5xl mb-4">🧭</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎使用 Fieldguide</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Fieldguide 是您的本地学习工作台——把代码库变成可探索的知识地图，
                并支持论文与代码的对照学习。
              </p>
              <p className="text-sm text-gray-400 mt-3">让我们花 1 分钟完成基础设置。</p>
            </div>
          )}

          {stepKey === 'language' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">选择界面语言</h3>
              <div className="space-y-2">
                {LOCALE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLocale(opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm ${
                      locale === opt.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stepKey === 'projectRoot' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">设置项目根目录</h3>
              <p className="text-sm text-gray-500 mb-4">
                Git clone 和 Demo 项目将默认存放在此目录下。后续可在设置中修改。
              </p>
              <input
                type="text"
                value={projectsRoot}
                onChange={(e) => setProjectsRoot(e.target.value)}
                placeholder="D:\Projects\Fieldguide"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-2">
                可留空，后续添加项目时手动选择目录。
              </p>
            </div>
          )}

          {stepKey === 'start' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">如何开始？</h3>
              <div className="space-y-3">
                <button
                  onClick={() => handleStartOption('demo')}
                  className="w-full text-left px-4 py-3 rounded-lg border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <span className="font-medium text-blue-700 text-sm">🎯 体验 Demo 项目</span>
                  <p className="text-xs text-blue-500 mt-0.5">克隆 fieldguide-demo 仓库，立即浏览示例图谱</p>
                </button>
                <button
                  onClick={() => handleStartOption('local')}
                  className="w-full text-left px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <span className="font-medium text-gray-700 text-sm">📁 打开本地项目</span>
                  <p className="text-xs text-gray-400 mt-0.5">选择已有代码仓库并开始索引</p>
                </button>
                <button
                  onClick={() => handleStartOption('skip')}
                  className="w-full text-left px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <span className="font-medium text-gray-700 text-sm">⏭ 稍后再说</span>
                  <p className="text-xs text-gray-400 mt-0.5">直接进入项目库，随时可添加项目</p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-8 pb-6">
          <button
            onClick={prev}
            disabled={step === 0}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-0 transition-opacity"
          >
            ← 上一步
          </button>
          <span className="text-xs text-gray-300 self-center">
            {step + 1} / {total}
          </span>
          <button
            onClick={next}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {step === total - 1 ? '完成' : '下一步 →'}
          </button>
        </div>
      </div>
    </>
  )
}
