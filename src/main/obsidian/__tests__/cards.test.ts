import { describe, it, expect } from 'vitest'
import { buildProjectNotes, type CardSources } from '../cards'
import { MANAGED_BEGIN } from '../render'
import type { ArchitectureSummary } from '../../../shared/understand'

const updatedAt = '2026-09-19T10:00:00.000Z'

const architecture: ArchitectureSummary = {
  projectId: 'local-1',
  stack: ['Go', 'SQLite'],
  layers: [{ id: 'layer:api', name: 'API' }],
  modules: [
    { name: 'API', layer: 'API', description: 'HTTP 层', nodeIds: ['fn:api:handle'] },
    { name: '结算', layer: 'Domain', description: '计费规则', nodeIds: ['fn:bill:charge'] },
  ],
  keyFlows: [{ name: '下单', description: '从请求到落库', steps: ['解析', '校验', '落库'] }],
  techChoices: [{ name: 'SQLite', reason: '单机部署简单', alternatives: ['Postgres'] }],
  entryPoints: ['cmd/gateway/main.go'],
  generatedAt: updatedAt,
  source: 'llm',
}

function sources(overrides: Partial<CardSources> = {}): CardSources {
  return {
    project: {
      id: 'local-1',
      name: 'PulseGate',
      slug: 'pulsegate',
      rootPath: 'D:\\repo\\pulsegate',
      nodeCount: 104,
      indexedAt: updatedAt,
    },
    folderRel: 'Fieldguide/pulsegate',
    mirrorNotes: true,
    updatedAt,
    architecture: null,
    layers: [],
    tour: [],
    nodes: [
      { id: 'fn:api:handle', label: 'handle', type: 'function', filePath: 'internal/api/handler.go', summary: 'HTTP 入口' },
      { id: 'fn:bill:charge', label: 'charge', type: 'function', filePath: 'internal/billing/charge.go', summary: '计费' },
    ],
    fanIn: [],
    knowledge: [],
    questions: [],
    notes: [],
    bridges: [],
    paths: [],
    progress: [],
    graphStats: { nodeCount: 104, edgeCount: 156 },
    reportMarkdown: '',
    ...overrides,
  }
}

describe('buildProjectNotes — structure', () => {
  it('always produces an index note, even with no analysis at all', () => {
    const docs = buildProjectNotes(sources())
    const index = docs.find((doc) => doc.kind === 'index')
    expect(index).toBeDefined()
    expect(index!.notePath).toBe('Fieldguide/pulsegate/PulseGate · 项目索引.md')
    expect(index!.body).toContain('代码拆解索引')
    // With no data the index must say so rather than list empty sections.
    expect(index!.body).not.toContain('## 1. 架构总览')
  })

  it('keeps every generated note inside the project folder', () => {
    const docs = buildProjectNotes(sources({ architecture, layers: [{ id: 'layer:api', name: 'API', description: '', nodeIds: ['fn:api:handle'] }] }))
    for (const doc of docs) {
      expect(doc.notePath.startsWith('Fieldguide/pulsegate/')).toBe(true)
      expect(doc.notePath.endsWith('.md')).toBe(true)
    }
  })

  it('routes kinds to their subfolders', () => {
    const docs = buildProjectNotes(sources({
      architecture,
      layers: [{ id: 'layer:api', name: 'API', description: '', nodeIds: ['fn:api:handle'] }],
      knowledge: [{ id: 'kn-1', projectId: 'local-1', concept: 'JWT', principle: 'p', tradeoffs: 't', examples: 'e', relatedNodeIds: ['fn:api:handle'], createdAt: updatedAt }],
      notes: [{ id: 'n-1', project_id: 'local-1', node_id: 'fn:api:handle', file_path: 'internal/api/handler.go', line_start: 12, line_end: null, body: '这里先校验再限流', tags: 'auth', created_at: updatedAt, updated_at: updatedAt }],
    }))
    const paths = Object.fromEntries(docs.map((doc) => [doc.kind, doc.notePath]))
    expect(paths.architecture).toContain('/cards/架构总览.md')
    expect(paths.layer).toContain('/cards/分层-API.md')
    expect(paths.knowledge).toContain('/cards/知识-JWT.md')
    expect(paths.note).toContain('/notes/')
  })

  it('does not emit a module card that duplicates a layer', () => {
    const docs = buildProjectNotes(sources({
      architecture,
      layers: [{ id: 'layer:api', name: 'API', description: '', nodeIds: [] }],
    }))
    const names = docs.map((doc) => doc.title)
    expect(names).toContain('分层 · API')
    expect(names).not.toContain('模块 · API')
    // A module that is not a layer still gets one.
    expect(names).toContain('模块 · 结算')
  })
})

describe('buildProjectNotes — content', () => {
  it('writes node ids into the frontmatter material and the body', () => {
    const docs = buildProjectNotes(sources({
      knowledge: [{ id: 'kn-1', projectId: 'local-1', concept: 'JWT 校验', principle: '签名校验', tradeoffs: '无状态换撤销难', examples: 'middleware', relatedNodeIds: ['fn:api:handle'], createdAt: updatedAt }],
    }))
    const card = docs.find((doc) => doc.kind === 'knowledge')!
    expect(card.nodeIds).toEqual(['fn:api:handle'])
    expect(card.body).toContain('internal/api/handler.go')
    expect(card.body).toContain('无状态换撤销难')
    expect(card.body).toContain('项目索引')
  })

  it('links cards back to the index so the MOC is reachable from any card', () => {
    const docs = buildProjectNotes(sources({ architecture }))
    const arch = docs.find((doc) => doc.kind === 'architecture')!
    expect(arch.body).toContain('[[PulseGate · 项目索引|项目索引]]')
  })

  it('lists every produced card in the index, grouped by reading order', () => {
    const docs = buildProjectNotes(sources({
      architecture,
      knowledge: [{ id: 'kn-1', projectId: 'local-1', concept: 'JWT', principle: 'p', tradeoffs: 't', examples: 'e', relatedNodeIds: [], createdAt: updatedAt }],
      tour: [{ order: 1, title: '从 main 开始', description: '入口', nodeIds: ['fn:api:handle'] }],
      questions: [{ id: 'q-1', projectId: 'local-1', problem: '如何限流', context: 'c', answer: 'a', relatedConcepts: [], knowledgeIds: [], relatedNodeIds: [], createdAt: updatedAt }],
    }))
    const index = docs.find((doc) => doc.kind === 'index')!
    expect(index.body).toContain('## 1. 架构总览')
    expect(index.body).toContain('## 4. 引导 Tour')
    expect(index.body).toContain('[[JWT]]')
    expect(index.body).toContain('[[Tour 1 · 从 main 开始]]')
    expect(index.body).toContain('[[面试 1 · 如何限流]]')
    // Sections with no content are omitted, not left empty.
    expect(index.body).not.toContain('## 7. 论文 ↔ 实现桥接')
  })

  it('reports progress marks on the cards whose nodes were studied', () => {
    const docs = buildProjectNotes(sources({
      knowledge: [{ id: 'kn-1', projectId: 'local-1', concept: 'JWT', principle: 'p', tradeoffs: 't', examples: 'e', relatedNodeIds: ['fn:api:handle'], createdAt: updatedAt }],
      progress: [{ project_id: 'local-1', node_id: 'fn:api:handle', status: 'mastered', confidence: 3, review_count: 1, last_seen_at: null, updated_at: updatedAt }],
    }))
    expect(docs.find((doc) => doc.kind === 'knowledge')!.body).toContain('已掌握')
    expect(docs.find((doc) => doc.kind === 'index')!.body).toContain('掌握 1')
  })

  it('mirrors code notes only when asked, and marks them as the reader\'s', () => {
    const note = { id: 'n-1', project_id: 'local-1', node_id: 'fn:api:handle', file_path: 'a/b.go', line_start: 3, line_end: null, body: '我的观察', tags: '', created_at: updatedAt, updated_at: updatedAt }
    const withNotes = buildProjectNotes(sources({ notes: [note], mirrorNotes: true }))
    expect(withNotes.some((doc) => doc.kind === 'note')).toBe(true)
    expect(withNotes.find((doc) => doc.kind === 'note')!.body).toContain('我的观察')

    const withoutNotes = buildProjectNotes(sources({ notes: [note], mirrorNotes: false }))
    expect(withoutNotes.some((doc) => doc.kind === 'note')).toBe(false)
  })

  it('includes the aggregate report when one was generated', () => {
    const docs = buildProjectNotes(sources({ reportMarkdown: '# 学习报告\n\n内容' }))
    const report = docs.find((doc) => doc.kind === 'report')!
    expect(report.notePath).toBe('Fieldguide/pulsegate/pulsegate-学习报告.md')
    expect(docs.find((doc) => doc.kind === 'index')!.body).toContain('完整学习报告')
  })

  it('de-duplicates colliding titles instead of overwriting a card', () => {
    const docs = buildProjectNotes(sources({
      knowledge: [
        { id: 'kn-1', projectId: 'p', concept: '缓存', principle: 'a', tradeoffs: '', examples: '', relatedNodeIds: [], createdAt: updatedAt },
        { id: 'kn-2', projectId: 'p', concept: '缓存', principle: 'b', tradeoffs: '', examples: '', relatedNodeIds: [], createdAt: updatedAt },
      ],
    }))
    const paths = docs.filter((doc) => doc.kind === 'knowledge').map((doc) => doc.notePath)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('never emits an empty body (an empty managed block reads as a broken card)', () => {
    const docs = buildProjectNotes(sources({
      architecture,
      layers: [{ id: 'layer:api', name: 'API', description: '', nodeIds: [] }],
      tour: [{ order: 1, title: '步骤', description: '', nodeIds: [] }],
    }))
    for (const doc of docs) {
      expect(doc.body.trim().length).toBeGreaterThan(0)
      // No body may contain the marker itself: the writer adds the markers, and a
      // literal copy inside the block would make the boundary ambiguous.
      expect(doc.body.includes(MANAGED_BEGIN)).toBe(false)
      expect(doc.body.includes('%% fieldguide:')).toBe(false)
    }
  })

  it('keeps card count bounded for a big project', () => {
    const many = buildProjectNotes(sources({
      layers: Array.from({ length: 40 }, (_, i) => ({ id: `l${i}`, name: `层${i}`, description: '', nodeIds: [] })),
      tour: Array.from({ length: 40 }, (_, i) => ({ order: i + 1, title: `步骤${i}`, description: '', nodeIds: [] })),
      questions: Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, projectId: 'p', problem: `问题${i}`, context: '', answer: 'a', relatedConcepts: [], knowledgeIds: [], relatedNodeIds: [], createdAt: updatedAt })),
    }))
    // Caps exist so a huge repo cannot produce thousands of files in one sync.
    expect(many.filter((doc) => doc.kind === 'layer').length).toBeLessThanOrEqual(20)
    expect(many.filter((doc) => doc.kind === 'tour').length).toBeLessThanOrEqual(12)
    expect(many.filter((doc) => doc.kind === 'interview').length).toBeLessThanOrEqual(15)
  })
})
