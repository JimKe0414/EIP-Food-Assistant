import { createRemoteJWKSet, jwtVerify } from 'jose'
import { users } from '~/db/schema'
import { createIdentityHmac, safeEqual } from '~/server/utils/identity'

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const code = String(query.code ?? '')
  const state = String(query.state ?? '')
  const session = await getUserSession(event)
  const storedState = String(session.data.oauthState ?? '')
  const verifier = String(session.data.oauthVerifier ?? '')

  if (!code || !state || !storedState || !safeEqual(state, storedState) || !verifier) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state' })
  }

  const tokenResponse = await $fetch<{ id_token: string }>('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier
    })
  })

  const { payload } = await jwtVerify(tokenResponse.id_token, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: config.googleClientId
  })
  const email = String(payload.email ?? '').trim().toLowerCase()
  const domain = email.split('@')[1]
  if (!email || payload.email_verified !== true) {
    throw createError({ statusCode: 403, statusMessage: 'Verified Google account is required' })
  }
  if (config.googleWorkspaceDomain && domain !== config.googleWorkspaceDomain) {
    throw createError({ statusCode: 403, statusMessage: 'Workspace account is not allowed' })
  }

  const identityHmac = createIdentityHmac(email, config.identityHmacSecret)
  const [user] = await useDatabase().insert(users).values({ identityHmac }).onConflictDoUpdate({
    target: users.identityHmac,
    set: { updatedAt: new Date() }
  }).returning()
  await session.update({ userId: user.id, emailDomain: domain, oauthState: undefined, oauthVerifier: undefined })
  return sendRedirect(event, '/')
})
