/**
 * E2E: the code-map loop and the workbench panels.
 *
 * These are exactly the flows that had no automated coverage: "click a graph node
 * → open the source file", the panel tabs actually mounting (instead of falling
 * back to "面板不可用"), content search jumping to a line, and the shortcuts
 * dialog opening.
 */
import { test, expect, type Page } from '@playwright/test'
import { launchApp, installDemo, type AppHandle } from './harness'

/** Install the demo (which selects it and lands on the code map). */
async function openCodeMap(handle: AppHandle): Promise<Page> {
  const { page } = handle
  await installDemo(handle)
  return page
}

test('code map renders the graph iframe and the file tree', async () => {
  const handle = await launchApp()
  try {
    const page = await openCodeMap(handle)

    // The UA Dashboard is embedded from the custom protocol — this is the piece
    // that silently showed a placeholder for a long time.
    const iframe = page.locator('iframe')
    await expect(iframe).toBeVisible()
    const src = await iframe.getAttribute('src')
    expect(src ?? '').toContain('ua-dashboard://')

    // File tree of the demo project is visible with its real files. `go.mod` sits
    // at the repo root, so it needs no directory expansion; `main.go` lives under
    // cmd/gateway, and only `cmd`/`internal`/`pkg`/... auto-expand.
    await expect(page.getByText('go.mod').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('internal', { exact: true }).first()).toBeVisible()
  } finally {
    await handle.cleanup()
  }
})

test('searching a node opens its file in the code panel', async () => {
  const handle = await launchApp()
  try {
    const page = await openCodeMap(handle)

    // The node search bar sits above the split panels.
    const search = page.getByPlaceholder(/搜索函数、类/)
    await search.fill('worker')
    // The engine flag reports which matcher ran (UA engine vs deterministic
    // substring); either is acceptable, it just must not be missing.
    await expect(page.getByText(/UA 语义引擎|子串降级/).first()).toBeVisible({ timeout: 30_000 })

    // Debounced server-side search → results dropdown. Pick the `pool.go` entry
    // explicitly: "worker" also matches `pool_test.go`, which sorts differently.
    const firstResult = page.locator('button:has-text("pool.go")').first()
    await firstResult.waitFor({ state: 'visible', timeout: 30_000 })
    await firstResult.click()

    // The active panel switches to the code tab and shows the clicked file.
    await expect(page.getByText(/internal[\\/]worker[\\/]pool\.go/).first()).toBeVisible({ timeout: 20_000 })
  } finally {
    await handle.cleanup()
  }
})

test('every workbench panel mounts instead of showing its unavailable notice', async () => {
  const handle = await launchApp()
  try {
    const page = await openCodeMap(handle)

    // Panel tabs live in the panel chrome; each must render real content.
    const panels: Array<{ tab: string; expectText: RegExp }> = [
      { tab: '总览', expectText: /架构总览|尚未生成架构总览|生成总览/ },
      { tab: '知识', expectText: /知识节点|尚未抽取知识卡片|抽取知识/ },
      { tab: '面试', expectText: /面试演练|尚未生成面试题|生成题目/ },
      { tab: '探索', expectText: /图谱统计|节点|路径查找/ },
      { tab: '进度', expectText: /已掌握|待读核心节点|覆盖率|共 \d+ 个图谱节点/ },
      { tab: '笔记', expectText: /还没有笔记|搜索笔记/ },
      { tab: '导师', expectText: /导师提问|让导师提问|提问范围/ },
    ]

    for (const panel of panels) {
      await page.getByRole('tab', { name: panel.tab }).first().click()
      await expect(page.getByText(panel.expectText).first()).toBeVisible({ timeout: 20_000 })
      // The generic fallback would mean the wiring is missing.
      await expect(page.getByText(`${panel.tab}面板不可用`)).toHaveCount(0)
    }
  } finally {
    await handle.cleanup()
  }
})

test('content search finds code and opens the hit', async () => {
  const handle = await launchApp()
  try {
    const page = await openCodeMap(handle)

    await page.keyboard.press('Control+Shift+F')
    const overlay = page.getByRole('dialog', { name: '全库内容搜索' })
    await expect(overlay).toBeVisible()

    await overlay.getByRole('textbox').fill('ErrQueueFull')
    await expect(overlay.getByText(/pool\.go/).first()).toBeVisible({ timeout: 30_000 })
    await overlay.locator('button:has-text("pool.go")').first().click()

    // Jumping to the hit opens the file in the code panel.
    await expect(page.getByText(/internal[\\/]worker[\\/]pool\.go/).first()).toBeVisible({ timeout: 20_000 })
  } finally {
    await handle.cleanup()
  }
})

test('shortcuts dialog opens from the command palette', async () => {
  const handle = await launchApp()
  try {
    const { page } = handle
    await page.keyboard.press('Control+k')
    const paletteInput = page.getByPlaceholder(/搜索命令/)
    await expect(paletteInput).toBeVisible()
    await paletteInput.fill('快捷键')
    await page.locator('button', { hasText: '键盘快捷键' }).first().click()

    const dialog = page.getByRole('dialog', { name: '键盘快捷键' })
    await expect(dialog).toBeVisible({ timeout: 20_000 })
    // The dialog documents the newer shortcuts, e.g. the content search added in
    // this work.
    await expect(dialog.getByText('全库内容搜索')).toBeVisible()
  } finally {
    await handle.cleanup()
  }
})
