/**
 * Spaced repetition scheduling (SM-2 lite).
 *
 * Kept as a pure module so the interval maths is unit-testable: the previous
 * "learning" features were all read-only, and a scheduler is exactly the kind of
 * logic that silently rots if it can only be exercised through the UI.
 *
 * Ratings: 0 = forgot, 1 = hard, 2 = good, 3 = easy.
 */

export type Rating = 0 | 1 | 2 | 3

export interface ScheduleState {
  /** Current interval in days (0 = new card). */
  intervalDays: number
  /** SM-2 ease factor, clamped to [1.3, 3.0]. */
  ease: number
  /** Consecutive successful reviews. */
  reps: number
  /** Times the card was forgotten. */
  lapses: number
}

export interface ScheduleResult extends ScheduleState {
  /** Next due date, ISO string. */
  dueAt: string
}

export const MIN_EASE = 1.3
export const MAX_EASE = 3.0
export const DEFAULT_EASE = 2.5
/** New cards are due immediately. */
export const NEW_CARD_INTERVAL_DAYS = 0
/**
 * Hard cap on the interval (3 years).
 *
 * Without it, repeatedly rating a card "easy" grows the interval exponentially —
 * a run of easies reaches millions of days, and `Date.toISOString()` throws once
 * the value leaves the JS date range (~year 275760), taking the scheduler down
 * with it. Real SRS implementations cap this for the same reason.
 */
export const MAX_INTERVAL_DAYS = 365 * 3

export function initialSchedule(): ScheduleState {
  return { intervalDays: NEW_CARD_INTERVAL_DAYS, ease: DEFAULT_EASE, reps: 0, lapses: 0 }
}

function clampEase(ease: number): number {
  return Math.max(MIN_EASE, Math.min(MAX_EASE, Number(ease.toFixed(2))))
}

/**
 * Compute the next interval.
 *
 *  - forgotten → back to a short relearn step (lapses +1, ease reduced)
 *  - hard      → small step, ease reduced
 *  - good      → standard step from the SM-2 table
 *  - easy      → jump ahead and raise ease
 *
 * Intervals are rounded to whole days beyond the first day so "due" dates stay
 * predictable for a UI that only shows dates.
 */
export function nextIntervalDays(state: ScheduleState, rating: Rating): number {
  const { intervalDays, ease, reps } = state

  if (rating === 0) {
    // Relearn tomorrow (or later the same day if it was never seen).
    return reps === 0 ? 0 : 1
  }

  // First successful review: 1 day, then 3 days, then ease-based growth.
  if (reps === 0) return rating === 3 ? 3 : 1
  if (reps === 1) return rating === 1 ? 2 : rating === 3 ? 5 : 3

  const multiplier = rating === 1 ? 1.2 : rating === 2 ? ease : ease * 1.3
  const raw = intervalDays > 0 ? intervalDays * multiplier : multiplier
  return Math.max(1, Math.min(MAX_INTERVAL_DAYS, Math.round(raw)))
}

/** Apply a rating, returning the new schedule plus the due date. */
export function schedule(
  state: ScheduleState,
  rating: Rating,
  now: Date = new Date(),
): ScheduleResult {
  const intervalDays = nextIntervalDays(state, rating)
  const forgot = rating === 0

  let ease = state.ease
  if (rating === 0) ease -= 0.2
  else if (rating === 1) ease -= 0.15
  else if (rating === 3) ease += 0.1

  let due: Date
  if (forgot) {
    // SM-2 relearn: a forgotten card comes back in the same session rather than
    // a full day later, which is what makes the review loop actually stick.
    due = new Date(now.getTime() + RELEARN_DELAY_MS)
  } else {
    due = new Date(now.getTime() + intervalDays * DAY_MS)
  }

  return {
    intervalDays,
    ease: clampEase(ease),
    reps: forgot ? 0 : state.reps + 1,
    lapses: state.lapses + (forgot ? 1 : 0),
    dueAt: due.toISOString(),
  }
}

/** Same-session relearn delay for forgotten cards. */
export const RELEARN_DELAY_MS = 10 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** True when a card should be shown now. */
export function isDue(dueAt: string, now: Date = new Date()): boolean {
  const due = Date.parse(dueAt)
  if (Number.isNaN(due)) return true
  return due <= now.getTime()
}

/** Local calendar day key (what a user means by "today", not the UTC day). */
function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface ReviewStats {
  dueNow: number
  total: number
  reviewedToday: number
  /** Share of reviews today that were not "forgot" (0–1). */
  retentionToday: number
  streakDays: number
}

/**
 * Aggregate review history for the panel header.
 *
 * `logs` is expected newest-first (as the query returns it). Day boundaries are
 * local, so "today" matches what the user sees on the clock.
 */
export function computeReviewStats(
  cards: Array<{ due_at: string }>,
  logs: Array<{ rating: number; reviewed_at: string }>,
  now: Date = new Date(),
): ReviewStats {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const todayLogs = logs.filter((l) => Date.parse(l.reviewed_at) >= startOfToday.getTime())
  const passed = todayLogs.filter((l) => l.rating > 0).length

  // Consecutive days (ending today or yesterday) with at least one review.
  const days = new Set(logs.map((l) => dayKey(new Date(l.reviewed_at))))
  const cursor = new Date(startOfToday)
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1) // today not reviewed yet — streak may still hold
  }
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return {
    dueNow: cards.filter((c) => isDue(c.due_at, now)).length,
    total: cards.length,
    reviewedToday: todayLogs.length,
    retentionToday: todayLogs.length > 0 ? passed / todayLogs.length : 0,
    streakDays: streak,
  }
}
