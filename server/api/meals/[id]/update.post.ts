import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { meals } from '~/db/schema'
import { mealUpdateInputSchema } from '~/shared/domain/meals'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const mealId = z.string().uuid().parse(getRouterParam(event, 'id'))
  const input = await readValidatedBody(event, value => mealUpdateInputSchema.parse(value))

  const [updated] = await withUserScope(user.id, database => database.update(meals).set({
    mealDate: input.mealDate,
    mealTime: input.mealTime,
    mealType: input.mealType,
    name: input.name,
    caloriesKcal: String(input.nutrients.caloriesKcal),
    proteinG: nullableNumber(input.nutrients.proteinG),
    fatG: nullableNumber(input.nutrients.fatG),
    carbsG: nullableNumber(input.nutrients.carbsG),
    fiberG: nullableNumber(input.nutrients.fiberG),
    sodiumMg: nullableNumber(input.nutrients.sodiumMg),
    summary: input.summary
  }).where(and(
    eq(meals.id, mealId),
    eq(meals.userId, user.id)
  )).returning())

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Meal not found' })
  }

  return { id: updated.id }
})

function nullableNumber(value: number | null) {
  return value === null ? null : String(value)
}
