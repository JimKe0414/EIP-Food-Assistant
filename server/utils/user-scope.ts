import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { users } from '~/db/schema'

export interface AuthenticatedUser {
  id: string
  identityHmac: string
  role: string
}

export async function requireUser(event: H3Event): Promise<AuthenticatedUser> {
  const session = await getUserSession(event)
  if (!session.data.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const [user] = await useDatabase().select().from(users).where(eq(users.id, session.data.userId)).limit(1)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Session user not found' })
  return { id: user.id, identityHmac: user.identityHmac, role: user.role }
}

export async function getUserSession(event: H3Event) {
  const config = useRuntimeConfig()
  return useSession<{
    userId?: string
    emailDomain?: string
    oauthState?: string
    oauthVerifier?: string
    returnTo?: string
  }>(event, {
    name: 'food_session',
    password: config.sessionPassword,
    cookie: {
      httpOnly: true,
      secure: useSecureCookies(),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8
    }
  })
}

type DatabaseTransaction = Parameters<Parameters<ReturnType<typeof useDatabase>['transaction']>[0]>[0]

export async function withUserScope<T>(userId: string, callback: (database: DatabaseTransaction) => Promise<T>): Promise<T> {
  return useDatabase().transaction(async transaction => {
    await transaction.execute(sql`select set_config('app.current_user_id', ${userId}, true)`)
    return callback(transaction)
  })
}
