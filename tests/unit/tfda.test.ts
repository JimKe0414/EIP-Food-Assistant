import { describe, expect, it } from 'vitest'
import { getTfdaFreshness, parseTfdaNumeric } from '../../shared/domain/tfda'

describe('TFDA rules', () => {
  const now = new Date('2026-07-15T00:00:00Z')
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)

  it('implements fresh, stale, and expired downgrade boundaries', () => {
    expect(getTfdaFreshness(daysAgo(7), now).status).toBe('fresh')
    expect(getTfdaFreshness(daysAgo(8), now).status).toBe('stale')
    expect(getTfdaFreshness(daysAgo(30), now).status).toBe('stale')
    expect(getTfdaFreshness(daysAgo(31), now).status).toBe('expired')
  })

  it('distinguishes trace, zero, and missing values', () => {
    expect(parseTfdaNumeric('Tr')).toEqual({ value: 0.001, isTrace: true })
    expect(parseTfdaNumeric('0')).toEqual({ value: 0, isTrace: false })
    expect(parseTfdaNumeric('—')).toEqual({ value: null, isTrace: false })
  })
})
