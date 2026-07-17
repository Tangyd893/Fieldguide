import { describe, it, expect } from 'vitest'
import {
  detectCoachIntent,
  toSearchableNodes,
  flattenTourSteps,
  coachPolicyHints,
} from '../context-packer'
import type { KnowledgeGraph, GraphNode } from '../../ua/graph-reader'
import { extractNodeRefsFromObservation, toolCallKey } from '../tools'

describe('detectCoachIntent', () => {
  it('detects overview questions', () => {
    expect(detectCoachIntent('为我介绍这个项目及其入口')).toBe('overview')
    expect(detectCoachIntent('What is the entry point?')).toBe('overview')
    expect(detectCoachIntent('项目架构分层')).toBe('overview')
  })

  it('detects paper questions', () => {
    expect(detectCoachIntent('这篇论文的 chunk 策略在代码里如何对应')).toBe('paper')
    expect(detectCoachIntent('query paper RAG concepts')).toBe('paper')
  })

  it('detects code questions', () => {
    expect(detectCoachIntent('认证怎么实现的')).toBe('code')
    expect(detectCoachIntent('How does billing work?')).toBe('code')
  })
})

describe('toSearchableNodes / flattenTourSteps', () => {
  const sampleGraph: KnowledgeGraph = {
    project: {
      projectName: 'demo',
    },
    nodes: [
      {
        id: 'file:cmd/main.go',
        type: 'file',
        label: 'main.go',
        name: 'main.go',
        filePath: 'cmd/main.go',
        metadata: { summary: 'Entry point', tags: ['entrypoint'] },
      },
      {
        id: 'function:cmd/main.go:main',
        type: 'function',
        label: 'main',
        name: 'main',
        filePath: 'cmd/main.go',
        metadata: { summary: 'starts server' },
      },
    ],
    edges: [
      { source: 'file:cmd/main.go', target: 'function:cmd/main.go:main', type: 'contains' },
    ],
    layers: [
      { id: 'layer:entry', name: 'Entry', description: 'Startup', nodeIds: ['file:cmd/main.go'] },
    ],
    tour: [
      {
        order: 1,
        title: 'Start at main',
        description: 'Begin here',
        nodeIds: ['file:cmd/main.go'],
      },
    ],
  }

  it('maps metadata.summary into SearchEngine fields', () => {
    const searchable = toSearchableNodes(sampleGraph.nodes)
    expect(searchable[0].summary).toBe('Entry point')
    expect(searchable[0].tags).toContain('entrypoint')
    expect(searchable[0].name).toBe('main.go')
  })

  it('flattens flat tour step arrays', () => {
    const steps = flattenTourSteps(sampleGraph)
    expect(steps).toHaveLength(1)
    expect(steps[0].title).toBe('Start at main')
  })

  it('flattens wrapped tour objects', () => {
    const wrapped: KnowledgeGraph = {
      ...sampleGraph,
      tour: [{ name: 'Guided', steps: sampleGraph.tour as never }],
    }
    expect(flattenTourSteps(wrapped)[0].title).toBe('Start at main')
  })
})

describe('coachPolicyHints', () => {
  it('mentions overview direct-answer policy', () => {
    expect(coachPolicyHints('overview')).toMatch(/overview|entry/i)
  })
})

describe('tool helpers', () => {
  it('extractNodeRefsFromObservation parses search_nodes results', () => {
    const obs = JSON.stringify([
      { id: 'fn:main', label: 'main' },
      { id: 'cmd/main.go', label: 'main.go' },
    ])
    expect(extractNodeRefsFromObservation(obs)).toEqual(['fn:main', 'cmd/main.go'])
  })

  it('extractNodeRefsFromObservation parses get_node_source result', () => {
    const obs = JSON.stringify({ nodeId: 'fn:handleRequest', content: 'func...' })
    expect(extractNodeRefsFromObservation(obs)).toEqual(['fn:handleRequest'])
  })

  it('extractNodeRefsFromObservation handles invalid JSON', () => {
    expect(extractNodeRefsFromObservation('not json')).toEqual([])
  })

  it('toolCallKey is stable for same args', () => {
    expect(toolCallKey('get_node_source', { node_id: 'a' }))
      .toBe(toolCallKey('get_node_source', { node_id: 'a' }))
    expect(toolCallKey('search_nodes', { query: 'main', limit: 8 }))
      .not.toBe(toolCallKey('search_nodes', { query: 'auth', limit: 8 }))
  })
})

describe('synthesize path via pack (integration-ish)', () => {
  it('empty description still yields identity text with layers', async () => {
    // Lightweight check without full packCoachContext DB deps:
    // ensure searchable nodes work with empty top-level summary
    const nodes: GraphNode[] = [{
      id: 'file:README.md',
      type: 'document',
      name: 'README.md',
      filePath: 'README.md',
      summary: '',
      metadata: { summary: 'Project readme' },
    }]
    const s = toSearchableNodes(nodes)
    expect(s[0].summary).toBe('Project readme')
  })
})
