/**
 * The one place that answers "what is the Obsidian integration doing right now".
 *
 * Both the settings page and the vault panel render from this payload, so the CLI
 * probe, the binding classification and the sync state are assembled together
 * instead of each caller re-deriving a slightly different picture.
 */
import { loadConfig } from '../config'
import { listVaultNotes } from '../db'
import { listVaults, probeCli, type CliRunner } from './cli'
import { classifyBinding } from './binding'
import { isSyncRunning } from './state'
import type { ObsidianStatus, VaultBinding, VaultCliStatus, VaultInfo } from './types'

export interface StatusOptions {
  /** Project whose note bookkeeping is reported. */
  projectId?: string
  /** Injected by tests; production uses the real spawn runner. */
  runner?: CliRunner
  /** Force a fresh probe (the "re-check" button). */
  force?: boolean
}

export async function getObsidianStatus(opts: StatusOptions = {}): Promise<ObsidianStatus> {
  const config = loadConfig()
  const cli = await probeCli({ runner: opts.runner, force: opts.force, cliPath: config.obsidian.cliPath })

  let binding: VaultBinding | null = null
  if (config.obsidian.vaultPath) {
    const vaults = cli.state === 'ok' && cli.cliPath
      ? await listVaults({ cliPath: cli.cliPath, vaultName: config.obsidian.vaultName || undefined, runner: opts.runner })
      : []
    binding = classifyBinding(config.obsidian.vaultPath, config.obsidian.vaultName, vaults)
  }

  const rows = opts.projectId ? listVaultNotes(opts.projectId) : []
  const lastSyncAt = rows.reduce<string | null>(
    (latest, row) => (!latest || row.synced_at > latest ? row.synced_at : latest),
    null,
  )

  return {
    cli,
    binding,
    folder: config.obsidian.folder,
    notesCount: rows.length,
    lastSyncAt,
    syncInFlight: isSyncRunning(),
  }
}

/** Shared by the IPC handlers that need the vault registry (pick / classify). */
export async function fetchVaults(
  opts: { runner?: CliRunner } = {},
): Promise<{ cli: VaultCliStatus; vaults: VaultInfo[] }> {
  const config = loadConfig()
  const cli = await probeCli({ runner: opts.runner, cliPath: config.obsidian.cliPath })
  if (cli.state !== 'ok' || !cli.cliPath) return { cli, vaults: [] }
  const vaults = await listVaults({
    cliPath: cli.cliPath,
    vaultName: config.obsidian.vaultName || undefined,
    runner: opts.runner,
  })
  return { cli, vaults }
}
