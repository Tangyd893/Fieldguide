/**
 * How to launch the Obsidian CLI — pure argv shaping, no spawning.
 *
 * Two Windows facts drive this:
 *
 *  1. The real CLI is `Obsidian.com`, a console redirector next to `Obsidian.exe`.
 *     `child_process` does not apply PATHEXT, so the caller must resolve the file
 *     itself; once resolved, a `.com`/`.exe` can be spawned directly.
 *  2. `.cmd`/`.bat` shims (used by tests, and by any future packaged wrapper)
 *     cannot be spawned directly on Windows — they need `cmd.exe /d /s /c`.
 *     That path goes through the console code page, so non-ASCII arguments can
 *     be mangled; it is a fallback, never the path taken by the real CLI.
 *
 * Keeping the shaping pure means the `cmd.exe` branch is unit-testable without a
 * real process ever starting.
 */
import { extname } from 'node:path'

export interface SpawnSpec {
  /** Executable to spawn. */
  file: string
  args: string[]
  /** True when `file` is cmd.exe and `args` carry a command string. */
  viaCmdShell: boolean
}

/** Extensions that Windows can only run through cmd.exe. */
const SHELL_SCRIPT_EXT = new Set(['.cmd', '.bat'])

/**
 * Quote one argument for cmd.exe's parser.
 *
 * cmd.exe doubles as a shell here, so characters that mean something to it
 * (`&`, `^`, `|`, `<`, `>`, `(`, `)`) force quoting even without a space.
 */
export function quoteForCmd(arg: string): string {
  if (arg === '') return '""'
  const needsQuotes = /[\s&^|<>()]/.test(arg) || arg.includes('"')
  if (!needsQuotes) return arg
  // Inside double quotes, cmd treats "" as a literal quote; `\"` is not reliable.
  return `"${arg.replace(/"/g, '""')}"`
}

/**
 * Build the spawn spec for a resolved CLI path.
 *
 * `args` are already-split argv entries (`version`, `open`, `path=note.md`). For
 * a direct spawn they are handed to the OS untouched; for the cmd.exe fallback
 * they are re-quoted into a single command string.
 */
export function buildSpawnSpec(cliPath: string, args: string[], comSpec = process.env.ComSpec || 'cmd.exe'): SpawnSpec {
  const ext = extname(cliPath).toLowerCase()
  if (SHELL_SCRIPT_EXT.has(ext)) {
    const command = [quoteForCmd(cliPath), ...args.map(quoteForCmd)].join(' ')
    // /d skips AutoRun, /s keeps the quoting rules literal for the rest of the line.
    return { file: comSpec, args: ['/d', '/s', '/c', command], viaCmdShell: true }
  }
  return { file: cliPath, args: [...args], viaCmdShell: false }
}

/** `key=value` in the CLI's parameter syntax. Values stay unquoted: with no shell involved. */
export function param(key: string, value: string): string {
  return `${key}=${value}`
}

/** True when this resolved path is a Windows shell script needing cmd.exe. */
export function needsCmdShell(cliPath: string): boolean {
  return SHELL_SCRIPT_EXT.has(extname(cliPath).toLowerCase())
}
