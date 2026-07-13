import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, it, expect, afterEach } from 'vitest'
import { readProjectTree } from '../file-tree'
import { createBasicGitignoreFilter } from '../project-ignore'

const roots: string[] = []

function makeRoot(name: string): string {
  const dir = join(tmpdir(), `fg-filetree-${name}-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  roots.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of roots.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('readProjectTree', () => {
  it('lists nested .go files beyond depth 3', () => {
    const root = makeRoot('depth')
    mkdirSync(join(root, 'services', 'backend-api-auth', 'internal', 'auth'), { recursive: true })
    writeFileSync(join(root, 'services', 'backend-api-auth', 'main.go'), 'package main')
    writeFileSync(join(root, 'services', 'backend-api-auth', 'internal', 'auth', 'handler.go'), 'package auth')

    const tree = readProjectTree(root, { maxDepth: 8 })
    const paths = JSON.stringify(tree)
    expect(paths).toContain('backend-api-auth')
    expect(paths).toContain('handler.go')
  })

  it('respects gitignore via ignore filter', () => {
    const root = makeRoot('gitignore')
    mkdirSync(join(root, 'cmd'), { recursive: true })
    mkdirSync(join(root, 'vendor', 'lib'), { recursive: true })
    writeFileSync(join(root, 'cmd', 'main.go'), 'package main')
    writeFileSync(join(root, 'vendor', 'lib', 'dep.go'), 'package lib')
    writeFileSync(join(root, '.gitignore'), 'vendor/\n')

    const filter = createBasicGitignoreFilter(root)
    const tree = readProjectTree(root, { ignoreFilter: filter })
    const paths = JSON.stringify(tree)
    expect(paths).toContain('main.go')
    expect(paths).not.toContain('vendor')
  })

  it('skips vendor directory via IGNORE_DIRS', () => {
    const root = makeRoot('vendor')
    mkdirSync(join(root, 'vendor'), { recursive: true })
    writeFileSync(join(root, 'vendor', 'dep.go'), 'package vendor')

    const tree = readProjectTree(root)
    expect(JSON.stringify(tree)).not.toContain('dep.go')
  })
})
