import { describe, it, expect } from 'vitest'
import { normalizeIgnoreFilter, createBasicGitignoreFilter } from '../project-ignore'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('normalizeIgnoreFilter', () => {
  it('wraps UA-style isIgnored()', () => {
    const filter = normalizeIgnoreFilter({
      isIgnored: (p: string) => p.startsWith('vendor/'),
    })
    expect(filter.ignores('vendor/x.go')).toBe(true)
    expect(filter.ignores('cmd/main.go')).toBe(false)
  })

  it('passes through ignores()', () => {
    const filter = normalizeIgnoreFilter({
      ignores: (p: string) => p === 'skip.txt',
    })
    expect(filter.ignores('skip.txt')).toBe(true)
    expect(filter.ignores('keep.txt')).toBe(false)
  })

  it('handles null/undefined', () => {
    expect(normalizeIgnoreFilter(null).ignores('anything')).toBe(false)
    expect(normalizeIgnoreFilter(undefined).ignores('anything')).toBe(false)
  })

  it('basic gitignore filter still works', () => {
    const root = join(tmpdir(), `fg-ignore-${Date.now()}`)
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, '.gitignore'), 'vendor/\n')
    const filter = createBasicGitignoreFilter(root)
    expect(filter.ignores('vendor/lib.go')).toBe(true)
    expect(filter.ignores('cmd/main.go')).toBe(false)
    rmSync(root, { recursive: true, force: true })
  })
})
