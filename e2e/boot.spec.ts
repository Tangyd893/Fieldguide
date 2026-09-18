/**
 * E2E: the app boots, the library starts empty, and the demo installs.
 *
 * These are the flows that had **no** automated coverage before (see the audit):
 * everything else exercised pure logic or a headless IPC path.
 */
import { test, expect } from '@playwright/test'
import { launchApp, installDemo } from './harness'

test('boots to an empty project library', async () => {
  const handle = await launchApp()
  try {
    const { page } = handle
    await expect(page.getByRole('heading', { name: '添加你的第一个项目' })).toBeVisible()
    await expect(page.getByRole('button', { name: '安装内置 Demo' })).toBeVisible()
    await expect(page.getByRole('button', { name: '选择本地文件夹' })).toBeVisible()
    await expect(page.getByRole('button', { name: '从 Git URL 克隆' })).toBeVisible()
    // No project is selected yet, and project-dependent modules are disabled.
    await expect(page.getByRole('button', { name: '未选择项目' })).toBeVisible()
    await expect(page.getByRole('button', { name: '代码地图' })).toBeDisabled()
  } finally {
    await handle.cleanup()
  }
})

test('installs the bundled demo and reports a ready graph', async () => {
  const handle = await launchApp()
  try {
    const { page } = handle
    await installDemo(handle)

    // The demo ships a pre-built graph, so the card must be ready with its node count.
    await expect(page.getByRole('button', { name: /Fieldguide Demo/ })).toBeVisible()
    await expect(page.getByText('就绪').first()).toBeVisible()
    await expect(page.getByText(/104 个节点/).first()).toBeVisible()
    // With a project present the code map becomes reachable.
    await expect(page.getByRole('button', { name: '代码地图' })).toBeEnabled()
  } finally {
    await handle.cleanup()
  }
})

test('shows the onboarding wizard when onboarding has not been completed', async () => {
  const handle = await launchApp({ onboarding: true })
  try {
    const { page } = handle
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: '欢迎使用 Fieldguide' })).toBeVisible()
    await expect(dialog.getByText('1 / 5')).toBeVisible()
    // Step 1 is the welcome; 下一步 advances to the language picker.
    await expect(dialog.getByRole('button', { name: '← 上一步' })).toBeDisabled()
    await dialog.getByRole('button', { name: '下一步 →' }).click()
    await expect(page.getByText('选择界面语言')).toBeVisible()
  } finally {
    await handle.cleanup()
  }
})
