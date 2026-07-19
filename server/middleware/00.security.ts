import { randomBytes } from 'node:crypto'

const allowedMethods = new Set(['GET', 'POST', 'OPTIONS'])

export default defineEventHandler((event) => {
  const method = getMethod(event).toUpperCase()
  const url = getRequestURL(event)

  if (!allowedMethods.has(method)) {
    setResponseHeader(event, 'Allow', 'GET, POST, OPTIONS')
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  if (getRequestHeader(event, 'transfer-encoding')) {
    throw createError({ statusCode: 400, statusMessage: 'Transfer-Encoding is not accepted' })
  }
  if (url.pathname.includes('..;') || url.href.includes('..;')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request path' })
  }

  const nonce = randomBytes(18).toString('base64url')
  event.context.cspNonce = nonce

  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
  if (import.meta.dev) scriptSrc.push("'unsafe-eval'")

  const connectSrc = import.meta.dev ? "connect-src 'self' ws: http:" : "connect-src 'self'"
  setResponseHeaders(event, {
    'Content-Security-Policy': [
      "default-src 'self'",
      `script-src ${scriptSrc.join(' ')}`,
      `style-src 'self' 'nonce-${nonce}'`,
      // Vue's :style bindings render as inline style="" attributes, which nonces/hashes
      // cannot cover (CSP only allows nonce/hash for <style> elements, not style
      // attributes, unless the separate 'unsafe-hashes' keyword is present — impractical
      // here since these values are dynamic). style-src-attr is scoped to attributes only,
      // so this does not weaken the nonce-gated style-src (elements) or script-src at all.
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      connectSrc,
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "worker-src 'self' blob:"
    ].join('; '),
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  })

  if (url.pathname.startsWith('/api/')) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
  }
  removeResponseHeader(event, 'Server')
  removeResponseHeader(event, 'X-Powered-By')
})

declare module 'h3' {
  interface H3EventContext {
    cspNonce?: string
  }
}
