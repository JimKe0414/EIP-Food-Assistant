import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { eipMenuItems, eipRestaurants } from '~/db/schema'
import { lunchFoodTypeSchema } from '~/shared/domain/ai'
import { z } from 'zod'

const querySchema = z.object({
  foodType: lunchFoodTypeSchema.default('meat'),
  restaurantId: z.preprocess(value => value === '' || value === 'null' ? undefined : value, z.uuid().optional())
})

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = querySchema.parse(getQuery(event))
  const foodTypes = query.foodType === 'veg' ? ['veg'] as const : ['meat', 'unknown'] as const
  const rows = await useDatabase().select({
    id: eipMenuItems.id,
    restaurantId: eipRestaurants.id,
    restaurantName: eipRestaurants.name,
    name: eipMenuItems.name,
    caloriesKcal: eipMenuItems.caloriesKcal,
    proteinG: eipMenuItems.proteinG,
    fatG: eipMenuItems.fatG,
    carbsG: eipMenuItems.carbsG,
    fiberG: eipMenuItems.fiberG,
    sodiumMg: eipMenuItems.sodiumMg,
    nutritionEstimated: eipMenuItems.nutritionEstimated,
    importedAt: eipMenuItems.importedAt
  }).from(eipMenuItems)
    .innerJoin(eipRestaurants, eq(eipRestaurants.id, eipMenuItems.restaurantId))
    .where(and(
      inArray(eipMenuItems.foodType, foodTypes),
      query.restaurantId ? eq(eipMenuItems.restaurantId, query.restaurantId) : undefined
    ))
    .orderBy(asc(eipRestaurants.name), asc(eipMenuItems.name), desc(eipMenuItems.importedAt))
    .limit(300)

  return {
    foodType: query.foodType,
    restaurantId: query.restaurantId ?? null,
    restaurants: [...new Map(rows.map(row => [row.restaurantId, {
      id: row.restaurantId,
      name: row.restaurantName
    }])).values()],
    items: rows.map(row => ({
      id: `eip:${row.id}`,
      source: 'eip' as const,
      restaurantId: row.restaurantId,
      restaurantName: row.restaurantName,
      name: row.name,
      caloriesKcal: Number(row.caloriesKcal),
      proteinG: numberOrNull(row.proteinG),
      fatG: numberOrNull(row.fatG),
      carbsG: numberOrNull(row.carbsG),
      fiberG: numberOrNull(row.fiberG),
      sodiumMg: numberOrNull(row.sodiumMg),
      nutritionEstimated: row.nutritionEstimated,
      importedAt: row.importedAt
    }))
  }
})

function numberOrNull(value: string | null) {
  return value === null ? null : Number(value)
}
