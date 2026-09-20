import { describe, it, expect } from 'vitest'
import { buildSpawnSpec, needsCmdShell, param, quoteForCmd } from '../spawn-spec'

/**
 * The Windows CLI is `Obsidian.com`, but the fallback path exists for `.cmd`/`.bat`
 * shims. Getting that branch wrong is invisible until someone's machine has a shim,
 * so the argv shaping is asserted here rather than in an integration test.
 */
describe('buildSpawnSpec', () => {
  it('spawns the .com terminal redirector directly', () => {
    const spec = buildSpawnSpec('C:\\Obsidian\\Obsidian.com', ['version'])
    expect(spec.file).toBe('C:\\Obsidian\\Obsidian.com')
    expect(spec.args).toEqual(['version'])
    expect(spec.viaCmdShell).toBe(false)
  })

  it('spawns .exe directly', () => {
    const spec = buildSpawnSpec('C:\\Obsidian\\obsidian.exe', ['vault', 'info=path'])
    expect(spec.viaCmdShell).toBe(false)
    expect(spec.args).toEqual(['vault', 'info=path'])
  })

  it('routes a .cmd shim through cmd.exe /d /s /c as one command string', () => {
    const spec = buildSpawnSpec('C:\\stub\\obsidian.cmd', ['version'], 'C:\\Windows\\System32\\cmd.exe')
    expect(spec.viaCmdShell).toBe(true)
    expect(spec.file).toBe('C:\\Windows\\System32\\cmd.exe')
    expect(spec.args[0]).toBe('/d')
    expect(spec.args[1]).toBe('/s')
    expect(spec.args[2]).toBe('/c')
    expect(spec.args[3]).toBe('C:\\stub\\obsidian.cmd version')
  })

  it('quotes cmd arguments that need it — including shell metacharacters', () => {
    const spec = buildSpawnSpec('C:\\stub\\obsidian.cmd', ['open', 'path=My Vault/a&b.md'])
    expect(spec.args[3]).toBe('C:\\stub\\obsidian.cmd open "path=My Vault/a&b.md"')
  })

  it('is case-insensitive about the extension', () => {
    expect(needsCmdShell('C:\\stub\\Obsidian.CMD')).toBe(true)
    expect(needsCmdShell('C:\\Obsidian\\Obsidian.COM')).toBe(false)
  })
})

describe('quoteForCmd', () => {
  it('leaves simple values alone', () => {
    expect(quoteForCmd('parse')).toBe('parse')
    expect(quoteForCmd('path=notes/a.md')).toBe('path=notes/a.md')
  })

  it('quotes spaces and doubles embedded quotes', () => {
    expect(quoteForCmd('path=My Vault/x.md')).toBe('"path=My Vault/x.md"')
    expect(quoteForCmd('a"b')).toBe('"a""b"')
  })

  it('renders an empty argument as an explicit empty string', () => {
    expect(quoteForCmd('')).toBe('""')
  })
})

describe('param', () => {
  it('builds the CLI key=value form without shell quoting', () => {
    // Direct spawns pass argv entries as-is, so a space needs no quotes here —
    // adding them would make the value literally contain quotes.
    expect(param('path', 'My Vault/note.md')).toBe('path=My Vault/note.md')
    expect(param('limit', '20')).toBe('limit=20')
  })
})
