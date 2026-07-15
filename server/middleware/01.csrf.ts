import { safeEqual } from '~/server/utils/identity'

const excludedPaths = new Set([
  '/api/internal/tfda-sync'
])

export default defineEventHandler((event) => {
  if (getMethod(event).toUpperCase() !== 'POST') return
  const path = getRequestURL(event).pathname
  if (excludedPaths.has(path)) return

  const cookieToken = getCookie(event, 'food_csrf')
  const headerToken = getRequestHeader(event, 'x-csrf-token')
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid CSRF token' })
  }
})
