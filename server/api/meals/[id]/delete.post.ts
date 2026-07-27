import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { meals } from '~/db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const mealId = z.string().uuid().parse(getRouterParam(event, 'id'))

  const [deleted] = await withUserScope(user.id, database => database.delete(meals).where(and(
    eq(meals.id, mealId),
    eq(meals.userId, user.id)
  )).returning({ id: meals.id }))

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Meal not found' })
  }

  return { id: deleted.id, deleted: true }
})
