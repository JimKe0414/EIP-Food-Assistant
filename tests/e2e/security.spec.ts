import { expect, test } from '@playwright/test'

test('security middleware rejects methods and missing CSRF', async ({ request }) => {
  expect((await request.put('/api/health')).status()).toBe(405)
  expect((await request.post('/api/meals', { data: {} })).status()).toBe(403)
  expect((await request.get('/api/%2e%2e%3b/health')).status()).toBeGreaterThanOrEqual(400)
})

test('production-oriented security headers and per-request CSP nonce are present', async ({ request }) => {
  const first = await request.get('/')
  const second = await request.get('/')
  const firstCsp = first.headers()['content-security-policy'] ?? ''
  const secondCsp = second.headers()['content-security-policy'] ?? ''
  expect(firstCsp).toContain("worker-src 'self'")
  expect(firstCsp).toContain('nonce-')
  expect(firstCsp).not.toBe(secondCsp)
  expect(first.headers()['x-content-type-options']).toBe('nosniff')
  expect(first.headers()['referrer-policy']).toBeTruthy()
})
