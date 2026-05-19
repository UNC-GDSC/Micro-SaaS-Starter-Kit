/**
 * Unit tests for lib/notifications/digest.ts
 *
 * Tests pure/helper functions only — generateDigest() queries the DB
 * and is covered by the integration test.
 */

import {
  getCurrentHourInTimezone,
  getYesterdayWindow,
} from '@/lib/notifications/digest'

// ---------------------------------------------------------------------------
// getCurrentHourInTimezone
// ---------------------------------------------------------------------------

describe('getCurrentHourInTimezone', () => {
  it('returns a number between 0 and 23 for UTC', () => {
    const hour = getCurrentHourInTimezone('UTC')
    expect(hour).toBeGreaterThanOrEqual(0)
    expect(hour).toBeLessThanOrEqual(23)
  })

  it('returns a number between 0 and 23 for a valid named timezone', () => {
    const hour = getCurrentHourInTimezone('America/New_York')
    expect(hour).toBeGreaterThanOrEqual(0)
    expect(hour).toBeLessThanOrEqual(23)
  })

  it('falls back gracefully on an invalid timezone', () => {
    const hour = getCurrentHourInTimezone('Not/AReal_Zone')
    expect(hour).toBeGreaterThanOrEqual(0)
    expect(hour).toBeLessThanOrEqual(23)
  })

  it('returns the correct UTC hour for a fixed moment', () => {
    // Freeze time to 2026-05-17 08:00:00 UTC
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-17T08:00:00Z'))

    const hour = getCurrentHourInTimezone('UTC')
    expect(hour).toBe(8)

    jest.useRealTimers()
  })

  it('returns UTC+3 offset correctly (Moscow time = UTC+3)', () => {
    // 05:00 UTC → 08:00 Moscow
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-17T05:00:00Z'))

    const hour = getCurrentHourInTimezone('Europe/Moscow')
    // Moscow is UTC+3 (no DST), so 05:00 UTC = 08:00 Moscow
    expect(hour).toBe(8)

    jest.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// getYesterdayWindow
// ---------------------------------------------------------------------------

describe('getYesterdayWindow', () => {
  it('returns UTC midnight boundaries for yesterday', () => {
    const { periodStart, periodEnd } = getYesterdayWindow()

    // periodEnd should be today's midnight UTC
    expect(periodEnd.getUTCHours()).toBe(0)
    expect(periodEnd.getUTCMinutes()).toBe(0)
    expect(periodEnd.getUTCSeconds()).toBe(0)

    // periodStart should be exactly 24h before periodEnd
    const diff = periodEnd.getTime() - periodStart.getTime()
    expect(diff).toBe(24 * 60 * 60 * 1000)
  })

  it('returns dates where periodStart < periodEnd', () => {
    const { periodStart, periodEnd } = getYesterdayWindow()
    expect(periodStart.getTime()).toBeLessThan(periodEnd.getTime())
  })

  it('is deterministic when called twice in the same millisecond', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-17T12:34:56.789Z'))

    const first = getYesterdayWindow()
    const second = getYesterdayWindow()
    expect(first.periodStart.getTime()).toBe(second.periodStart.getTime())
    expect(first.periodEnd.getTime()).toBe(second.periodEnd.getTime())

    jest.useRealTimers()
  })
})
