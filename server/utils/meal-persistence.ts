import { and, eq } from 'drizzle-orm'
import { meals } from '~/db/schema'
import type { DatabaseTransaction } from '~/server/utils/user-scope'
import { formatTimeInTimeZone } from '~/shared/domain/date'
import type { MealInput } from '~/shared/domain/meals'

export async function persistMeal(
  database: DatabaseTransaction,
  userId: string,
  input: MealInput,
  timeZone: string
) {
  const values = {
    userId,
    clientRequestId: input.clientRequestId ?? null,
    mealDate: input.mealDate,
    mealTime: input.mealTime ?? formatTimeInTimeZone(new Date(), timeZone),
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
    eq(meals.userId, userId),
    eq(meals.clientRequestId, input.clientRequestId)
  )).limit(1)
  if (!existing) throw createError({ statusCode: 409, statusMessage: 'Meal could not be created' })
  return { meal: existing, duplicate: true }
}

function nullableNumber(value: number | null) {
  return value === null ? null : String(value)
}
