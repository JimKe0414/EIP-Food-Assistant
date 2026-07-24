import { users } from '~/db/schema'
import { createIdentityHmac } from '~/server/utils/identity'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!import.meta.dev && !config.allowDevAuth) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = await readValidatedBody(event, value => {
    const email = String((value as { email?: unknown })?.email ?? '').trim().toLowerCase()
    if (!email.includes('@')) throw createError({ statusCode: 400, statusMessage: 'Valid email is required' })
    return { email }
  })
  const domain = body.email.split('@')[1]

  const identityHmac = createIdentityHmac(body.email, config.identityHmacSecret)
  const [user] = await useDatabase().insert(users).values({ identityHmac }).onConflictDoUpdate({
    target: users.identityHmac,
    set: { updatedAt: new Date() }
  }).returning()
  const session = await getUserSession(event)
  await session.update({ userId: user.id, emailDomain: domain })
  return { userId: user.id }
})
