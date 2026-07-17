import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  readProjectSourceFile,
  projectRootFromGraphFile,
  detectSourceLanguage,
} from '../file-content'

describe('file-content', () => {
  let root: string
  let graphFile: string

  beforeEach(() => {
    root = join(tmpdir(), `fg-src-${Date.now()}`)
    mkdirSync(join(root, '.understand-anything'), { recursive: true })
    writeFileSync(join(root, 'README.md'), '# Hello\n\nDemo project.\n', 'utf-8')
    writeFileSync(join(root, 'main.go'), 'package main\n', 'utf-8')
    graphFile = join(root, '.understand-anything', 'knowledge-graph.json')
    writeFileSync(
      graphFile,
      JSON.stringify({
        nodes: [
          { id: 'file:README.md', filePath: 'README.md' },
          { id: 'file:main.go', filePath: 'main.go' },
        ],
      }),
      'utf-8',
    )
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('detects language from extension', () => {
    expect(detectSourceLanguage('README.md')).toBe('markdown')
    expect(detectSourceLanguage('cmd/main.go')).toBe('go')
  })

  it('projectRootFromGraphFile walks up from knowledge-graph.json', () => {
    expect(projectRootFromGraphFile(graphFile)).toBe(root)
  })

  it('reads README.md as JSON payload for Dashboard CodeViewer', () => {
    const result = readProjectSourceFile('README.md', root, graphFile)
    expect(result.statusCode).toBe(200)
    expect(result.payload).toMatchObject({
      path: 'README.md',
      language: 'markdown',
    })
    expect('content' in result.payload && result.payload.content).toContain('# Hello')
  })

  it('rejects path traversal', () => {
    const result = readProjectSourceFile('../outside.txt', root, graphFile)
    expect(result.statusCode).toBe(400)
    expect(result.payload).toEqual({ error: expect.stringMatching(/inside the project/i) })
  })

  it('rejects files not in the graph', () => {
    writeFileSync(join(root, 'secret.txt'), 'nope', 'utf-8')
    const result = readProjectSourceFile('secret.txt', root, graphFile)
    expect(result.statusCode).toBe(404)
    expect(result.payload).toEqual({ error: 'File is not in the knowledge graph' })
  })
})
