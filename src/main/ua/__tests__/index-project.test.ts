/**
 * Live indexProject integration test — copies tiny-go sources to a temp dir,
 * runs the full scan → Tree-sitter → GraphBuilder → saveGraph pipeline
 * (no LLM), and asserts a non-empty knowledge-graph.json.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { cpSync, existsSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: () => tmpdir(),
  },
}))

import { indexProject } from '../client'
import { loadGraph, searchNodes, getGraphStats } from '../graph-reader'

const FIXTURE_SRC = join(process.cwd(), 'tests/fixtures/tiny-go')

describe('indexProject (live pipeline)', () => {
  let root: string

  beforeAll(() => {
    root = join(tmpdir(), `fg-index-live-${Date.now()}`)
    cpSync(FIXTURE_SRC, root, {
      recursive: true,
      filter: (src) => {
        const norm = src.replace(/\\/g, '/')
        return !norm.includes('/.understand-anything') && !norm.endsWith('scan-result.json')
      },
    })
    const leftover = join(root, '.understand-anything', 'knowledge-graph.json')
    if (existsSync(leftover)) rmSync(leftover, { force: true })
  }, 10_000)

  afterAll(() => {
    if (root && existsSync(root)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it(
    'indexes tiny-go sources and writes knowledge-graph.json with nodes',
    async () => {
      const result = await indexProject(
        root,
        'tiny-go-live',
        undefined,
        undefined,
        false, // full index
        undefined, // no LLM
        undefined,
        'zh',
      )

      expect(result.success, result.error).toBe(true)
      expect(result.nodeCount).toBeGreaterThan(0)
      expect(result.edgeCount).toBeGreaterThanOrEqual(0)
      expect(existsSync(join(root, '.understand-anything', 'knowledge-graph.json'))).toBe(true)

      const graph = loadGraph(root)
      expect(graph).not.toBeNull()
      expect(graph!.nodes.length).toBe(result.nodeCount)
      expect(graph!.nodes.length).toBeGreaterThanOrEqual(5)

      const stats = getGraphStats(graph!)
      expect(stats.nodeCount).toBe(result.nodeCount)

      const hits = searchNodes(graph!, 'main')
      expect(hits.length).toBeGreaterThan(0)

      // Tour should be heuristic Tour[] when no LLM
      expect(Array.isArray(graph!.tour)).toBe(true)
      if ((graph!.tour?.length ?? 0) > 0) {
        const first = graph!.tour![0] as { id?: string; steps?: unknown[] }
        expect(first.id || first.steps).toBeTruthy()
      }
    },
    120_000,
  )

  it(
    'incremental with no changes preserves nodeCount',
    async () => {
      // Ensure a graph exists from previous test
      const before = loadGraph(root)
      expect(before).not.toBeNull()
      const beforeCount = before!.nodes.length

      const result = await indexProject(
        root,
        'tiny-go-live',
        undefined,
        undefined,
        true, // incremental
        undefined,
        undefined,
        'zh',
      )

      expect(result.success, result.error).toBe(true)
      expect(result.nodeCount).toBe(beforeCount)
      expect(result.nodeCount).toBeGreaterThan(0)

      const after = JSON.parse(
        readFileSync(join(root, '.understand-anything', 'knowledge-graph.json'), 'utf-8'),
      )
      expect(after.nodes.length).toBe(beforeCount)
    },
    60_000,
  )
})
