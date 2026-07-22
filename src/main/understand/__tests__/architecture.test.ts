import { describe, it, expect } from 'vitest'
import { buildHeuristicArchitecture } from '../architecture'

describe('buildHeuristicArchitecture', () => {
  it('detects stack and modules from graph', () => {
    const summary = buildHeuristicArchitecture('p1', {
      meta: { language: 'Go', projectName: 'demo' },
      nodes: [
        { id: 'n1', type: 'file', label: 'main.go', filePath: 'cmd/server/main.go', layer: 'Entry' },
        { id: 'n2', type: 'file', label: 'service.go', filePath: 'internal/service/user.go', layer: 'Business' },
        { id: 'n3', type: 'file', label: 'go.mod', filePath: 'go.mod' },
      ],
      layers: [
        { id: 'l1', name: 'Entry', description: 'HTTP entry' },
        { id: 'l2', name: 'Business', description: 'Domain logic' },
      ],
      tour: [{ name: 'Request path', steps: [{ title: 'main' }, { title: 'service' }] }],
    })

    expect(summary.projectId).toBe('p1')
    expect(summary.source).toBe('heuristic')
    expect(summary.stack).toContain('Go')
    expect(summary.layers.map(l => l.name)).toContain('Entry')
    expect(summary.modules.length).toBeGreaterThan(0)
    expect(summary.keyFlows[0]?.name).toBe('Request path')
    expect(summary.entryPoints?.some(e => e.includes('main.go'))).toBe(true)
  })
})
