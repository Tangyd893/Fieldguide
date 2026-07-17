import { describe, expect, it } from 'vitest'
import { ensureGraphLayersSync, ensureLayersInGraphJson } from '../ensure-layers'

describe('ensureGraphLayersSync', () => {
  it('adds layers when missing (HIS-Go structure-only case)', () => {
    const graph = {
      nodes: [
        { id: 'file:backend/api/handler.go', type: 'file', filePath: 'backend/api/handler.go' },
        { id: 'file:internal/service/foo.go', type: 'file', filePath: 'internal/service/foo.go' },
        { id: 'file:pkg/util/x.go', type: 'file', filePath: 'pkg/util/x.go' },
        { id: 'function:x', type: 'function', filePath: 'pkg/util/x.go' },
      ],
      edges: [],
      layers: [] as unknown[],
    }
    const added = ensureGraphLayersSync(graph)
    expect(added).toBe(true)
    expect(graph.layers.length).toBeGreaterThan(0)
    const fileIds = new Set(graph.layers.flatMap((l) => l.nodeIds))
    expect(fileIds.has('file:backend/api/handler.go')).toBe(true)
    expect(fileIds.has('file:internal/service/foo.go')).toBe(true)
  })

  it('does not replace existing layers', () => {
    const graph = {
      nodes: [{ id: 'file:a.go', type: 'file', filePath: 'a.go' }],
      layers: [{ id: 'layer:x', name: 'X', nodeIds: ['file:a.go'] }],
    }
    expect(ensureGraphLayersSync(graph)).toBe(false)
    expect(graph.layers).toHaveLength(1)
  })

  it('ensureLayersInGraphJson returns parseable JSON with layers', () => {
    const raw = JSON.stringify({
      nodes: [{ id: 'file:routes/a.ts', type: 'file', filePath: 'routes/a.ts' }],
      edges: [],
      layers: [],
    })
    const out = JSON.parse(ensureLayersInGraphJson(raw))
    expect(out.layers.length).toBeGreaterThan(0)
  })
})
