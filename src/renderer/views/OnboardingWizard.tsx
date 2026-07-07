/**
 * OnboardingWizard — 首次启动引导 (ui-spec §2.4, onboarding-spec.md)
 *
 * 步骤：欢迎 → 语言 → 项目根目录 → 如何开始 → 完成页
 */
import { useState, useEffect } from 'react'

interface Props {
  t: (key: string) => string
  onComplete: (locale: string, projectsRoot: string, navigateTo?: 'codemap' | 'library') => void
  /** Called when user picks 'skip' on step 4 — legacy direct-complete path */
  onStartOption?: (option: 'demo' | 'local' | 'skip', locale: string, projectsRoot: string) => void
  /** Called from step 5 to set up the project (demo clone / local add + index). Returns projectId. */
  onSetupStart?: (option: 'demo' | 'local', locale: string, projectsRoot: string) => Promise<string | null>
}

const STEPS = ['welcome', 'language', 'projectRoot', 'start', 'step5'] as const

const LOCALE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
]

type Step5Phase = 'setting-up' | 'indexing' | 'complete' | 'error'

export default function OnboardingWizard({ onComplete, onStartOption, onSetupStart }: Props) {
  const [step, setStep] = useState(0)
  const [locale, setLocale] = useState('zh-CN')
  const [projectsRoot, setProjectsRoot] = useState('')

  // Step 5 state
  const [selectedOption, setSelectedOption] = useState<'demo' | 'local' | null>(null)
  const [step5Phase, setStep5Phase] = useState<Step5Phase>('setting-up')
  const [step5Progress, setStep5Progress] = useState('')
  const [step5NodeCount, setStep5NodeCount] = useState(0)
  const [step5Error, setStep5Error] = useState('')

  const total = STEPS.length

  function next() {
    if (step < total - 2) { // Step 5 handled via option selection, not "next"
      setStep(step + 1)
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1)
  }

  function handleStartOption(option: 'demo' | 'local' | 'skip') {
    if (option === 'skip') {
      // Legacy: just complete directly, no Step 5
      if (onStartOption) {
        onStartOption(option, locale, projectsRoot)
      } else {
        onComplete(locale, projectsRoot)
      }
    } else {
      setSelectedOption(option)
      setStep5Phase('setting-up')
      setStep5Progress('')
      setStep5NodeCount(0)
      setStep5Error('')
      setStep(4) // move to Step 5
    }
  }

  // Step 5: kick off project setup when this step becomes active
  useEffect(() => {
    if (step !== 4 || !selectedOption || !onSetupStart) return

    let cancelled = false
    let unsubProgress: (() => void) | undefined

    async function run() {
      // Phase 1: project setup (clone / add local)
      setStep5Phase('setting-up')
      setStep5Progress('正在准备项目…')

      let projectId: string | null = null
      try {
        projectId = await onSetupStart!(selectedOption!, locale, projectsRoot)
      } catch (err) {
        if (!cancelled) {
          setStep5Error(String(err))
          setStep5Phase('error')
        }
        return
      }

      if (cancelled) return
      if (!projectId) {
        // Project setup failed silently (error toast already shown by parent)
        setStep5Phase('complete')
        setStep5NodeCount(0)
        return
      }

      // Phase 2: monitor index progress
      setStep5Phase('indexing')
      setStep5Progress('开始索引…')

      unsubProgress = window.fieldguide.onIndexProgress?.((data: unknown) => {
        if (cancelled) return
        const ev = data as { type: string; phase?: string; current?: number; total?: number; error?: string; nodeCount?: number; projectId?: string }

        // Only track events for this project
        if (ev.projectId && ev.projectId !== projectId) return

        if (ev.type === 'phase') setStep5Progress(ev.phase ?? '')
        else if (ev.type === 'progress') setStep5Progress(`${ev.phase ?? ''} ${ev.current ?? 0}/${ev.total ?? 0}`)
        else if (ev.type === 'complete') {
          setStep5Phase('complete')
          setStep5NodeCount(ev.nodeCount ?? 0)
          setStep5Progress('')
        } else if (ev.type === 'error') {
          setStep5Error(ev.error ?? '索引失败')
          setStep5Phase('error')
        }
      })
    }

    run()

    return () => {
      cancelled = true
      unsubProgress?.()
    }
  }, [step, selectedOption, locale, projectsRoot, onSetupStart])

  function handleFinish(navigateTo: 'codemap' | 'library') {
    onComplete(locale, projectsRoot, navigateTo)
  }

  const stepKey = STEPS[step]
  const isStep5 = stepKey === 'step5'

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

          {stepKey === 'step5' && (
            <div>
              {step5Phase === 'setting-up' && (
                <div className="text-center py-4">
                  <div className="text-3xl mb-3 animate-pulse">⏳</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">正在准备项目…</h3>
                  <p className="text-sm text-gray-500">{step5Progress || '请稍候…'}</p>
                </div>
              )}

              {step5Phase === 'indexing' && (
                <div className="text-center py-4">
                  <div className="text-3xl mb-3 animate-pulse">🔍</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">正在索引项目</h3>
                  <p className="text-sm text-gray-500 mb-3">{step5Progress}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    这可能需要 1–2 分钟，取决于项目大小。
                  </p>
                </div>
              )}

              {step5Phase === 'complete' && (
                <div className="text-center py-2">
                  <div className="text-5xl mb-3">🎉</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">设置完成！</h3>
                  {step5NodeCount > 0 ? (
                    <p className="text-sm text-gray-500 mb-4">
                      索引完成，共 <span className="font-semibold text-blue-600">{step5NodeCount}</span> 个节点。
                      <br />
                      建议跟随 <strong>Intro Tour</strong> 了解项目的主链路。
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 mb-4">
                      项目已就绪。建议在代码地图中跟随 <strong>Intro Tour</strong> 了解项目结构。
                    </p>
                  )}
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleFinish('codemap')}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
                    >
                      🗺️ 打开代码地图
                    </button>
                    <button
                      onClick={() => handleFinish('library')}
                      className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      📚 留在项目库
                    </button>
                  </div>
                </div>
              )}

              {step5Phase === 'error' && (
                <div className="text-center py-4">
                  <div className="text-5xl mb-3">⚠️</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">设置遇到问题</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {step5Error || '项目准备失败，请检查网络或路径后重试。'}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleFinish('library')}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
                    >
                      进入项目库
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — hidden on Step 5 (has its own buttons) */}
        {!isStep5 && (
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
              disabled={step >= total - 2}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
            >
              {step === total - 2 ? '—' : '下一步 →'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
