import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifyBinding,
  createVaultDirectory,
  fallbackVaultName,
  projectFolderName,
  projectFolderPath,
  projectFolderRelative,
  validateVaultDirectory,
} from '../binding'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fg-obsidian-binding-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('validateVaultDirectory', () => {
  it('accepts an existing directory', () => {
    expect(validateVaultDirectory(dir)).toEqual({ ok: true })
  })

  it('rejects an empty value, a missing path and a file', () => {
    expect(validateVaultDirectory('').reason).toBe('empty')
    expect(validateVaultDirectory(join(dir, 'nope')).reason).toBe('missing')
    const file = join(dir, 'note.md')
    writeFileSync(file, '# hi')
    expect(validateVaultDirectory(file).reason).toBe('not-a-directory')
  })

  it('rejects a vault that contains, or lives inside, a project', () => {
    const project = join(dir, 'repo')
    mkdirSync(project, { recursive: true })
    // Vault inside the project: the indexer would walk the cards.
    expect(validateVaultDirectory(join(project, 'vault'), [project]).reason).toBe('missing')
    mkdirSync(join(project, 'vault'), { recursive: true })
    expect(validateVaultDirectory(join(project, 'vault'), [project]).reason).toBe('overlaps-project')
    // Project inside the vault: the cards would be indexed as source.
    expect(validateVaultDirectory(dir, [project]).reason).toBe('overlaps-project')
    // The project itself is never a vault.
    expect(validateVaultDirectory(project, [project]).reason).toBe('overlaps-project')
  })

  it('allows two unrelated sibling directories', () => {
    const project = join(dir, 'repo')
    const vault = join(dir, 'vault')
    mkdirSync(project, { recursive: true })
    mkdirSync(vault, { recursive: true })
    expect(validateVaultDirectory(vault, [project])).toEqual({ ok: true })
  })
})

describe('projectFolderName', () => {
  it('uses the slug when it is unique', () => {
    expect(projectFolderName('pulsegate', 'local-1', ['pulsegate'])).toBe('pulsegate')
  })

  it('disambiguates two projects that share a slug, deterministically', () => {
    // Same repo cloned twice → same slug; the folders must not collide.
    const first = projectFolderName('pulsegate', 'local-abcdef123', ['pulsegate', 'pulsegate'])
    const second = projectFolderName('pulsegate', 'local-xyz789456', ['pulsegate', 'pulsegate'])
    expect(first).toBe('pulsegate-def123')
    expect(second).toBe('pulsegate-789456')
    expect(first).not.toBe(second)
    // Stable across syncs: same inputs, same folder.
    expect(projectFolderName('pulsegate', 'local-abcdef123', ['pulsegate', 'pulsegate'])).toBe(first)
  })

  it('never produces a path separator or an empty name', () => {
    expect(projectFolderName('my/repo', 'id-1', ['my/repo'])).toBe('my-repo')
    expect(projectFolderName('', 'proj-42', [''])).toBe('proj-42')
  })
})

describe('folder paths', () => {
  it('joins the folder and project folder with a posix relative form for the CLI', () => {
    expect(projectFolderRelative('Fieldguide', 'pulsegate')).toBe('Fieldguide/pulsegate')
    expect(projectFolderRelative('A/B', 'p')).toBe('A/B/p')
    expect(projectFolderRelative('', 'p')).toBe('p')
  })

  it('builds the absolute path inside the vault', () => {
    expect(projectFolderPath(dir, 'Fieldguide', 'pulsegate')).toBe(join(dir, 'Fieldguide', 'pulsegate'))
    // An empty folder means "directly under the vault root".
    expect(projectFolderPath(dir, '', 'p')).toBe(join(dir, 'p'))
  })
})

describe('classifyBinding', () => {
  const vaults = [
    { name: 'MyMind', path: 'D:\\workspace\\MyMind' },
    { name: 'Notes', path: 'D:\\vaults\\Notes' },
  ]

  it('marks a known vault as registered', () => {
    expect(classifyBinding('D:\\vaults\\Notes', '', vaults).kind).toBe('registered')
    expect(classifyBinding('D:\\vaults\\Notes', '', vaults).name).toBe('Notes')
  })

  it('keeps the configured name when Obsidian has not answered', () => {
    const binding = classifyBinding('D:\\vaults\\Notes', 'My Notes', [])
    expect(binding.kind).toBe('unregistered')
    expect(binding.name).toBe('My Notes')
  })

  it('falls back to the directory name when no name is known', () => {
    expect(classifyBinding('D:\\vaults\\Notes', '', []).name).toBe('Notes')
  })
})

describe('fallbackVaultName', () => {
  it('names a vault after its directory', () => {
    expect(fallbackVaultName('D:\\vaults\\Notes')).toBe('Notes')
  })
})

describe('createVaultDirectory', () => {
  it('creates the folder plus an .obsidian marker so Obsidian sees a vault', () => {
    const result = createVaultDirectory(dir, 'MyVault')
    expect(result.created).toBe(true)
    expect(existsSync(join(dir, 'MyVault'))).toBe(true)
    expect(existsSync(join(dir, 'MyVault', '.obsidian'))).toBe(true)
  })

  it('is idempotent for an existing folder', () => {
    createVaultDirectory(dir, 'MyVault')
    expect(createVaultDirectory(dir, 'MyVault')).toEqual({ path: join(dir, 'MyVault'), created: false })
  })

  it('refuses names that would escape the parent directory', () => {
    expect(() => createVaultDirectory(dir, '..')).toThrow()
    expect(() => createVaultDirectory(dir, 'a/b')).toThrow()
    expect(() => createVaultDirectory(dir, 'a:b')).toThrow()
    expect(() => createVaultDirectory(dir, '')).toThrow()
    expect(() => createVaultDirectory('', 'MyVault')).toThrow()
  })
})
