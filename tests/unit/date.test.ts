import { describe, expect, it } from 'vitest'
import { formatDateInTimeZone, isoDateRangeEndingOn, shiftIsoDate } from '../../shared/domain/date'

describe('application dates', () => {
  it('uses the configured timezone instead of truncating UTC', () => {
    const instant = new Date('2026-07-25T16:30:00.000Z')
    expect(formatDateInTimeZone(instant, 'Asia/Taipei')).toBe('2026-07-26')
    expect(formatDateInTimeZone(instant, 'UTC')).toBe('2026-07-25')
  })

  it('builds a stable date-only range across month boundaries', () => {
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(isoDateRangeEndingOn('2026-03-03', 4)).toEqual([
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
      '2026-03-03'
    ])
  })
})
