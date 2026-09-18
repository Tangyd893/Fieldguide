/**
 * E2E harness: boot the real Electron app with an isolated data directory.
 *
 * `FIELDGUIDE_DATA_DIR` moves config, SQLite, exports and logs into a temp folder,
 * so every run starts from an empty library and never touches the developer's own
 * Fieldguide data. (Overriding APPDATA does NOT work: Electron resolves appData
 * through the OS API, not the environment.)
 */
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export interface AppHandle {
  app: ElectronApplication
  page: Page
  /** Temp data directory used by this run. */
  dataDir: string
  /** Projects root the app should use. */
  projectsRoot: string
  cleanup: () => Promise<void>
}

const repoRoot = join(__dirname, '..')

interface LaunchOptions {
  /** Start with the onboarding wizard visible instead of a completed config. */
  onboarding?: boolean
  /** UI language for the seeded config. */
  locale?: 'zh-CN' | 'en-US'
}

export async function launchApp(options: LaunchOptions = {}): Promise<AppHandle> {
  const dataDir = mkdtempSync(join(tmpdir(), 'fg-e2e-data-'))
  const projectsRoot = mkdtempSync(join(tmpdir(), 'fg-e2e-projects-'))
  mkdirSync(dataDir, { recursive: true })

  writeFileSync(
    join(dataDir, 'config.json'),
    JSON.stringify({
      llm: { baseUrl: 'https://api.deepseek.com/v1', apiKey: '', chatModel: 'deepseek-v4-flash', embedModel: '' },
      locale: options.locale ?? 'zh-CN',
      theme: 'light',
      appearance: {
        themePreset: 'parchment',
        shellZoom: 100,
        dashboardZoom: 100,
        uiFont: 'Segoe UI',
        monoFont: 'Cascadia Code',
        uiFontSize: 14,
        monoFontSize: 13,
        sidebarWidth: 260,
      },
      projectsRoot,
      // Seed "wizard already done" so tests start at the project library.
      onboardingCompleted: !options.onboarding,
      ua: { language: 'zh', incremental: true },
    }, null, 2),
    'utf-8',
  )

  const app = await electron.launch({
    args: [join(repoRoot, 'out', 'main', 'index.js')],
    cwd: repoRoot,
    env: {
      ...process.env,
      FIELDGUIDE_DATA_DIR: dataDir,
      // Keep the graph engine offline and deterministic.
      NO_PROXY: '*',
    },
  })

  const page = await app.firstWindow()
  // The renderer needs a moment to mount React before the first assertion.
  await page.waitForLoadState('domcontentloaded')

  return {
    app,
    page,
    dataDir,
    projectsRoot,
    cleanup: async () => {
      await app.close().catch(() => { /* already gone */ })
      rmSync(dataDir, { recursive: true, force: true })
      rmSync(projectsRoot, { recursive: true, force: true })
    },
  }
}

/**
 * Install the bundled demo project and wait until the code map is up.
 *
 * Installing *selects* the new project, and the library calls `onSelect` → the
 * shell switches to the code map. So there is no card to click afterwards.
 *
 * Do NOT wait for the "104 个节点" text: the empty state carries the hint
 * "约 104 个节点…", which matches and resolves before the install is done.
 */
export async function installDemo(handle: AppHandle): Promise<void> {
  const { page } = handle
  await page.getByRole('button', { name: '安装内置 Demo' }).click()
  // The node search bar only renders inside the code map.
  await expect(page.getByPlaceholder(/搜索函数、类/)).toBeVisible({ timeout: 60_000 })
}
