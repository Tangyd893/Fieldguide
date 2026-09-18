/**
 * Spaced-repetition scheduling (SM-2 lite).
 *
 * Interval maths is the kind of logic that silently rots when it can only be
 * exercised through a UI, so it is pinned here.
 */
import { describe, it, expect } from 'vitest'
import {
  schedule,
  nextIntervalDays,
  isDue,
  computeReviewStats,
  initialSchedule,
  MIN_EASE,
  MAX_EASE,
  DEFAULT_EASE,
  MAX_INTERVAL_DAYS,
} from '../srs'

const NOW = new Date('2026-03-01T09:00:00.000Z')

describe('initialSchedule', () => {
  it('starts new cards with the default ease and no interval', () => {
    expect(initialSchedule()).toEqual({ intervalDays: 0, ease: DEFAULT_EASE, reps: 0, lapses: 0 })
  })
})

describe('nextIntervalDays', () => {
  it('schedules a new card 1 day out after a good answer', () => {
    expect(nextIntervalDays({ intervalDays: 0, ease: 2.5, reps: 0, lapses: 0 }, 2)).toBe(1)
  })

  it('schedules a new card further out when marked easy', () => {
    expect(nextIntervalDays({ intervalDays: 0, ease: 2.5, reps: 0, lapses: 0 }, 3)).toBe(3)
  })

  it('keeps a forgotten card in the same-day relearn bucket', () => {
    expect(nextIntervalDays({ intervalDays: 0, ease: 2.5, reps: 0, lapses: 0 }, 0)).toBe(0)
    // once seen, forgetting sends it back to tomorrow
    expect(nextIntervalDays({ intervalDays: 10, ease: 2.5, reps: 4, lapses: 0 }, 0)).toBe(1)
  })

  it('grows the interval by the ease factor for mature cards', () => {
    // 10 days * 2.5 ease = 25
    expect(nextIntervalDays({ intervalDays: 10, ease: 2.5, reps: 3, lapses: 0 }, 2)).toBe(25)
    // hard grows more slowly
    expect(nextIntervalDays({ intervalDays: 10, ease: 2.5, reps: 3, lapses: 0 }, 1)).toBe(12)
    // easy jumps ahead
    expect(nextIntervalDays({ intervalDays: 10, ease: 2.5, reps: 3, lapses: 0 }, 3)).toBe(33)
  })

  it('never returns an interval below one day once a card is mature', () => {
    expect(nextIntervalDays({ intervalDays: 1, ease: 1.3, reps: 5, lapses: 2 }, 1)).toBeGreaterThanOrEqual(1)
  })
})

describe('schedule', () => {
  it('increases reps and keeps ease for a good answer', () => {
    const result = schedule({ intervalDays: 3, ease: 2.5, reps: 1, lapses: 0 }, 2, NOW)
    expect(result.reps).toBe(2)
    expect(result.ease).toBeCloseTo(2.5)
    expect(result.dueAt).toBe(new Date(NOW.getTime() + 3 * 24 * 3600 * 1000).toISOString())
  })

  it('lowers ease and resets reps when forgotten', () => {
    const result = schedule({ intervalDays: 8, ease: 2.5, reps: 3, lapses: 1 }, 0, NOW)
    expect(result.ease).toBeCloseTo(2.3)
    expect(result.reps).toBe(0)
    expect(result.lapses).toBe(2)
    // due again within the same session, not tomorrow
    expect(Date.parse(result.dueAt) - NOW.getTime()).toBeLessThan(60 * 60 * 1000)
  })

  it('raises ease for easy answers', () => {
    const result = schedule({ intervalDays: 3, ease: 2.5, reps: 1, lapses: 0 }, 3, NOW)
    expect(result.ease).toBeCloseTo(2.6)
  })

  it('clamps ease into the SM-2 range', () => {
    let state = { intervalDays: 1, ease: 2.5, reps: 1, lapses: 0 }
    for (let i = 0; i < 20; i++) state = { ...schedule(state, 0, NOW), lapses: state.lapses }
    expect(state.ease).toBeGreaterThanOrEqual(MIN_EASE)

    let rising = { intervalDays: 1, ease: 2.5, reps: 1, lapses: 0 }
    for (let i = 0; i < 30; i++) rising = { ...schedule(rising, 3, NOW) }
    expect(rising.ease).toBeLessThanOrEqual(MAX_EASE)
  })

  it('caps the interval so repeated "easy" answers cannot overflow the date range', () => {
    // Regression: without the cap the interval grew to ~44 million days after 30
    // easies and Date.toISOString() threw, killing the scheduler.
    let state = { intervalDays: 1, ease: 2.5, reps: 1, lapses: 0 }
    for (let i = 0; i < 200; i++) state = { ...schedule(state, 3, NOW) }

    expect(state.intervalDays).toBe(MAX_INTERVAL_DAYS)
    expect(() => new Date(state.dueAt).toISOString()).not.toThrow()
    expect(Number.isFinite(Date.parse(state.dueAt))).toBe(true)
  })
})

describe('isDue', () => {
  it('is true for past dates and false for future dates', () => {
    expect(isDue('2026-02-01T00:00:00.000Z', NOW)).toBe(true)
    expect(isDue('2026-04-01T00:00:00.000Z', NOW)).toBe(false)
  })

  it('treats an unparseable date as due rather than hiding the card', () => {
    expect(isDue('not-a-date', NOW)).toBe(true)
  })
})

describe('computeReviewStats', () => {
  it('counts due cards and today\'s reviews with retention', () => {
    const cards = [
      { due_at: '2026-02-28T09:00:00.000Z' }, // due
      { due_at: '2026-03-02T09:00:00.000Z' }, // future
    ]
    const logs = [
      { rating: 2, reviewed_at: '2026-03-01T08:00:00.000Z' },
      { rating: 0, reviewed_at: '2026-03-01T08:05:00.000Z' },
      { rating: 1, reviewed_at: '2026-02-27T08:00:00.000Z' },
    ]
    const stats = computeReviewStats(cards, logs, NOW)
    expect(stats.dueNow).toBe(1)
    expect(stats.total).toBe(2)
    expect(stats.reviewedToday).toBe(2)
    expect(stats.retentionToday).toBeCloseTo(0.5)
  })

  it('reports a streak across consecutive days', () => {
    const logs = [
      { rating: 2, reviewed_at: '2026-03-01T08:00:00.000Z' },
      { rating: 2, reviewed_at: '2026-02-28T08:00:00.000Z' },
      { rating: 2, reviewed_at: '2026-02-27T08:00:00.000Z' },
      { rating: 2, reviewed_at: '2026-02-25T08:00:00.000Z' }, // gap on the 26th
    ]
    expect(computeReviewStats([], logs, NOW).streakDays).toBe(3)
  })

  it('keeps the streak alive when today has not been reviewed yet', () => {
    const logs = [
      { rating: 2, reviewed_at: '2026-02-28T08:00:00.000Z' },
      { rating: 2, reviewed_at: '2026-02-27T08:00:00.000Z' },
    ]
    expect(computeReviewStats([], logs, NOW).streakDays).toBe(2)
  })

  it('handles an empty history', () => {
    const stats = computeReviewStats([], [], NOW)
    expect(stats).toMatchObject({ dueNow: 0, total: 0, reviewedToday: 0, retentionToday: 0, streakDays: 0 })
  })
})
