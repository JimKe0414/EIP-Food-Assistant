import { and, eq } from 'drizzle-orm'
import { customFoods, eipMenuItems, eipRestaurants, meals, nutrients } from '~/db/schema'
import { lunchFoodTypeSchema } from '~/shared/domain/ai'
import { formatTimeInTimeZone } from '~/shared/domain/date'
import { z } from 'zod'

const confirmationSchema = z.object({
  candidateId: z.string().trim().min(1).max(100),
  serviceDate: z.iso.date(),
  foodType: lunchFoodTypeSchema,
  restaurantId: z.uuid().nullable().optional(),
  clientRequestId: z.string().trim().min(1).max(100)
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, value => confirmationSchema.parse(value))
  const timeZone = useRuntimeConfig().appTimeZone
  const candidate = await withUserScope(user.id, async database => {
    if (input.candidateId.startsWith('eip:')) {
      const [row] = await database.select({
        id: eipMenuItems.id,
        restaurantId: eipMenuItems.restaurantId,
        restaurantName: eipRestaurants.name,
        foodType: eipMenuItems.foodType,
        name: eipMenuItems.name,
        caloriesKcal: eipMenuItems.caloriesKcal,
        proteinG: eipMenuItems.proteinG,
        fatG: eipMenuItems.fatG,
        carbsG: eipMenuItems.carbsG,
        fiberG: eipMenuItems.fiberG,
        sodiumMg: eipMenuItems.sodiumMg
      }).from(eipMenuItems)
        .innerJoin(eipRestaurants, eq(eipRestaurants.id, eipMenuItems.restaurantId))
        .where(and(
        eq(eipMenuItems.id, input.candidateId.slice(4)),
        input.restaurantId ? eq(eipMenuItems.restaurantId, input.restaurantId) : undefined
      )).limit(1)
      if (!row || (input.foodType === 'veg' && row.foodType !== 'veg')) return null
      return {
        source: 'eip' as const,
        restaurantName: row.restaurantName,
        name: row.name,
        caloriesKcal: row.caloriesKcal,
        proteinG: row.proteinG,
        fatG: row.fatG,
        carbsG: row.carbsG,
        fiberG: row.fiberG,
        sodiumMg: row.sodiumMg
      }
    }
    if (input.foodType === 'veg') return null
    if (input.candidateId.startsWith('custom:')) {
      const [row] = await database.select().from(customFoods).where(and(
        eq(customFoods.id, input.candidateId.slice(7)),
        eq(customFoods.userId, user.id)
      )).limit(1)
      if (!row) return null
      return {
        source: 'custom' as const,
        name: row.name,
        caloriesKcal: row.caloriesKcal,
        proteinG: row.proteinG,
        fatG: row.fatG,
        carbsG: row.carbsG,
        fiberG: null,
        sodiumMg: row.sodiumMg
      }
    }
    if (input.candidateId.startsWith('tfda:')) {
      const [row] = await database.select().from(nutrients).where(eq(nutrients.sampleId, input.candidateId.slice(5))).limit(1)
      if (!row) return null
      return {
        source: 'tfda' as const,
        name: row.name,
        caloriesKcal: row.caloriesKcal ?? '0',
        proteinG: row.proteinG,
        fatG: row.fatG,
        carbsG: row.carbsG,
        fiberG: row.fiberG,
        sodiumMg: optionalNutrient(row.optionalNutrients, ['鈉', 'sodium'])
      }
    }
    return null
  })
  if (!candidate) throw createError({ statusCode: 404, statusMessage: 'Selected lunch candidate is not available' })

  const result = await withUserScope(user.id, async database => {
    const [created] = await database.insert(meals).values({
      userId: user.id,
      clientRequestId: input.clientRequestId,
      mealDate: input.serviceDate,
      mealTime: formatTimeInTimeZone(new Date(), timeZone),
      mealType: 'lunch',
      source: candidate.source,
      name: candidate.name,
      caloriesKcal: candidate.caloriesKcal,
      proteinG: candidate.proteinG,
      fatG: candidate.fatG,
      carbsG: candidate.carbsG,
      fiberG: candidate.fiberG,
      sodiumMg: candidate.sodiumMg,
      confidence: null,
      summary: '由午餐推薦確認記錄'
    }).onConflictDoNothing().returning()
    if (created) return { meal: created, duplicate: false }
    const [existing] = await database.select().from(meals).where(and(
      eq(meals.userId, user.id),
      eq(meals.clientRequestId, input.clientRequestId)
    )).limit(1)
    if (!existing) throw createError({ statusCode: 409, statusMessage: 'Lunch could not be recorded' })
    return { meal: existing, duplicate: true }
  })

  setResponseStatus(event, result.duplicate ? 200 : 201)
  return result
})

function optionalNutrient(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const number = Number(record[key])
    if (Number.isFinite(number) && number >= 0) return String(number)
  }
  return null
}
