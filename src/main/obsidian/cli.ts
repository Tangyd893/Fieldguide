/**
 * Obsidian CLI resolution and invocation.
 *
 * The CLI is not a standalone tool: it talks to a *running* Obsidian over IPC, so
 * "is it usable" is a three-way question (missing / app not running / ready).
 * Everything here is built around answering that question cheaply and honestly:
 *
 *  - resolution is explicit (override → PATH×PATHEXT → common install dirs),
 *    because `child_process` does not apply PATHEXT the way a shell does;
 *  - invocation goes through an injectable runner, so tests never start a process;
 *  - the answer is cached for a short window — the settings page polls it, and no
 *    other code path should pay for a spawn per keystroke.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, dirname, isAbsolute, join } from 'node:path'
import { homedir } from 'node:os'
import type { CliRunResult } from './parse'
import { buildSpawnSpec, param } from './spawn-spec'
import { interpretProbe, parseVaultList } from './parse'
import type { VaultCliStatus, VaultInfo } from './types'

export interface CliRunOptions {
  timeoutMs: number
  cwd?: string
}

/** Injectable so unit tests can describe CLI behaviour without a real Obsidian. */
export type CliRunner = (file: string, args: string[], opts: CliRunOptions) => Promise<CliRunResult>

/** Env override, used by the E2E harness to install a deterministic stub CLI. */
export const CLI_ENV_OVERRIDE = 'FIELDGUIDE_OBSIDIAN_CLI'

const PROBE_TTL_MS = 30_000
const VERSION_TIMEOUT_MS = 8_000
const COMMAND_TIMEOUT_MS = 20_000

/* ──────────── default runner ──────────── */

export const defaultRunner: CliRunner = (file, args, opts) =>
  new Promise<CliRunResult>((resolve) => {
    execFile(
      file,
      args,
      {
        timeout: opts.timeoutMs,
        cwd: opts.cwd,
        // A GUI app spawning a console redirector would flash a window otherwise.
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        encoding: 'utf8',
      },
      (err, stdout, stderr) => {
        const error = err as (Error & { code?: number | string; killed?: boolean }) | null
        resolve({
          ok: !error,
          code: error ? (typeof error.code === 'number' ? error.code : null) : 0,
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
          timedOut: Boolean(error?.killed),
          error: error ? String(error.message || error.code || '') : undefined,
        })
      },
    )
  })

/* ──────────── resolution ──────────── */

/** Executable names to look for, most specific first. */
function cliFileNames(platform = process.platform): string[] {
  return platform === 'win32'
    ? ['obsidian.com', 'obsidian.exe', 'obsidian.cmd', 'obsidian.bat']
    : ['obsidian']
}

/** Directories the CLI is installed to, beyond PATH. */
export function installDirCandidates(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string[] {
  const dirs: string[] = []
  if (env.LOCALAPPDATA) dirs.push(join(env.LOCALAPPDATA, 'Programs', 'Obsidian'))
  if (env.PROGRAMFILES) dirs.push(join(env.PROGRAMFILES, 'Obsidian'))
  if (env['PROGRAMFILES(X86)']) dirs.push(join(env['PROGRAMFILES(X86)'], 'Obsidian'))
  dirs.push(join(home, '.local', 'bin'), '/usr/local/bin', '/Applications/Obsidian.app/Contents/MacOS')
  return dirs
}

/** Explicit overrides: the user's setting wins over the environment variable. */
function explicitCliPath(override = '', env: NodeJS.ProcessEnv = process.env): string {
  const value = String(override ?? '').trim() || String(env[CLI_ENV_OVERRIDE] ?? '').trim()
  return value.replace(/^"|"$/g, '')
}

/**
 * Every plausible CLI path, in priority order.
 *
 * `override` (the user's explicit setting) outranks the environment override,
 * which outranks PATH, which outranks the well-known install directories — the
 * last group exists because registering the CLI updates the *user* PATH, and an
 * app started from a stale Explorer session never sees it.
 */
export function cliCandidates(
  override = '',
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
): string[] {
  const names = cliFileNames(platform)
  const out: string[] = []
  const push = (value?: string) => {
    const trimmed = String(value ?? '').trim().replace(/^"|"$/g, '')
    if (trimmed && !out.includes(trimmed)) out.push(trimmed)
  }

  const explicit = explicitCliPath(override, env)
  if (explicit) {
    // An explicit path is authoritative. Silently falling back to auto-detection
    // would hide a typo *and* let a different CLI answer, which is exactly what
    // makes "is the integration usable?" untrustworthy.
    push(explicit)
    return out
  }

  for (const dir of String(env.PATH ?? '').split(delimiter)) {
    const clean = dir.trim().replace(/^"|"$/g, '')
    if (!clean) continue
    for (const name of names) push(join(clean, name))
  }
  for (const dir of installDirCandidates(env, home)) {
    for (const name of names) push(join(dir, name))
  }
  // A bare name still works on POSIX, and on Windows when the caller ends up
  // shelling out; keep it last so an absolute path always wins.
  push(names[0])
  return out
}

export interface CliResolution {
  /** Absolute path of an existing CLI, or null. */
  path: string | null
  /** The explicit path that was configured, '' when auto-detecting. */
  explicit: string
  candidates: string[]
}

export function resolveCliDetailed(
  override = '',
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home?: string,
): CliResolution {
  const candidates = cliCandidates(override, env, platform, home)
  const explicit = explicitCliPath(override, env)
  const found = candidates.find((candidate) => isAbsolute(candidate) && existsSync(candidate)) ?? null
  return { path: found, explicit, candidates }
}

/** First candidate that exists on disk. */
export function resolveCli(
  override = '',
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home?: string,
): string | null {
  return resolveCliDetailed(override, env, platform, home).path
}

/** The GUI binary next to the CLI — used to start Obsidian when it is not running. */
export function resolveObsidianExe(cliPath: string): string | null {
  const dir = dirname(cliPath)
  for (const name of ['Obsidian.exe', 'obsidian.exe', 'Obsidian']) {
    const candidate = join(dir, name)
    if (existsSync(candidate)) return candidate
  }
  return null
}

/**
 * What to open in order to start Obsidian.
 *
 * Pure decision, so the "exe next to the CLI vs. URI scheme" branch is testable;
 * `launch.ts` performs the actual open. The URI is always a valid last resort —
 * it is what a user would click themselves.
 */
export function launchObsidianTarget(cliPath: string): { via: 'exe' | 'uri'; target: string } {
  const exe = cliPath ? resolveObsidianExe(cliPath) : null
  return exe ? { via: 'exe', target: exe } : { via: 'uri', target: 'obsidian://' }
}

/* ──────────── invocation ──────────── */

export interface RunCliOptions {
  runner?: CliRunner
  timeoutMs?: number
  cwd?: string
}

/** Run one CLI command; a missing CLI is reported, never thrown. */
export async function runCli(cliPath: string, args: string[], opts: RunCliOptions = {}): Promise<CliRunResult> {
  const runner = opts.runner ?? defaultRunner
  const spec = buildSpawnSpec(cliPath, args)
  try {
    return await runner(spec.file, spec.args, { timeoutMs: opts.timeoutMs ?? COMMAND_TIMEOUT_MS, cwd: opts.cwd })
  } catch (err) {
    return {
      ok: false,
      code: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/* ──────────── probe ──────────── */

interface ProbeCacheEntry {
  status: VaultCliStatus
  at: number
}

let probeCache: ProbeCacheEntry | null = null

export function resetCliCache(): void {
  probeCache = null
}

export interface ProbeOptions {
  runner?: CliRunner
  /** Ignore the cache (the "re-check" button, and after a settings change). */
  force?: boolean
  /** Explicit CLI path from settings. */
  cliPath?: string
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  /** Overridden by tests so the well-known install dirs can be made hermetic. */
  home?: string
  now?: () => number
}

/**
 * Decide whether the integration may be used.
 *
 * Only `state === 'ok'` unlocks the vault pickers (the CLI is a hard gate), so the
 * status must never be optimistic: an unreachable CLI is reported as such instead
 * of as "ready, probably".
 */
export async function probeCli(opts: ProbeOptions = {}): Promise<VaultCliStatus> {
  const now = opts.now ?? Date.now
  if (!opts.force && probeCache && now() - probeCache.at < PROBE_TTL_MS) {
    return { ...probeCache.status, cached: true }
  }

  const env = opts.env ?? process.env
  const resolution = resolveCliDetailed(opts.cliPath ?? '', env, opts.platform ?? process.platform, opts.home)
  const cliPath = resolution.path
  const checkedAt = new Date(now()).toISOString()

  if (!cliPath) {
    const status: VaultCliStatus = {
      state: 'cli-missing',
      cliPath: '',
      version: '',
      detail: resolution.explicit
        ? `the configured CLI path does not exist: ${resolution.explicit} (clear it to auto-detect)`
        : `no obsidian CLI found (PATH, install dirs, ${CLI_ENV_OVERRIDE})`,
      cached: false,
      checkedAt,
    }
    probeCache = { status, at: now() }
    return status
  }

  const run = await runCli(cliPath, ['version'], { runner: opts.runner, timeoutMs: VERSION_TIMEOUT_MS })
  const interpreted = interpretProbe(run)
  const status: VaultCliStatus = {
    state: interpreted.state,
    cliPath,
    version: interpreted.version,
    detail: interpreted.detail,
    cached: false,
    checkedAt,
  }
  probeCache = { status, at: now() }
  return status
}

/* ──────────── vault operations ──────────── */

export interface VaultCommandOptions extends RunCliOptions {
  cliPath: string
  /** Vault name for the `vault=` prefix; omitted means "whatever is focused". */
  vaultName?: string
}

/** `vault=<name>` must lead the argument list per the upstream docs. */
function withVault(args: string[], vaultName?: string): string[] {
  return vaultName ? [param('vault', vaultName), ...args] : args
}

/** Known vaults, via `vaults verbose` (JSON retry when the text form yields nothing). */
export async function listVaults(opts: VaultCommandOptions): Promise<VaultInfo[]> {
  const first = await runCli(opts.cliPath, ['vaults', 'verbose'], opts)
  const parsed = parseVaultList(first.stdout)
  if (parsed.length > 0) return parsed

  const second = await runCli(opts.cliPath, ['vaults', 'verbose', 'format=json'], opts)
  return parseVaultList(second.stdout)
}

/** Open one note in the running Obsidian. */
export async function openNote(opts: VaultCommandOptions & { notePath: string }): Promise<CliRunResult> {
  return runCli(opts.cliPath, withVault(['open', param('path', opts.notePath)], opts.vaultName), opts)
}

/** Full-text search, optionally scoped to a folder. Paths only (see the docs). */
export async function searchVault(
  opts: VaultCommandOptions & { query: string; folder?: string; limit?: number },
): Promise<string[]> {
  const args = ['search', param('query', opts.query), param('limit', String(opts.limit ?? 20))]
  if (opts.folder) args.push(param('path', opts.folder))
  const run = await runCli(opts.cliPath, withVault(args, opts.vaultName), opts)
  return run.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && /\.md$/i.test(line))
    .slice(0, opts.limit ?? 20)
}

/** Notes linking to this one. */
export async function backlinks(opts: VaultCommandOptions & { notePath: string }): Promise<string[]> {
  const run = await runCli(
    opts.cliPath,
    withVault(['backlinks', param('path', opts.notePath)], opts.vaultName),
    opts,
  )
  return run.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}
