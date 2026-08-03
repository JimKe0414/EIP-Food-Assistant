import { asc, ilike } from 'drizzle-orm'
import { eipRestaurants } from '~/db/schema'
import { z } from 'zod'

const querySchema = z.object({
  q: z.string().trim().max(120).optional()
})

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = querySchema.parse(getQuery(event))
  const rows = await useDatabase().select({
    id: eipRestaurants.id,
    name: eipRestaurants.name,
    updatedAt: eipRestaurants.updatedAt
  }).from(eipRestaurants)
    .where(query.q ? ilike(eipRestaurants.name, `%${query.q}%`) : undefined)
    .orderBy(asc(eipRestaurants.name))
    .limit(200)

  return { restaurants: rows }
})
