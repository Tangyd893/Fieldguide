import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CLI_ENV_OVERRIDE,
  cliCandidates,
  installDirCandidates,
  launchObsidianTarget,
  listVaults,
  openNote,
  probeCli,
  resetCliCache,
  resolveCli,
  resolveCliDetailed,
  resolveObsidianExe,
  runCli,
  searchVault,
  type CliRunner,
} from '../cli'
import type { CliRunResult } from '../parse'

let dir: string
/** A home directory with nothing in it, so the well-known install dirs stay hermetic. */
let fakeHome: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fg-obsidian-cli-'))
  fakeHome = mkdtempSync(join(tmpdir(), 'fg-obsidian-home-'))
  resetCliCache()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  rmSync(fakeHome, { recursive: true, force: true })
})

function stubCli(): string {
  const file = join(dir, 'Obsidian.com')
  writeFileSync(file, 'stub')
  return file
}

function runnerReturning(result: Partial<CliRunResult>): CliRunner {
  return async () => ({ ok: true, code: 0, stdout: '', stderr: '', timedOut: false, ...result })
}

describe('CLI resolution', () => {
  it('treats an explicit path as authoritative, without falling back', () => {
    // Falling back would hide a typo *and* let a different CLI answer, which makes
    // "is the integration usable?" untrustworthy.
    const explicit = stubCli()
    const fromEnv = join(dir, 'env', 'Obsidian.com')
    const candidates = cliCandidates(explicit, { [CLI_ENV_OVERRIDE]: fromEnv, PATH: dir }, 'win32', fakeHome)
    expect(candidates).toEqual([explicit])
  })

  it('prefers the configured path over the environment variable', () => {
    const explicit = join(dir, 'from-setting.com')
    writeFileSync(explicit, 'stub')
    const envPath = stubCli()
    const resolution = resolveCliDetailed(explicit, { [CLI_ENV_OVERRIDE]: envPath, PATH: '' }, 'win32', fakeHome)
    expect(resolution.explicit).toBe(explicit)
    expect(resolution.path).toBe(explicit)
  })

  it('reports a configured path that no longer exists', () => {
    const resolution = resolveCliDetailed(join(dir, 'gone.com'), { PATH: dir }, 'win32', fakeHome)
    expect(resolution.path).toBeNull()
    expect(resolution.explicit).toBe(join(dir, 'gone.com'))
  })

  it('auto-detects when nothing is configured', () => {
    const candidates = cliCandidates('', { PATH: dir }, 'win32', fakeHome)
    expect(candidates).toContain(join(dir, 'obsidian.com'))
    expect(candidates).toContain(join(dir, 'obsidian.exe'))
  })

  it('falls back to the well-known install dirs', () => {
    const dirs = installDirCandidates({ LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local', PROGRAMFILES: 'C:\\Program Files' }, fakeHome)
    expect(dirs).toContain(join('C:\\Users\\me\\AppData\\Local', 'Programs', 'Obsidian'))
    expect(dirs).toContain(join('C:\\Program Files', 'Obsidian'))
    expect(dirs).toContain(join(fakeHome, '.local', 'bin'))
  })

  it('resolves a real file and finds nothing when there is none', () => {
    const cli = stubCli()
    const empty = mkdtempSync(join(tmpdir(), 'fg-obsidian-empty-'))
    try {
      expect(resolveCli(cli, { PATH: '' }, 'win32', fakeHome)).toBe(cli)
      expect(resolveCli('', { PATH: empty }, 'win32', fakeHome)).toBeNull()
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })

  it('finds the GUI binary next to the CLI so Obsidian can be started', () => {
    const cli = stubCli()
    const exe = join(dir, 'Obsidian.exe')
    writeFileSync(exe, 'stub')
    expect(resolveObsidianExe(cli)).toBe(exe)
  })
})

describe('probeCli', () => {
  it('reports cli-missing when nothing is installed', async () => {
    const status = await probeCli({ env: { PATH: join(dir, 'empty') }, home: fakeHome, platform: 'win32' })
    expect(status.state).toBe('cli-missing')
    expect(status.cliPath).toBe('')
  })

  it('reports app-not-running for the real CLI message', async () => {
    const cli = stubCli()
    const status = await probeCli({
      cliPath: cli,
      env: { PATH: '' },
      home: fakeHome,
      runner: runnerReturning({
        ok: false,
        code: 1,
        stderr: 'The CLI is unable to find Obsidian. Please make sure Obsidian is running and try again.',
      }),
    })
    expect(status.state).toBe('app-not-running')
    expect(status.cliPath).toBe(cli)
  })

  it('reports ok with the version when the CLI answers', async () => {
    const status = await probeCli({
      cliPath: stubCli(),
      env: { PATH: '' },
      home: fakeHome,
      runner: runnerReturning({ stdout: '1.12.7' }),
    })
    expect(status.state).toBe('ok')
    expect(status.version).toBe('1.12.7')
  })

  it('serves repeat calls from the cache until it is reset', async () => {
    let calls = 0
    const runner: CliRunner = async () => {
      calls += 1
      return { ok: true, code: 0, stdout: '1.12.7', stderr: '', timedOut: false }
    }
    const opts = { cliPath: stubCli(), env: { PATH: '' }, home: fakeHome, runner }
    await probeCli(opts)
    const cached = await probeCli(opts)
    expect(calls).toBe(1)
    expect(cached.cached).toBe(true)
    // The settings page's "re-check" must not be answered from the cache.
    await probeCli({ ...opts, force: true })
    expect(calls).toBe(2)
  })
})

describe('runCli', () => {
  it('never throws when the runner fails, and reports the reason', async () => {
    const result = await runCli('C:\\x\\Obsidian.com', ['version'], {
      runner: async () => { throw new Error('boom') },
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('boom')
  })
})

describe('listVaults', () => {
  it('retries with format=json when the text form yields nothing', async () => {
    const calls: string[][] = []
    const runner: CliRunner = async (_file, args) => {
      calls.push(args)
      const json = args.includes('format=json')
      return {
        ok: true,
        code: 0,
        stdout: json ? '["D:\\\\vaults\\\\Notes"]' : 'no vaults found',
        stderr: '',
        timedOut: false,
      }
    }
    const vaults = await listVaults({ cliPath: 'C:\\x\\Obsidian.com', runner })
    expect(vaults).toEqual([{ name: 'Notes', path: 'D:\\vaults\\Notes' }])
    expect(calls).toHaveLength(2)
    expect(calls[1]).toContain('format=json')
  })

  it('keeps `vaults` global — it is the command that discovers vault names', async () => {
    const seen: string[][] = []
    const runner: CliRunner = async (_file, args) => {
      seen.push(args)
      return { ok: true, code: 0, stdout: 'MyMind\tD:\\workspace\\MyMind\n', stderr: '', timedOut: false }
    }
    const vaults = await listVaults({ cliPath: 'C:\\x\\Obsidian.com', vaultName: 'My Vault', runner })
    expect(seen[0]).toEqual(['vaults', 'verbose'])
    expect(vaults).toEqual([{ name: 'MyMind', path: 'D:\\workspace\\MyMind' }])
  })
})

describe('vault-scoped commands', () => {
  it('prefixes the vault name so they do not depend on the focused window', async () => {
    const seen: string[][] = []
    const runner: CliRunner = async (_file, args) => {
      seen.push(args)
      return { ok: true, code: 0, stdout: '', stderr: '', timedOut: false }
    }
    await openNote({ cliPath: 'C:\\x\\Obsidian.com', vaultName: 'My Vault', notePath: 'Fieldguide/p/x.md', runner })
    expect(seen[0][0]).toBe('vault=My Vault')
    expect(seen[0][1]).toBe('open')
    expect(seen[0][2]).toBe('path=Fieldguide/p/x.md')
  })

  it('omits the prefix when no vault name is known, falling back to the focused vault', async () => {
    const seen: string[][] = []
    const runner: CliRunner = async (_file, args) => {
      seen.push(args)
      return { ok: true, code: 0, stdout: '', stderr: '', timedOut: false }
    }
    await openNote({ cliPath: 'C:\\x\\Obsidian.com', notePath: 'a.md', runner })
    expect(seen[0]).toEqual(['open', 'path=a.md'])
  })

  it('filters search output down to markdown paths', async () => {
    const hits = await searchVault({
      cliPath: 'C:\\x\\Obsidian.com',
      query: 'chunk',
      folder: 'Fieldguide/pulsegate',
      limit: 5,
      runner: runnerReturning({
        stdout: 'Fieldguide/pulsegate/cards/知识-chunk.md\nnot a path\nFieldguide/pulsegate/索引.md\n',
      }),
    })
    expect(hits).toEqual(['Fieldguide/pulsegate/cards/知识-chunk.md', 'Fieldguide/pulsegate/索引.md'])
  })
})

describe('launchObsidianTarget', () => {
  it('reports the GUI binary when it sits next to the CLI', () => {
    const cli = stubCli()
    writeFileSync(join(dir, 'Obsidian.exe'), 'stub')
    expect(launchObsidianTarget(cli)?.via).toBe('exe')
  })

  it('falls back to the URI scheme when there is no sibling binary', () => {
    expect(launchObsidianTarget(stubCli())).toEqual({ via: 'uri', target: 'obsidian://' })
  })

  it('has nothing to offer without a CLI path, but still offers the URI', () => {
    expect(launchObsidianTarget('')).toEqual({ via: 'uri', target: 'obsidian://' })
  })
})
