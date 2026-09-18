/**
 * Project-relative path resolution.
 *
 * These guards are the difference between "renderer reads project files" and
 * "renderer reads anything on disk", so the traversal cases are pinned here.
 * `electron` is mocked because paths.ts reads appData / config / project list
 * when computing the allowed open roots.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const APP_DATA = join(tmpdir(), `fg-paths-appdata-${Date.now()}`)
const PROJECT_ROOT = join(tmpdir(), `fg-paths-project-${Date.now()}`)

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: () => APP_DATA,
  },
}))

vi.mock('../config', () => ({
  loadConfig: () => ({ projectsRoot: APP_DATA }),
}))

vi.mock('../db', () => ({
  listProjects: () => [{ id: 'p1', root_path: PROJECT_ROOT }],
}))

import { isInside, resolveProjectPath, isAllowedOpenPath, allowedOpenRoots } from '../paths'

beforeEach(() => {
  mkdirSync(join(PROJECT_ROOT, 'src', 'nested'), { recursive: true })
  mkdirSync(join(APP_DATA, 'Fieldguide'), { recursive: true })
  writeFileSync(join(PROJECT_ROOT, 'src', 'main.go'), 'package main', 'utf-8')
  writeFileSync(join(APP_DATA, 'Fieldguide', 'export.json'), '{}', 'utf-8')
})

describe('isInside', () => {
  it('accepts the root itself and paths below it', () => {
    expect(isInside('/a/b', '/a/b')).toBe(true)
    expect(isInside('/a/b', '/a/b/c/d')).toBe(true)
  })

  it('rejects siblings and parents', () => {
    expect(isInside('/a/b', '/a/c')).toBe(false)
    expect(isInside('/a/b', '/a')).toBe(false)
    // a prefix that is not a path boundary
    expect(isInside('/a/bar', '/a/barbaz')).toBe(false)
  })
})

describe('resolveProjectPath', () => {
  it('resolves a normal relative path', () => {
    const r = resolveProjectPath(PROJECT_ROOT, 'src/main.go')
    expect(r.ok).toBe(true)
    expect(r.fullPath).toBe(join(PROJECT_ROOT, 'src', 'main.go'))
  })

  it('normalizes redundant separators', () => {
    const r = resolveProjectPath(PROJECT_ROOT, './src/./nested/../main.go')
    expect(r.ok).toBe(true)
    expect(r.fullPath).toBe(join(PROJECT_ROOT, 'src', 'main.go'))
  })

  it('rejects parent traversal', () => {
    for (const attempt of ['../secret', '../../etc/passwd', 'src/../../outside', '..\\..\\windows']) {
      const r = resolveProjectPath(PROJECT_ROOT, attempt)
      expect(r.ok, attempt).toBe(false)
      expect(r.reason).toMatch(/escape/)
    }
  })

  it('rejects absolute paths and NUL bytes', () => {
    expect(resolveProjectPath(PROJECT_ROOT, 'C:\\Windows\\System32\\drivers\\etc\\hosts').ok).toBe(false)
    expect(resolveProjectPath(PROJECT_ROOT, '/etc/passwd').ok).toBe(false)
    expect(resolveProjectPath(PROJECT_ROOT, 'src/main\0.go').ok).toBe(false)
  })

  it('rejects empty input', () => {
    expect(resolveProjectPath(PROJECT_ROOT, '').ok).toBe(false)
  })
})

describe('isAllowedOpenPath', () => {
  it('allows files under the app data dir and under a registered project', () => {
    expect(allowedOpenRoots().length).toBeGreaterThan(0)
    expect(isAllowedOpenPath(join(APP_DATA, 'Fieldguide', 'export.json'))).toBe(true)
    expect(isAllowedOpenPath(join(PROJECT_ROOT, 'src', 'main.go'))).toBe(true)
  })

  it('refuses paths outside those roots', () => {
    expect(isAllowedOpenPath(join(tmpdir(), 'some-random-file.txt'))).toBe(false)
    expect(isAllowedOpenPath('C:\\Windows\\System32\\cmd.exe')).toBe(false)
  })

  it('refuses relative paths and non-existent files', () => {
    expect(isAllowedOpenPath('src/main.go')).toBe(false)
    expect(isAllowedOpenPath(join(PROJECT_ROOT, 'does-not-exist.go'))).toBe(false)
  })
})

describe('cleanup', () => {
  it('removes fixtures', () => {
    rmSync(PROJECT_ROOT, { recursive: true, force: true })
    rmSync(APP_DATA, { recursive: true, force: true })
    expect(true).toBe(true)
  })
})
