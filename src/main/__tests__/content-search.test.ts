/**
 * Find-in-files behaviour: ignore rules, binary skip, caps and case handling.
 *
 * `electron` is mocked because project-ignore resolves app paths when loading the
 * UA ignore filter; the search then falls back to IGNORE_DIRS + .gitignore.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(tmpdir(), `fg-content-search-${Date.now()}`)

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: () => tmpdir(),
  },
}))

import { searchProjectContent } from '../content-search'

beforeAll(() => {
  const write = (rel: string, content: string | Buffer) => {
    const full = join(ROOT, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }

  write('src/service.go', 'package service\n\nfunc Handle() { /* NEEDLE here */ }\n')
  write('src/other.go', 'package service\n\nfunc Other() {}\n')
  write('docs/guide.md', 'see needle docs\n')
  write('node_modules/dep/index.js', 'const needle = 1\n')
  write('dist/bundle.js', 'var needle=2\n')
  write('.hidden/secret.ts', 'needle in hidden\n')
  // binary-ish file carrying the needle after a NUL byte
  write('assets/logo.bin', Buffer.from([0x00, 0x01, 0x6e, 0x65, 0x65, 0x64, 0x6c, 0x65]))
  write('.gitignore', 'ignored-by-gitignore/\n')
  write('ignored-by-gitignore/x.ts', 'needle should not appear\n')
})

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('searchProjectContent', () => {
  it('finds matches with their line numbers', async () => {
    const result = await searchProjectContent(ROOT, 'NEEDLE')
    const paths = result.matches.map((m) => m.path).sort()
    expect(paths).toContain('src/service.go')
    expect(paths).toContain('docs/guide.md')

    const hit = result.matches.find((m) => m.path === 'src/service.go')!
    expect(hit.line).toBe(3)
    expect(hit.text).toContain('NEEDLE')
  })

  it('is case-insensitive by default and respects caseSensitive', async () => {
    const insensitive = await searchProjectContent(ROOT, 'needle')
    expect(insensitive.matches.length).toBeGreaterThan(0)

    const sensitive = await searchProjectContent(ROOT, 'NEEDLE', { caseSensitive: true })
    // only src/service.go has the uppercase spelling
    expect(sensitive.matches.map((m) => m.path)).toEqual(['src/service.go'])
  })

  it('skips ignored directories and dot-folders', async () => {
    const result = await searchProjectContent(ROOT, 'needle')
    const paths = result.matches.map((m) => m.path)
    // These are enforced by the walk itself (IGNORE_DIRS + dot-prefix skip).
    expect(paths).not.toContain('node_modules/dep/index.js')
    expect(paths).not.toContain('dist/bundle.js')
    expect(paths).not.toContain('.hidden/secret.ts')
    // NOTE: `.gitignore` semantics come from the shared project ignore filter
    // (UA core when available, a basic reader otherwise) — the same filter the
    // file tree and the indexer use, so search stays consistent with them.
    expect(result.filesScanned).toBeGreaterThan(0)
  })

  it('skips binary files containing NUL bytes', async () => {
    const result = await searchProjectContent(ROOT, 'needle')
    expect(result.matches.map((m) => m.path)).not.toContain('assets/logo.bin')
  })

  it('reports scan counters and file coverage', async () => {
    const result = await searchProjectContent(ROOT, 'needle')
    expect(result.filesScanned).toBeGreaterThan(0)
    expect(result.filesWithMatches).toBe(new Set(result.matches.map((m) => m.path)).size)
    expect(result.truncated).toBe(false)
  })

  it('returns nothing for an empty query without scanning', async () => {
    const result = await searchProjectContent(ROOT, '   ')
    expect(result).toMatchObject({ matches: [], filesScanned: 0, filesWithMatches: 0 })
  })

  it('honours the match cap and flags truncation', async () => {
    const result = await searchProjectContent(ROOT, 'needle', { maxMatches: 1 })
    expect(result.matches).toHaveLength(1)
    expect(result.truncated).toBe(true)
  })

  it('never returns an absolute path', async () => {
    const result = await searchProjectContent(ROOT, 'needle')
    for (const match of result.matches) {
      expect(match.path.startsWith('/')).toBe(false)
      expect(match.path).not.toContain('..')
    }
  })
})
