/**
 * E2E: deleting a project must not be blocked by its own extension data.
 *
 * Every child table has `FOREIGN KEY (project_id) REFERENCES projects(id)` and the
 * connection runs with `foreign_keys = ON`, so `DELETE FROM projects` fails unless
 * the children are removed first. The tables added in later phases (progress,
 * notes, review cards/findings, learning paths) were easy to forget — this test
 * makes the cascade explicit: use the features, then delete the project.
 */
import { test, expect } from '@playwright/test'
import { launchApp, installDemo } from './harness'

test('a project that has progress, notes and review data can still be deleted', async () => {
  const handle = await launchApp()
  try {
    const { page } = handle
    await installDemo(handle)

    // Populate the child tables through the real IPC surface.
    const created = await page.evaluate(async () => {
      const list = await window.fieldguide.projectList()
      const project = (list.data ?? [])[0] as { id: string; root_path: string } | undefined
      if (!project) return { ok: false, error: 'no project' }

      const graph = await window.fieldguide.graphGet(project.id)
      const nodes = ((graph.data as { nodes?: Array<{ id: string; type?: string }> })?.nodes ?? [])
      const node = nodes.find((n) => n.type === 'file') ?? nodes[0]
      if (!node) return { ok: false, error: 'no node' }

      const progress = await window.fieldguide.progressSet(project.id, node.id, 'mastered', 3)
      const note = await window.fieldguide.notesAdd({
        project_id: project.id,
        node_id: node.id,
        file_path: (node as { filePath?: string }).filePath ?? 'go.mod',
        body: '这条笔记用于验证删除项目时子表会被一并清理（外键级联）。',
      })
      const review = await window.fieldguide.reviewGenerate(project.id)
      return {
        ok: true,
        projectId: project.id,
        progressOk: progress.ok,
        noteOk: note.ok,
        noteError: note.error?.message,
        reviewOk: review.ok,
        reviewAdded: (review.data as { added?: number } | undefined)?.added,
      }
    })
    console.log('SEED:', JSON.stringify(created))
    expect(created.ok).toBe(true)
    expect(created.progressOk).toBe(true)
    expect(created.noteOk).toBe(true)

    // Now delete it the way a user would: library card → trash → confirm.
    await page.getByRole('button', { name: '项目库' }).click()
    // Scope to the library: the title bar also renders the selected project's name.
    const library = page.locator('main')
    await expect(library.getByRole('button', { name: /Fieldguide Demo/ })).toBeVisible()
    page.once('dialog', (dialog) => void dialog.accept())
    // Icon-only button: it carries a title, not text, so match on the attribute.
    await library.locator('button[title="删除项目记录"]').first().click()

    // The card must actually disappear (a FK failure leaves it in place with a toast).
    await expect(library.getByRole('button', { name: /Fieldguide Demo/ })).toHaveCount(0, { timeout: 15_000 })
  } finally {
    await handle.cleanup()
  }
})
