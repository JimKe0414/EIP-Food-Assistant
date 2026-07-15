import { describe, expect, it } from 'vitest'
import { SlidingWindowRateLimiter } from '../../server/utils/rate-limit'

describe('rate limiter', () => {
  it('rejects the eleventh recommendation inside five minutes', () => {
    const limiter = new SlidingWindowRateLimiter(10, 300_000)
    for (let index = 0; index < 10; index += 1) expect(limiter.consume('user', 1_000 + index).allowed).toBe(true)
    const rejected = limiter.consume('user', 2_000)
    expect(rejected.allowed).toBe(false)
    if (!rejected.allowed) expect(rejected.retryAfterSeconds).toBeGreaterThan(0)
  })
})
