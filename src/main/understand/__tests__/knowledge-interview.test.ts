import { describe, it, expect } from 'vitest'
import { buildHeuristicKnowledge } from '../knowledge'
import { buildHeuristicQuestions } from '../interview'
import { buildHeuristicArchitecture } from '../architecture'

describe('knowledge + interview heuristics', () => {
  const graph = {
    meta: { language: 'TypeScript' },
    nodes: [
      { id: 'a', type: 'file', label: 'redis.ts', filePath: 'src/cache/redis.ts', metadata: { tags: ['redis'] } },
    ],
    layers: [{ name: 'Data', description: 'cache' }],
  }

  it('builds knowledge cards from architecture stack', () => {
    const arch = buildHeuristicArchitecture('p1', graph)
    const nodes = buildHeuristicKnowledge('p1', arch, graph)
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes[0].concept).toBeTruthy()
    expect(nodes.some(n => n.relatedNodeIds.includes('a') || n.concept.toLowerCase().includes('redis') || n.concept.includes('TypeScript'))).toBe(true)
  })

  it('builds interview questions from architecture + knowledge', () => {
    const arch = buildHeuristicArchitecture('p1', graph)
    const knowledge = buildHeuristicKnowledge('p1', arch, graph).map((n, i) => ({
      ...n,
      id: `kn-${i}`,
      createdAt: new Date().toISOString(),
    }))
    const qs = buildHeuristicQuestions('p1', arch, knowledge)
    expect(qs.length).toBeGreaterThan(0)
    expect(qs[0].problem.length).toBeGreaterThan(5)
  })
})
