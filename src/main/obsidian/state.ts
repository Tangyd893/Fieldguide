/**
 * Sync run state.
 *
 * A full sync and an agent card write must not interleave (they plan and write the
 * same files), and the settings page has to say "syncing…" without calling into
 * the heavy modules. Both needs are met by one module-level flag — the same shape
 * `ua/client.ts` uses for index runs.
 */

let syncInFlight = false

export function beginSync(): void {
  syncInFlight = true
}

export function endSync(): void {
  syncInFlight = false
}

export function isSyncRunning(): boolean {
  return syncInFlight
}
