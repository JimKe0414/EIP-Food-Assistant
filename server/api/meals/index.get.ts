import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { meals } from '~/db/schema'
import { formatDateInTimeZone } from '~/shared/domain/date'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const today = formatDateInTimeZone(new Date(), useRuntimeConfig().appTimeZone)
  const from = String(query.from ?? query.date ?? today)
  const to = String(query.to ?? query.date ?? today)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw createError({ statusCode: 400, statusMessage: 'Dates must use YYYY-MM-DD' })
  }

  const rows = await withUserScope(user.id, database => database.select().from(meals).where(and(
    eq(meals.userId, user.id),
    gte(meals.mealDate, from),
    lte(meals.mealDate, to)
  )).orderBy(desc(meals.mealDate), desc(meals.createdAt)).limit(500))
  return { meals: rows }
})
