import { desc, ilike } from 'drizzle-orm'
import { nutrientVersions, nutrients } from '~/db/schema'
import { getTfdaFreshness } from '~/shared/domain/tfda'

export default defineEventHandler(async (event) => {
  const query = String(getQuery(event).q ?? '').trim()
  if (query.length > 100) throw createError({ statusCode: 400, statusMessage: 'Search query is too long' })
  const database = useDatabase()
  const rows = query
    ? await database.select().from(nutrients).where(ilike(nutrients.name, `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)).limit(30)
    : await database.select().from(nutrients).limit(30)
  const [version] = await database.select().from(nutrientVersions).orderBy(desc(nutrientVersions.syncedAt)).limit(1)
  return { nutrients: rows, freshness: getTfdaFreshness(version?.syncedAt ?? null) }
})
