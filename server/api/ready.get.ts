export default defineEventHandler(async (event) => {
  try {
    await useSqlClient()`select 1`
    return { status: 'ready', database: 'ok' }
  } catch {
    setResponseStatus(event, 503)
    return { status: 'not-ready', database: 'unavailable' }
  }
})
