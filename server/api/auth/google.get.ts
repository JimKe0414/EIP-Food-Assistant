import { createHash, randomBytes } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const requestedReturnTo = String(getQuery(event).redirect ?? '/')
  const returnTo = requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : '/'
  if (config.authMode !== 'google') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  if (!config.googleClientId || !config.googleRedirectUri) {
    throw createError({ statusCode: 503, statusMessage: 'Google SSO is not configured' })
  }

  const state = randomBytes(24).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const session = await getUserSession(event)
  await session.update({ ...session.data, oauthState: state, oauthVerifier: verifier, returnTo })

  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  const authorizationParams = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  })
  if (config.googleWorkspaceDomain) authorizationParams.set('hd', config.googleWorkspaceDomain)
  authorizationUrl.search = authorizationParams.toString()

  return sendRedirect(event, authorizationUrl.toString())
})
