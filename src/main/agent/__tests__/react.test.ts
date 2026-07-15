import { describe, it, expect } from 'vitest'
import { extractNodeRefsFromObservation } from '../tools'

describe('agent tools', () => {
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
})
