/**
 * OnboardingWizard — 首次启动引导 (ui-spec §2.4, onboarding-spec.md)
 *
 * 步骤：欢迎 → 语言 → 项目根目录 → 如何开始 → 完成页
 * Phase 4: i18n 化 — 所有 UI 文案通过 t() 获取
 */
import { useState, useEffect } from 'react'
import { Compass, Loader2, Search, PartyPopper, AlertTriangle } from 'lucide-react'
import FolderPathField from '../components/FolderPathField'
import { useIndexProgress, progressPercent } from '../hooks/useIndexProgress'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface Props {
  t: (key: string, opts?: Record<string, unknown>) => string
  onComplete: (locale: string, projectsRoot: string, navigateTo?: 'codemap' | 'library') => void
  /** Called when user picks 'skip' on step 4 — legacy direct-complete path */
  onStartOption?: (option: 'demo' | 'local' | 'skip', locale: string, projectsRoot: string) => void
  /** Called from step 5 to set up the project (demo / local add + index). Returns projectId. */
  onSetupStart?: (
    option: 'demo' | 'local',
    locale: string,
    projectsRoot: string,
    localPath?: string,
  ) => Promise<string | null>
}

const STEPS = ['welcome', 'language', 'projectRoot', 'start', 'step5'] as const

const LOCALE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
]

type Step5Phase = 'setting-up' | 'indexing' | 'complete' | 'error'

export default function OnboardingWizard({ t, onComplete, onStartOption, onSetupStart }: Props) {
  const [step, setStep] = useState(0)
  const [locale, setLocale] = useState('zh-CN')
  const [projectsRoot, setProjectsRoot] = useState('')
  const [localProjectPath, setLocalProjectPath] = useState<string | null>(null)

  // Step 5 state
  const [selectedOption, setSelectedOption] = useState<'demo' | 'local' | null>(null)
  const [step5Phase, setStep5Phase] = useState<Step5Phase>('setting-up')
  const [step5Progress, setStep5Progress] = useState('')
  const [step5NodeCount, setStep5NodeCount] = useState(0)
  const [step5Error, setStep5Error] = useState('')
  const [step5ProjectId, setStep5ProjectId] = useState<string | null>(null)

  // Use global indexing progress, filtered to our project
  const idxProgress = useIndexProgress(step5ProjectId ?? undefined)
  const idxPct = progressPercent(idxProgress.progress)

  const total = STEPS.length

  function next() {
    if (step < total - 2) { // Step 5 handled via option selection, not "next"
      setStep(step + 1)
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1)
  }

  async function handleStartOption(option: 'demo' | 'local' | 'skip') {
    if (option === 'skip') {
      if (onStartOption) {
        onStartOption(option, locale, projectsRoot)
      } else {
        onComplete(locale, projectsRoot)
      }
      return
    }

    if (option === 'local') {
      try {
        const folderResult = await window.fieldguide.openFolderDialog()
        if (!folderResult?.ok || !folderResult.data) return
        setLocalProjectPath(folderResult.data)
      } catch {
        return
      }
    } else {
      setLocalProjectPath(null)
    }

    setSelectedOption(option)
    setStep5Phase('setting-up')
    setStep5Progress('')
    setStep5NodeCount(0)
    setStep5Error('')
    setStep(4)
  }

  // Step 5: kick off project setup when this step becomes active
  useEffect(() => {
    if (step !== 4 || !selectedOption || !onSetupStart) return

    let cancelled = false
    let unsubProgress: (() => void) | undefined

    async function run() {
      let projectId: string | null = null
      try {
        projectId = await onSetupStart!(selectedOption!, locale, projectsRoot, localProjectPath ?? undefined)
      } catch (err) {
        if (!cancelled) {
          setStep5Error(String(err))
          setStep5Phase('error')
        }
        return
      }

      if (cancelled) return
      if (!projectId) {
        setStep5Phase('complete')
        setStep5NodeCount(0)
        return
      }

      // Bundled demo ships with a pre-built graph
      try {
        const list = await window.fieldguide.projectList()
        const proj = list.ok
          ? (list.data as Array<{ id: string; status: string; node_count: number }>)?.find((p) => p.id === projectId)
          : undefined
        if (proj?.status === 'ready' && proj.node_count > 0) {
          setStep5Phase('complete')
          setStep5NodeCount(proj.node_count)
          return
        }
      } catch { /* fall through */ }

      // Phase 2: monitor index progress via shared hook
      setStep5Phase('indexing')
      setStep5ProjectId(projectId)
    }

    run()

    return () => {
      cancelled = true
    }
  }, [step, selectedOption, locale, projectsRoot, localProjectPath, onSetupStart, t])

  // Watch global index progress for complete/error
  useEffect(() => {
    if (step5Phase !== 'indexing' || !idxProgress.progress) return
    const p = idxProgress.progress
    if (p.type === 'complete') {
      setStep5Phase('complete')
      setStep5NodeCount(p.nodeCount ?? step5NodeCount)
    } else if (p.type === 'error') {
      setStep5Error(p.error ?? t('project.status.failed'))
      setStep5Phase('error')
    }
  }, [idxProgress.progress])

  function handleFinish(navigateTo: 'codemap' | 'library') {
    onComplete(locale, projectsRoot, navigateTo)
  }

  const stepKey = STEPS[step]
  const isStep5 = stepKey === 'step5'

  return (
    <Dialog open modal onOpenChange={() => {}}>
      <DialogContent
        className="w-[480px] max-w-[95vw] p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6 pb-2 bg-[var(--fg-card)]">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i <= step ? 'bg-[var(--fg-accent)]' : 'bg-[var(--fg-input-border)]'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-8 py-6">
          {stepKey === 'welcome' && (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-2xl bg-[var(--fg-accent-muted)] flex items-center justify-center">
                  <Compass size={32} className="text-[var(--fg-accent)]" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-[var(--fg-text-primary)] mb-2">{t('onboarding.welcomeTitle')}</h2>
              <p className="text-sm text-[var(--fg-text-secondary)] leading-relaxed">
                {t('onboarding.welcomeDesc')}
              </p>
              <p className="text-sm text-[var(--fg-text-tertiary)] mt-3">{t('onboarding.welcomeHint')}</p>
            </div>
          )}

          {stepKey === 'language' && (
            <div>
              <h3 className="text-lg font-semibold text-[var(--fg-text-primary)] mb-4">{t('onboarding.languageTitle')}</h3>
              <div className="space-y-2">
                {LOCALE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLocale(opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm ${
                      locale === opt.value
                        ? 'border-[var(--fg-accent)] bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] font-medium'
                        : 'border-[var(--fg-border)] hover:border-[var(--fg-text-tertiary)] text-[var(--fg-text-secondary)]'
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
              <h3 className="text-lg font-semibold text-[var(--fg-text-primary)] mb-2">{t('onboarding.projectRootTitle')}</h3>
              <p className="text-sm text-[var(--fg-text-secondary)] mb-4">
                {t('onboarding.projectRootDesc')}
              </p>
              <FolderPathField
                value={projectsRoot}
                onChange={setProjectsRoot}
                placeholder="D:\Projects\Fieldguide"
                browseLabel={t('common.browseFolder')}
                autoFocus
              />
              <p className="text-xs text-[var(--fg-text-tertiary)] mt-2">
                {t('onboarding.projectRootHint')}
              </p>
            </div>
          )}

          {stepKey === 'start' && (
            <div>
              <h3 className="text-lg font-semibold text-[var(--fg-text-primary)] mb-4">{t('onboarding.startTitle')}</h3>
              <div className="space-y-3">
                <button
                  onClick={() => handleStartOption('demo')}
                  className="w-full text-left px-4 py-3 rounded-lg border-2 border-[var(--fg-accent)] bg-[var(--fg-accent-muted)] hover:bg-[var(--fg-accent-muted)]/70 transition-colors"
                >
                  <span className="font-medium text-[var(--fg-accent-text)] text-sm">{t('onboarding.demoTitle')}</span>
                  <p className="text-xs text-[var(--fg-accent)] mt-0.5">{t('onboarding.demoDesc')}</p>
                </button>
                <button
                  onClick={() => handleStartOption('local')}
                  className="w-full text-left px-4 py-3 rounded-lg border-2 border-[var(--fg-border)] hover:border-[var(--fg-text-tertiary)] transition-colors"
                >
                  <span className="font-medium text-[var(--fg-text-primary)] text-sm">{t('onboarding.localTitle')}</span>
                  <p className="text-xs text-[var(--fg-text-tertiary)] mt-0.5">{t('onboarding.localDesc')}</p>
                </button>
                <button
                  onClick={() => handleStartOption('skip')}
                  className="w-full text-left px-4 py-3 rounded-lg border-2 border-[var(--fg-border)] hover:border-[var(--fg-text-tertiary)] transition-colors"
                >
                  <span className="font-medium text-[var(--fg-text-primary)] text-sm">{t('onboarding.skipTitle')}</span>
                  <p className="text-xs text-[var(--fg-text-tertiary)] mt-0.5">{t('onboarding.skipDesc')}</p>
                </button>
              </div>
            </div>
          )}

          {stepKey === 'step5' && (
            <div>
              {step5Phase === 'setting-up' && (
                <div className="text-center py-4">
                  <div className="flex justify-center mb-3"><Loader2 size={28} className="animate-spin text-[var(--fg-accent)]" /></div>
                  <h3 className="text-lg font-semibold text-[var(--fg-text-primary)] mb-2">{t('onboarding.settingUp')}</h3>
                  {selectedOption === 'local' && localProjectPath && (
                    <p className="text-xs text-[var(--fg-text-secondary)] mb-2 font-mono break-all px-4">{localProjectPath}</p>
                  )}
                  <p className="text-sm text-[var(--fg-text-secondary)]">{t('onboarding.settingUp')}</p>
                </div>
              )}

              {step5Phase === 'indexing' && (
                <div className="text-center py-4">
                  <div className="flex justify-center mb-3"><Search size={28} className="animate-pulse text-[var(--fg-accent)]" /></div>
                  <h3 className="text-lg font-semibold text-[var(--fg-text-primary)] mb-2">{t('onboarding.indexing')}</h3>
                  <p className="text-sm text-[var(--fg-text-secondary)] mb-3">
                    {idxProgress.progress?.phase ? idxProgress.phaseLabel(idxProgress.progress.phase, t) : ''}
                    {idxProgress.progress?.type === 'progress' && idxProgress.progress.current !== undefined && idxProgress.progress.total
                      ? ` ${idxProgress.progress.current}/${idxProgress.progress.total}` : ''}
                  </p>
                  <div className="w-full bg-[var(--fg-input-border)] rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-[var(--fg-accent)] transition-all duration-300"
                      style={{ width: `${idxPct >= 0 ? idxPct : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--fg-text-tertiary)] mt-2">
                    {t('onboarding.indexingHint')}
                  </p>
                </div>
              )}

              {step5Phase === 'complete' && (
                <div className="text-center py-2">
                  <div className="flex justify-center mb-3"><PartyPopper size={36} className="text-[var(--fg-accent)]" /></div>
                  <h3 className="text-xl font-bold text-[var(--fg-text-primary)] mb-2">{t('onboarding.complete')}</h3>
                  {step5NodeCount > 0 ? (
                    <p className="text-sm text-[var(--fg-text-secondary)] mb-4">
                      {t('onboarding.completeNodes', { count: step5NodeCount })}
                      <br />
                      {t('onboarding.completeTourHint')}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--fg-text-secondary)] mb-4">
                      {t('onboarding.completeNoNodes')}
                    </p>
                  )}
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleFinish('codemap')}
                      className="px-5 py-2.5 bg-[var(--fg-accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-sm transition-colors"
                    >
                      {t('onboarding.openCodeMap')}
                    </button>
                    <button
                      onClick={() => handleFinish('library')}
                      className="px-5 py-2.5 border border-[var(--fg-input-border)] text-[var(--fg-text-secondary)] rounded-lg text-sm font-medium hover:bg-[var(--fg-tree-hover)] transition-colors"
                    >
                      {t('onboarding.stayLibrary')}
                    </button>
                  </div>
                </div>
              )}

              {step5Phase === 'error' && (
                <div className="text-center py-4">
                  <div className="flex justify-center mb-3"><AlertTriangle size={36} className="text-[var(--fg-status-warning)]" /></div>
                  <h3 className="text-lg font-semibold text-[var(--fg-text-primary)] mb-2">{t('onboarding.errorTitle')}</h3>
                  <p className="text-sm text-[var(--fg-text-secondary)] mb-4">
                    {step5Error || t('onboarding.errorHint')}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleFinish('library')}
                      className="px-5 py-2.5 bg-[var(--fg-accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-sm transition-colors"
                    >
                      {t('onboarding.enterLibrary')}
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
              className="px-4 py-2 text-sm text-[var(--fg-text-tertiary)] hover:text-[var(--fg-text-primary)] disabled:opacity-0 transition-opacity"
            >
              {t('onboarding.prev')}
            </button>
            <span className="text-xs text-[var(--fg-text-tertiary)] self-center">
              {step + 1} / {total}
            </span>
            <button
              onClick={next}
              disabled={step >= total - 2}
              className="px-5 py-2 bg-[var(--fg-accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-40"
            >
              {step === total - 2 ? '—' : t('onboarding.next')}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
