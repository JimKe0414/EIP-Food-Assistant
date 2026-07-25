import { and, eq } from 'drizzle-orm'
import { meals } from '~/db/schema'
import { mealInputSchema } from '~/shared/domain/meals'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, value => mealInputSchema.parse(value))
  const result = await withUserScope(user.id, async database => {
    const values = {
      userId: user.id,
      clientRequestId: input.clientRequestId ?? null,
      mealDate: input.mealDate,
      mealType: input.mealType,
      source: input.source,
      name: input.name,
      caloriesKcal: String(input.nutrients.caloriesKcal),
      proteinG: nullableNumber(input.nutrients.proteinG),
      fatG: nullableNumber(input.nutrients.fatG),
      carbsG: nullableNumber(input.nutrients.carbsG),
      fiberG: nullableNumber(input.nutrients.fiberG),
      sodiumMg: nullableNumber(input.nutrients.sodiumMg),
      confidence: input.confidence == null ? null : String(input.confidence),
      summary: input.summary ?? null
    }
    const [created] = await database.insert(meals).values(values).onConflictDoNothing().returning()
    if (created) return { meal: created, duplicate: false }
    if (!input.clientRequestId) throw createError({ statusCode: 409, statusMessage: 'Meal already exists' })
    const [existing] = await database.select().from(meals).where(and(
      eq(meals.userId, user.id),
      eq(meals.clientRequestId, input.clientRequestId)
    )).limit(1)
    if (!existing) throw createError({ statusCode: 409, statusMessage: 'Meal could not be created' })
    return { meal: existing, duplicate: true }
  })
  setResponseStatus(event, result.duplicate ? 200 : 201)
  return result
})

function nullableNumber(value: number | null) {
  return value === null ? null : String(value)
}
