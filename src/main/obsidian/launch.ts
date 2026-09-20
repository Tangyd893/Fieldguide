/**
 * Starting Obsidian when the CLI cannot find it.
 *
 * The CLI is a client of a *running* app, so "CLI installed but Obsidian closed"
 * is a normal state, not an error. Two routes are tried, cheapest first:
 *
 *  1. the GUI binary sitting next to the resolved CLI (no protocol handler
 *     registration needed, works even when the URI scheme is unregistered);
 *  2. the `obsidian://` URI, which is what a user would click themselves.
 *
 * Both are fire-and-forget: the caller re-probes instead of waiting for a window,
 * because app start-up time is not ours to bound.
 */
import { shell } from 'electron'
import { launchObsidianTarget } from './cli'
import { logInfo } from '../logger'

export interface LaunchResult {
  launched: boolean
  via: 'exe' | 'uri' | 'none'
  detail?: string
}

/** Ask the OS to start Obsidian. Never throws. */
export async function launchObsidian(cliPath: string): Promise<LaunchResult> {
  const { via, target } = launchObsidianTarget(cliPath)
  try {
    if (via === 'exe') {
      const result = await shell.openPath(target)
      if (!result) {
        logInfo('obsidian:launch', { via, target })
        return { launched: true, via }
      }
      logInfo('obsidian:launch-failed', { via, target, message: result })
      // Fall through to the URI: the binary may exist but be unlaunchable.
    }
    await shell.openExternal('obsidian://')
    logInfo('obsidian:launch', { via: 'uri' })
    return { launched: true, via: 'uri' }
  } catch (err) {
    return { launched: false, via: 'none', detail: err instanceof Error ? err.message : String(err) }
  }
}

/** Poll the probe until it reports `ok` or the budget runs out. */
export async function waitForCli(
  probe: () => Promise<{ state: string }>,
  timeoutMs = 25_000,
  intervalMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    const status = await probe()
    if (status.state === 'ok') return
  }
}
