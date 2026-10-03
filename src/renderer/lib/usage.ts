/**
 * Fire-and-forget usage tracking.
 *
 * Two rules, both about not letting instrumentation become a liability:
 *
 *   1. **Never awaited.** A blocked IPC round-trip must not delay a click; the
 *      promise is dropped deliberately.
 *   2. **Never throws.** If the bridge is missing (older preload, teardown) the
 *      call disappears silently — the feature being measured matters more than the
 *      measurement.
 *
 * The main process decides whether anything is written (logging is opt-in), and it
 * drops every field outside its schema, so call sites cannot leak content even by
 * accident. See `src/main/usage-log.ts`.
 */
export function track(
  event: string,
  opts: { project?: string; target?: string; value?: number } = {},
): void {
  try {
    void window.fieldguide.usageRecord({ event, ...opts }).catch(() => { /* best effort */ })
  } catch {
    /* instrumentation must never break the action it measures */
  }
}

/** Report which panel the reader switched to (the only UI-only signal we need). */
export function trackPanel(panel: string, project?: string): void {
  track('panel_opened', { project, target: panel })
}
