import { randomBytes } from 'node:crypto'

export default defineEventHandler((event) => {
  const token = randomBytes(32).toString('base64url')
  setCookie(event, 'food_csrf', token, {
    httpOnly: false,
    secure: !import.meta.dev,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 2
  })
  return { token }
})
