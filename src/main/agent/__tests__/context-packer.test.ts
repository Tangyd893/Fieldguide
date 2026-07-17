import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

// Mock DB / vector before importing packer
vi.mock('../../db', () => ({
  listPapers: () => [],
  getProject: () => null,
}))

vi.mock('../../vector', () => ({
  queryPaper: async () => [],
}))

vi.mock('../../ua/cross-tour', () => ({
  buildCrossSourceContext: () => [],
}))

import { packCoachContext, detectCoachIntent } from '../context-packer'

describe('packCoachContext', () => {
  let root: string

  beforeEach(() => {
    root = join(tmpdir(), `fg-coach-${Date.now()}`)
    mkdirSync(join(root, '.understand-anything'), { recursive: true })
    writeFileSync(
      join(root, '.understand-anything', 'knowledge-graph.json'),
      JSON.stringify({
        version: '1.0.0',
        project: {
          name: 'demo-proj',
          languages: ['go'],
          frameworks: [],
          description: '',
        },
        nodes: [
          {
            id: 'file:cmd/main.go',
            type: 'file',
            name: 'main.go',
            filePath: 'cmd/main.go',
            summary: '',
            tags: [],
            metadata: {
              summary: 'Application entry point',
              tags: ['entrypoint', 'main'],
            },
          },
          {
            id: 'function:cmd/main.go:main',
            type: 'function',
            name: 'main',
            filePath: 'cmd/main.go',
            metadata: { summary: 'starts HTTP server' },
          },
        ],
        edges: [
          {
            source: 'file:cmd/main.go',
            target: 'function:cmd/main.go:main',
            type: 'contains',
          },
        ],
        layers: [
          {
            id: 'layer:entry',
            name: 'Entry',
            description: 'Startup',
            nodeIds: ['file:cmd/main.go'],
          },
          {
            id: 'layer:service',
            name: 'Service',
            description: 'Handlers',
            nodeIds: [],
          },
        ],
        tour: [
          {
            order: 1,
            title: 'Entry',
            description: 'Start at main.go',
            nodeIds: ['file:cmd/main.go'],
          },
        ],
      }),
      'utf-8',
    )
  })

  it('synthesizes identity when description is empty and includes layers/tour', async () => {
    const packed = await packCoachContext(
      {
        projectId: 'p1',
        projectName: 'demo-proj',
        projectRoot: root,
        locale: 'zh-CN',
      },
      '为我介绍这个项目及其入口',
    )

    expect(packed.intent).toBe('overview')
    expect(packed.markdown).toMatch(/Project identity/i)
    expect(packed.markdown).toMatch(/Entry/)
    expect(packed.markdown).toMatch(/Architecture layers/i)
    expect(packed.markdown).toMatch(/Guided tour/i)
    expect(packed.markdown).toMatch(/main\.go|entrypoint|入口|Entry/i)
    expect(packed.seedNodeIds.length).toBeGreaterThan(0)

    rmSync(root, { recursive: true, force: true })
  })

  it('includes focused node when provided', async () => {
    const packed = await packCoachContext(
      {
        projectId: 'p1',
        projectName: 'demo-proj',
        projectRoot: root,
        locale: 'en-US',
        focusedNodeId: 'file:cmd/main.go',
        tourStepIndex: 0,
      },
      'explain this',
    )
    expect(packed.markdown).toMatch(/Currently focused node/)
    expect(packed.seedNodeIds).toContain('file:cmd/main.go')
    rmSync(root, { recursive: true, force: true })
  })
})

describe('detectCoachIntent smoke', () => {
  it('overview', () => {
    expect(detectCoachIntent('introduce the project')).toBe('overview')
  })
})
