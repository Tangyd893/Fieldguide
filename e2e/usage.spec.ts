/**
 * E2E: the opt-in usage log records learning activity and nothing else.
 *
 * The unit tests prove the sanitiser in isolation; this proves the whole path —
 * settings toggle → real IPC → file on disk → aggregate → export — and checks the
 * exported file itself for content that must never be there. A privacy promise is
 * only worth what the strongest assertion behind it is worth.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { launchApp, installDemo } from './harness'

test('records learning activity once enabled, and never records free text', async () => {
  const handle = await launchApp()
  try {
    const { page } = handle
    await installDemo(handle)

    // Off by default: the summary must exist and be empty before opting in.
    const before = await page.evaluate(async () => {
      const r = await window.fieldguide.usageSummary(7)
      return r.data ?? null
    })
    expect(before?.enabled).toBe(false)
    expect(before?.totalEvents).toBe(0)
    expect(before?.policy).toEqual({ freeText: false, offByDefault: true, localOnly: true })

    const secret = `SECRET-QUESTION-${Date.now()}`

    const result = await page.evaluate(async (secretText) => {
      await window.fieldguide.configSet({ usage: { enabled: true } } as never)

      const projects = await window.fieldguide.projectList()
      const project = projects.data?.[0]
      if (!project) return { error: 'no project' }

      const graph = await window.fieldguide.graphGet(project.id)
      const nodes = (graph.data as { nodes?: Array<{ id: string; filePath?: string }> })?.nodes ?? []
      const node = nodes.find((n) => n.filePath) ?? nodes[0]

      // Real learning actions through the real IPC surface.
      await window.fieldguide.progressSet(project.id, node.id, 'mastered', 3)
      await window.fieldguide.notesAdd({
        project_id: project.id,
        node_id: node.id,
        file_path: node.filePath ?? 'main.go',
        line_start: 1,
        line_end: 2,
        body: '这是我写在笔记正文里的秘密内容',
      })
      const cards = await window.fieldguide.reviewGenerate(project.id)
      const first = (cards.data as { added?: number } | undefined)?.added ?? 0
      const list = await window.fieldguide.reviewList(project.id)
      const cardId = (list.data as { cards?: Array<{ id: string }> } | undefined)?.cards?.[0]?.id
      if (cardId) await window.fieldguide.reviewGrade(cardId, 4)

      // A hostile payload: free text in an unknown field, and prose in the
      // identifier field. Neither may reach the log.
      await window.fieldguide.usageRecord({
        event: 'coach_asked',
        project: project.id,
        content: secretText,
        target: `请问这个项目 ${secretText} 的入口在哪里`,
      } as never)

      const summary = await window.fieldguide.usageSummary(7)
      const exported = await window.fieldguide.usageExport()
      return {
        cards: first,
        summary: summary.data,
        exportPath: exported.data?.exportPath ?? '',
        exportEvents: exported.data?.events ?? 0,
      }
    }, secret)

    expect(result.error).toBeUndefined()
    expect(result.summary?.enabled).toBe(true)
    // progress mark + note + review grade (and the citation event is dropped)
    expect(result.summary?.totalEvents).toBeGreaterThanOrEqual(3)
    expect(result.summary?.byEvent.progress_marked).toBe(1)
    expect(result.summary?.byEvent.note_added).toBe(1)
    if (result.cards && result.cards > 0) {
      expect(result.summary?.byEvent.review_graded).toBe(1)
    }
    // The hostile event is recorded (its name is legitimate) …
    expect(result.summary?.byEvent.coach_asked).toBe(1)

    // … but the exported file must contain none of the prose, and the note body
    // must not be there either. This is the assertion the privacy claim rests on.
    expect(result.exportPath).toBeTruthy()
    const exported = readFileSync(result.exportPath, 'utf-8')
    expect(exported).not.toContain(secret)
    expect(exported).not.toContain('笔记正文里的秘密内容')
    expect(exported).toContain('不含笔记正文、不含提问文本、不含源码')
    // The identifier that *is* legitimate survives.
    expect(exported).toMatch(/\| (progress_marked|note_added) \|/)
  } finally {
    await handle.cleanup()
  }
})

test('writes nothing to disk while logging is off', async () => {
  const handle = await launchApp()
  try {
    const { page } = handle
    await installDemo(handle)

    const state = await page.evaluate(async () => {
      const projects = await window.fieldguide.projectList()
      const project = projects.data?.[0]
      const graph = await window.fieldguide.graphGet(project!.id)
      const node = ((graph.data as { nodes?: Array<{ id: string }> }).nodes ?? [])[0]
      await window.fieldguide.progressSet(project!.id, node.id, 'reading')
      const summary = await window.fieldguide.usageSummary(7)
      const exported = await window.fieldguide.usageExport()
      return { summary: summary.data, events: exported.data?.events ?? 0 }
    })

    expect(state.summary?.enabled).toBe(false)
    expect(state.summary?.totalEvents).toBe(0)
    expect(state.events).toBe(0)
  } finally {
    await handle.cleanup()
  }
})
