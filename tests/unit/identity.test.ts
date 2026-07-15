import { describe, expect, it } from 'vitest'
import { createIdentityHmac, safeEqual } from '../../server/utils/identity'

describe('identity HMAC', () => {
  it('normalizes email without storing the source identity', () => {
    const secret = 'unit-test-secret'
    expect(createIdentityHmac(' User@Example.com ', secret)).toBe(createIdentityHmac('user@example.com', secret))
    expect(createIdentityHmac('other@example.com', secret)).not.toBe(createIdentityHmac('user@example.com', secret))
  })

  it('compares tokens without a timing-sensitive string comparison', () => {
    expect(safeEqual('token', 'token')).toBe(true)
    expect(safeEqual('token', 'different')).toBe(false)
  })
})
