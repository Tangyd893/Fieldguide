import { describe, it, expect } from 'vitest'
import {
  classifyVaultPath,
  compareVersions,
  interpretProbe,
  isInsidePath,
  parseVaultList,
  parseVersion,
  pathsOverlap,
  samePath,
  type CliRunResult,
} from '../parse'

function run(partial: Partial<CliRunResult>): CliRunResult {
  return { ok: true, code: 0, stdout: '', stderr: '', timedOut: false, ...partial }
}

describe('parseVersion', () => {
  it('pulls the version out of `obsidian version` output', () => {
    expect(parseVersion('1.12.7\n')).toBe('1.12.7')
    expect(parseVersion('Obsidian version 1.12.7 (installer 1.12.7)')).toBe('1.12.7')
    expect(parseVersion('no version here')).toBe('')
  })

  it('compares dotted versions with missing segments as zero', () => {
    expect(compareVersions('1.12.7', '1.12.7')).toBe(0)
    expect(compareVersions('1.13', '1.12.7')).toBe(1)
    expect(compareVersions('1.11.9', '1.12.7')).toBe(-1)
  })
})

describe('interpretProbe', () => {
  it('accepts a CLI that answers', () => {
    const result = interpretProbe(run({ stdout: '1.12.7' }))
    expect(result.state).toBe('ok')
    expect(result.version).toBe('1.12.7')
  })

  it('keeps a working but older CLI usable, as a warning only', () => {
    // Gating on the version would lock out setups that demonstrably work.
    const result = interpretProbe(run({ stdout: '1.10.0' }))
    expect(result.state).toBe('ok')
    expect(result.detail).toContain('older than 1.12.7')
  })

  it('recognises the real "Obsidian is not running" message', () => {
    // Captured verbatim from Obsidian 1.12.7 on Windows.
    const result = interpretProbe(run({
      ok: false,
      code: 1,
      stderr: 'The CLI is unable to find Obsidian. Please make sure Obsidian is running and try again.',
    }))
    expect(result.state).toBe('app-not-running')
  })

  it('reports a missing executable as cli-missing', () => {
    const result = interpretProbe(run({ ok: false, code: null, error: 'spawn ENOENT' }))
    expect(result.state).toBe('cli-missing')
  })

  it('reports a timeout as an error, not as a missing CLI', () => {
    const result = interpretProbe(run({ ok: false, code: null, timedOut: true }))
    expect(result.state).toBe('error')
    expect(result.detail).toContain('timed out')
  })

  it('flags an installer-version complaint', () => {
    const result = interpretProbe(run({
      ok: false,
      code: 1,
      stderr: 'This command requires Obsidian 1.12 installer. Please update Obsidian.',
    }))
    expect(result.state).toBe('unsupported-version')
  })
})

describe('parseVaultList', () => {
  it('parses a JSON array of paths', () => {
    const vaults = parseVaultList('["D:\\\\workspace\\\\MyMind","D:\\\\workspace\\\\llm-wiki-vault"]')
    expect(vaults.map((v) => v.path)).toEqual(['D:\\workspace\\MyMind', 'D:\\workspace\\llm-wiki-vault'])
    expect(vaults[0].name).toBe('MyMind')
  })

  it('parses a JSON array of objects with names', () => {
    const vaults = parseVaultList('[{"name":"Notes","path":"D:\\\\vaults\\\\Notes"},{"id":"abc","path":"/home/me/Second"}]')
    expect(vaults).toEqual([
      { name: 'Notes', path: 'D:\\vaults\\Notes' },
      { name: 'abc', path: '/home/me/Second' },
    ])
  })

  it('parses a wrapper object', () => {
    const vaults = parseVaultList('{"vaults":[{"name":"A","path":"D:\\\\A"}]}')
    expect(vaults).toEqual([{ name: 'A', path: 'D:\\A' }])
  })

  it('parses plain-text lines with a tab separated name', () => {
    const vaults = parseVaultList('MyMind\tD:\\workspace\\MyMind\nllm-wiki\tD:\\workspace\\llm-wiki-vault\n')
    expect(vaults).toEqual([
      { name: 'MyMind', path: 'D:\\workspace\\MyMind' },
      { name: 'llm-wiki', path: 'D:\\workspace\\llm-wiki-vault' },
    ])
  })

  it('keeps the whole path when it contains spaces', () => {
    const vaults = parseVaultList('Personal  C:\\Users\\me\\My Vault')
    expect(vaults).toEqual([{ name: 'Personal', path: 'C:\\Users\\me\\My Vault' }])
  })

  it('deduplicates by path (nested vaults share nothing else)', () => {
    const vaults = parseVaultList('["D:\\\\A","d:\\\\a","D:\\\\A\\\\inner"]')
    expect(vaults.map((v) => v.path)).toEqual(['D:\\A', 'D:\\A\\inner'])
  })

  it('returns nothing for unparseable output instead of throwing', () => {
    expect(parseVaultList('')).toEqual([])
    expect(parseVaultList('not json at all\nneither is this')).toEqual([])
  })
})

describe('parseVaultList — output captured from real Obsidian 1.12.7', () => {
  // Captured on 2026-09-20 with the CLI enabled; kept verbatim so a future CLI
  // change breaks a test instead of silently mis-parsing vault names.
  const VAULTS_VERBOSE = [
    '面试\tD:\\workspace\\MyMind\\面试',
    'MyMind\tD:\\workspace\\MyMind',
    'llm-wiki-vault\tD:\\workspace\\llm-wiki-vault',
    '',
  ].join('\n')

  it('parses the tab-separated verbose form, including CJK vault names', () => {
    expect(parseVaultList(VAULTS_VERBOSE)).toEqual([
      { name: '面试', path: 'D:\\workspace\\MyMind\\面试' },
      { name: 'MyMind', path: 'D:\\workspace\\MyMind' },
      { name: 'llm-wiki-vault', path: 'D:\\workspace\\llm-wiki-vault' },
    ])
  })

  it('ignores the name-only non-verbose form instead of inventing paths', () => {
    // `obsidian vaults` (without `verbose`) lists names only — no usable path, so
    // the caller must not treat it as an empty-but-valid registry.
    expect(parseVaultList('面试\nMyMind\nllm-wiki-vault\n')).toEqual([])
  })

  it('reads the version line the CLI actually prints', () => {
    expect(parseVersion('1.12.7 (installer 1.12.7)')).toBe('1.12.7')
  })

  it('notes that `format=json` is ignored for `vaults` (same text output)', () => {
    // Verified against the real CLI: passing format=json changes nothing, so the
    // JSON retry in listVaults() is a harmless no-op rather than a second shape.
    expect(parseVaultList(VAULTS_VERBOSE)).toHaveLength(3)
  })
})

describe('path containment', () => {
  it('treats a path as inside itself', () => {
    expect(isInsidePath('D:\\Vault', 'D:\\Vault')).toBe(true)
    expect(isInsidePath('D:\\Vault', 'D:\\Vault\\a\\b.md')).toBe(true)
  })

  it('rejects siblings and parents', () => {
    expect(isInsidePath('D:\\Vault', 'D:\\VaultOther')).toBe(false)
    expect(isInsidePath('D:\\Vault\\sub', 'D:\\Vault')).toBe(false)
  })

  it('is case-insensitive on Windows', () => {
    expect(isInsidePath('D:\\Vault', 'd:\\vault\\note.md', true)).toBe(true)
    // Node's own win32 `relative` already compares case-insensitively, so the
    // explicit normalisation is a safety net rather than the only guard.
    expect(isInsidePath('D:\\Vault', 'D:\\Vault\\note.md', false)).toBe(true)
  })

  it('still compares the path structure when asked to', () => {
    expect(isInsidePath('/home/me/Vault', '/home/me/other/note.md', false)).toBe(false)
  })

  it('does not treat a different drive as contained', () => {
    expect(isInsidePath('D:\\Vault', 'C:\\Vault')).toBe(false)
  })

  it('samePath ignores trailing separators', () => {
    expect(samePath('D:\\Vault\\', 'D:\\Vault', true)).toBe(true)
  })

  it('pathsOverlap catches both nesting directions', () => {
    expect(pathsOverlap('D:\\proj', 'D:\\proj\\vault')).toBe(true)
    expect(pathsOverlap('D:\\proj\\vault', 'D:\\proj')).toBe(true)
    expect(pathsOverlap('D:\\proj', 'D:\\vault')).toBe(false)
  })
})

describe('classifyVaultPath', () => {
  const vaults = [
    { name: 'MyMind', path: 'D:\\workspace\\MyMind' },
    { name: 'Inner', path: 'D:\\workspace\\MyMind\\面试' },
  ]

  it('matches a registered vault regardless of case or separator style', () => {
    expect(classifyVaultPath(vaults, 'd:\\workspace\\mymind', true).kind).toBe('registered')
  })

  it('reports a nested folder with its parent rather than rejecting it', () => {
    // A vault opened inside another vault is legitimate (and exists on real machines).
    const binding = classifyVaultPath(vaults, 'D:\\workspace\\MyMind\\notes')
    expect(binding.kind).toBe('nested')
    expect(binding.parentVault?.name).toBe('MyMind')
  })

  it('prefers the most specific enclosing vault', () => {
    const binding = classifyVaultPath(vaults, 'D:\\workspace\\MyMind\\面试\\deeper')
    expect(binding.parentVault?.name).toBe('Inner')
  })

  it('marks an unrelated directory as unregistered', () => {
    const binding = classifyVaultPath(vaults, 'E:\\somewhere')
    expect(binding.kind).toBe('unregistered')
    expect(binding.name).toBe('somewhere')
  })
})
