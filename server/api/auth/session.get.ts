export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  return { authenticated: Boolean(session.data.userId), emailDomain: session.data.emailDomain ?? null }
})
