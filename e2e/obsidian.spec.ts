/**
 * E2E: the Obsidian integration, driven through the real UI.
 *
 * The hard gate means the feature is only reachable through a working CLI, and no
 * CI machine has one — so the run installs a *stub* CLI (a `.cmd`, which also
 * covers the cmd.exe fallback path) and points Fieldguide at it with
 * `FIELDGUIDE_OBSIDIAN_CLI`. That keeps the flow deterministic without mocking the
 * application's own code.
 *
 * What these tests protect, in order of risk:
 *   - the ownership model: a note the reader edited is never silently clobbered;
 *   - the gate: no vault action without a usable CLI;
 *   - idempotency: a second sync must not rewrite everything;
 *   - the plumbing that is easy to leave dead (unbind, auto-open, cleanup).
 */
import { test, expect, type Page } from '@playwright/test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { launchApp, installDemo, writeFakeObsidianCli } from './harness'

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

/** Settings → Obsidian, from wherever the shell currently is. */
async function openObsidianSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: '设置' }).click()
  await page.getByRole('button', { name: 'Obsidian' }).click()
}

/** Bind the (single) vault the stub reports and persist it. */
async function bindVault(page: Page, vaultDir: string): Promise<void> {
  await openObsidianSettings(page)
  await expect(page.getByText('可用', { exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: new RegExp(vaultDir.replace(/\\/g, '\\\\').slice(0, 12)) }).click()
  await page.getByRole('button', { name: '保存' }).click()
}

/** Open the vault panel of the selected project. */
async function openVaultPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: '代码地图' }).click()
  await page.getByRole('tab', { name: 'Vault', exact: true }).click()
}

/** Run a sync through the dry-run preview (the only path the UI offers). */
async function syncViaPreview(page: Page): Promise<void> {
  await page.getByRole('button', { name: '同步到 vault' }).click()
  await page.getByRole('button', { name: '确认同步' }).click()
  await expect(page.getByText(/同步完成/)).toBeVisible({ timeout: 30_000 })
}

function projectFolder(vaultDir: string): string {
  return join(vaultDir, 'Fieldguide', 'demo')
}

function listNotes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listNotes(join(dir, entry.name)) : [join(dir, entry.name)])
}

test('without a usable CLI the vault actions are gated and the fix is explained', async () => {
  const missing = join(tempDir('fg-e2e-nocli-'), 'Obsidian.com')
  const handle = await launchApp({ obsidianCli: missing })
  try {
    const { page } = handle
    await openObsidianSettings(page)

    // The status pill must name the actual state, not a generic failure.
    await expect(page.getByText('未检测到 CLI')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: '选择目录' })).toBeDisabled()
    await expect(page.getByRole('button', { name: '新建 vault' })).toBeDisabled()
    // And the user must be told how to fix it, including the installer requirement.
    await expect(page.getByText('如何启用 Obsidian CLI')).toBeVisible()
    await expect(page.getByText(/1\.12\.7/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '重新检测' })).toBeEnabled()
  } finally {
    await handle.cleanup()
  }
})

test('binds a vault and syncs the demo project into it', async () => {
  const cliDir = tempDir('fg-e2e-cli-')
  const vaultDir = tempDir('fg-e2e-vault-')
  const cli = writeFakeObsidianCli(cliDir, vaultDir)

  const handle = await launchApp({ obsidianCli: cli })
  try {
    const { page } = handle
    await installDemo(handle)
    await bindVault(page, vaultDir)

    await openVaultPanel(page)
    await expect(page.getByText('这个项目还没有同步过。')).toBeVisible()
    await syncViaPreview(page)

    // ── the files are on disk, inside our own folder, with markers ──
    const folder = projectFolder(vaultDir)
    await expect.poll(() => existsSync(folder), { timeout: 20_000 }).toBe(true)

    const rootFiles = readdirSync(folder).filter((name) => name.endsWith('.md'))
    expect(rootFiles.length).toBeGreaterThan(0)

    // The learning report also lives at the root, so pick the index by name.
    const indexName = rootFiles.find((name) => name.includes('索引'))
    expect(indexName, `no index note among: ${rootFiles.join(', ')}`).toBeTruthy()
    const indexContent = readFileSync(join(folder, indexName!), 'utf-8')
    expect(indexContent).toContain('fieldguide-kind: index')
    expect(indexContent).toContain('%% fieldguide:begin %%')
    expect(indexContent).toContain('Fieldguide Demo')

    const card = listNotes(folder).find((file) => file.includes('cards'))
    expect(card).toBeTruthy()
    const cardContent = readFileSync(card!, 'utf-8')
    expect(cardContent).toContain('fieldguide-project: demo')
    expect(cardContent).toContain('%% fieldguide:begin %%')

    // The panel now lists the synced cards instead of the empty state.
    await expect(page.getByText('这个项目还没有同步过。')).toHaveCount(0)
  } finally {
    await handle.cleanup()
    rmSync(cliDir, { recursive: true, force: true })
    rmSync(vaultDir, { recursive: true, force: true })
  }
})

test('creates a new vault folder and waits for Obsidian to register it', async () => {
  const cliDir = tempDir('fg-e2e-cli3-')
  const parentDir = tempDir('fg-e2e-newvault-')
  // The stub reports an existing vault so the CLI gate is open.
  const cli = writeFakeObsidianCli(cliDir, parentDir)
  const handle = await launchApp({ obsidianCli: cli })
  try {
    const { page } = handle
    await openObsidianSettings(page)
    await expect(page.getByText('可用', { exact: true })).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: '新建 vault' }).click()
    const form = page.locator('div', { hasText: '父目录' }).last()
    await form.getByRole('textbox').first().fill(parentDir)
    await page.getByPlaceholder('FieldguideVault').fill('FieldguideTestVault')
    await page.getByRole('button', { name: '创建' }).click()

    // The folder plus the `.obsidian` marker is what makes Obsidian treat it as a
    // vault; the user still confirms it in Obsidian's own vault manager.
    const created = join(parentDir, 'FieldguideTestVault')
    await expect.poll(() => existsSync(join(created, '.obsidian')), { timeout: 20_000 }).toBe(true)
    await expect(page.getByText(created)).toBeVisible()
    await expect(page.getByText('等待 Obsidian 登记…')).toBeVisible()
  } finally {
    await handle.cleanup()
    rmSync(cliDir, { recursive: true, force: true })
    rmSync(parentDir, { recursive: true, force: true })
  }
})

test('a second sync writes nothing and reports the plan as unchanged', async () => {
  const cliDir = tempDir('fg-e2e-cli2-')
  const vaultDir = tempDir('fg-e2e-vault2-')
  const cli = writeFakeObsidianCli(cliDir, vaultDir)
  const handle = await launchApp({ obsidianCli: cli })
  try {
    const { page } = handle
    await installDemo(handle)
    await bindVault(page, vaultDir)
    await openVaultPanel(page)
    await syncViaPreview(page)

    // Nothing changed since: the plan must be a no-op, not a rewrite.
    await page.getByRole('button', { name: '同步到 vault' }).click()
    await expect(page.getByText(/未变 [1-9]/)).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click()
  } finally {
    await handle.cleanup()
    rmSync(cliDir, { recursive: true, force: true })
    rmSync(vaultDir, { recursive: true, force: true })
  }
})

test('turning on auto-open makes the sync open the index through the CLI', async () => {
  const cliDir = tempDir('fg-e2e-cli4-')
  const vaultDir = tempDir('fg-e2e-vault4-')
  const logFile = join(cliDir, 'calls.log')
  const cli = writeFakeObsidianCli(cliDir, vaultDir, { logFile })
  const handle = await launchApp({ obsidianCli: cli })
  try {
    const { page } = handle
    await installDemo(handle)
    await bindVault(page, vaultDir)

    // The setting is a standing preference, not a per-click option.
    await page.getByLabel('同步后在 Obsidian 打开索引').check()
    await page.getByRole('button', { name: '保存' }).click()

    // Guard the setting itself first: a silently-unsaved toggle would make the
    // assertion below pass or fail for the wrong reason.
    await expect.poll(() => {
      const config = JSON.parse(readFileSync(join(handle.dataDir, 'config.json'), 'utf-8')) as
        { obsidian?: { openAfterSync?: boolean; vaultPath?: string } }
      return config.obsidian?.openAfterSync === true && Boolean(config.obsidian?.vaultPath)
    }, { timeout: 20_000 }).toBe(true)

    await openVaultPanel(page)
    await syncViaPreview(page)

    await expect.poll(
      () => (existsSync(logFile) ? readFileSync(logFile, 'utf-8') : ''),
      { timeout: 20_000 },
    ).toContain('open')
  } finally {
    await handle.cleanup()
    rmSync(cliDir, { recursive: true, force: true })
    rmSync(vaultDir, { recursive: true, force: true })
  }
})

test('a note whose markers were removed is reported as a conflict and never rewritten automatically', async () => {
  const cliDir = tempDir('fg-e2e-cli5-')
  const vaultDir = tempDir('fg-e2e-vault5-')
  const cli = writeFakeObsidianCli(cliDir, vaultDir)
  const handle = await launchApp({ obsidianCli: cli })
  try {
    const { page } = handle
    await installDemo(handle)
    await bindVault(page, vaultDir)
    await openVaultPanel(page)
    await syncViaPreview(page)

    // The reader rewrites one card in their own editor, markers and all.
    const card = listNotes(projectFolder(vaultDir)).find((file) => file.includes('cards'))!
    const mine = '# 我自己的版本\n\n这段是我在 Obsidian 里重写的，没有任何标记。\n'
    writeFileSync(card, mine, 'utf-8')

    await page.getByRole('button', { name: '同步到 vault' }).click()
    await expect(page.getByText(/冲突 [1-9]/)).toBeVisible()
    // The file must still be untouched at this point — that is the whole promise.
    expect(readFileSync(card, 'utf-8')).toBe(mine)
    await page.getByRole('button', { name: '确认同步' }).click()
    await expect(page.getByText(/同步完成/)).toBeVisible({ timeout: 30_000 })
    expect(readFileSync(card, 'utf-8')).toBe(mine)

    // The panel offers the decision, and taking Fieldguide's version restores the
    // block *around* the reader's text instead of deleting it.
    await page.getByText('仅看问题').click()
    await page.getByRole('button', { name: '用 Fieldguide 版本覆盖' }).click()
    await expect.poll(() => readFileSync(card, 'utf-8'), { timeout: 20_000 }).toContain('%% fieldguide:begin %%')
    const after = readFileSync(card, 'utf-8')
    expect(after).toContain('我自己的版本')
  } finally {
    await handle.cleanup()
    rmSync(cliDir, { recursive: true, force: true })
    rmSync(vaultDir, { recursive: true, force: true })
  }
})

test('cleanup removes generated notes but keeps the ones the reader edited', async () => {
  const cliDir = tempDir('fg-e2e-cli6-')
  const vaultDir = tempDir('fg-e2e-vault6-')
  const cli = writeFakeObsidianCli(cliDir, vaultDir)
  const handle = await launchApp({ obsidianCli: cli })
  try {
    const { page } = handle
    await installDemo(handle)
    await bindVault(page, vaultDir)
    await openVaultPanel(page)
    await syncViaPreview(page)

    const notes = listNotes(projectFolder(vaultDir))
    expect(notes.length).toBeGreaterThan(1)
    // Annotate one card the way a reader would: appended outside the block.
    const kept = notes.find((file) => file.includes('cards'))!
    writeFileSync(kept, `${readFileSync(kept, 'utf-8')}\n我的批注：这段要重读。\n`, 'utf-8')

    // Cleanup asks for confirmation through a native dialog, which Playwright
    // dismisses by default — a dismissed confirm must mean "no deletion".
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: '清理生成的卡片' }).click()
    await expect(page.getByText(/已删除 \d+ 个文件/)).toBeVisible({ timeout: 30_000 })

    // Untouched generated files are gone; the annotated one survives with its text.
    const remaining = listNotes(projectFolder(vaultDir))
    expect(remaining).toContain(kept)
    expect(remaining.length).toBeLessThan(notes.length)
    expect(readFileSync(kept, 'utf-8')).toContain('我的批注：这段要重读。')
  } finally {
    await handle.cleanup()
    rmSync(cliDir, { recursive: true, force: true })
    rmSync(vaultDir, { recursive: true, force: true })
  }
})

test('a synced card can be adopted back as an in-app code note', async () => {
  const cliDir = tempDir('fg-e2e-cli7-')
  const vaultDir = tempDir('fg-e2e-vault7-')
  const cli = writeFakeObsidianCli(cliDir, vaultDir)
  const handle = await launchApp({ obsidianCli: cli })
  try {
    const { page } = handle
    await installDemo(handle)
    await bindVault(page, vaultDir)
    await openVaultPanel(page)
    await syncViaPreview(page)

    // Layer cards carry graph node ids, so they can point back at a real file.
    await page.getByText('分层', { exact: false }).first().click()
    await page.getByRole('button', { name: '采纳为代码笔记' }).click()
    await expect(page.getByText('已采纳到应用内笔记')).toBeVisible({ timeout: 20_000 })
  } finally {
    await handle.cleanup()
    rmSync(cliDir, { recursive: true, force: true })
    rmSync(vaultDir, { recursive: true, force: true })
  }
})

test('unbinding keeps the vault usable and can optionally clean up its own notes', async () => {
  const cliDir = tempDir('fg-e2e-cli8-')
  const vaultDir = tempDir('fg-e2e-vault8-')
  const cli = writeFakeObsidianCli(cliDir, vaultDir)
  const handle = await launchApp({ obsidianCli: cli })
  try {
    const { page } = handle
    await installDemo(handle)
    await bindVault(page, vaultDir)
    await openVaultPanel(page)
    await syncViaPreview(page)
    expect(listNotes(projectFolder(vaultDir)).length).toBeGreaterThan(0)

    // Unbind with cleanup: the generated notes go, the binding is cleared.
    await openObsidianSettings(page)
    await page.getByRole('button', { name: '解绑', exact: true }).click()
    await page.getByRole('button', { name: '解绑并清理生成物' }).click()
    await expect(page.getByText(/已解绑并清理/)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('尚未绑定 vault')).toBeVisible()
    await expect.poll(() => listNotes(projectFolder(vaultDir)).length, { timeout: 20_000 }).toBe(0)
  } finally {
    await handle.cleanup()
    rmSync(cliDir, { recursive: true, force: true })
    rmSync(vaultDir, { recursive: true, force: true })
  }
})
