export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  await session.clear()
  return { ok: true }
})
