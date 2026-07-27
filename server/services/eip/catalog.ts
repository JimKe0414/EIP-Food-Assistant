import { inArray, sql } from 'drizzle-orm'
import { eipMenuItems, eipRestaurants } from '~/db/schema'
import {
  deduplicateEipCatalogItems,
  normalizeEipCatalogName,
  type EipCatalogItem
} from '~/shared/domain/eip-catalog'

const WRITE_BATCH_SIZE = 500

export async function upsertEipCatalog(items: EipCatalogItem[]) {
  const deduplicated = deduplicateEipCatalogItems(items)
  const restaurantNames = new Map<string, string>()
  for (const item of deduplicated) {
    restaurantNames.set(normalizeEipCatalogName(item.restaurantName), item.restaurantName.trim())
  }

  return useDatabase().transaction(async database => {
    await database.insert(eipRestaurants).values(
      [...restaurantNames].map(([normalizedName, name]) => ({ name, normalizedName }))
    ).onConflictDoUpdate({
      target: eipRestaurants.normalizedName,
      set: {
        name: sql`excluded.name`,
        updatedAt: sql`now()`
      }
    })

    const restaurants = await database.select({
      id: eipRestaurants.id,
      normalizedName: eipRestaurants.normalizedName
    }).from(eipRestaurants).where(inArray(eipRestaurants.normalizedName, [...restaurantNames.keys()]))
    const restaurantIdByName = new Map(restaurants.map(restaurant => [restaurant.normalizedName, restaurant.id]))

    const values = deduplicated.map(item => {
      const restaurantId = restaurantIdByName.get(normalizeEipCatalogName(item.restaurantName))
      if (!restaurantId) throw new Error(`Restaurant was not created: ${item.restaurantName}`)
      return {
        restaurantId,
        foodType: item.foodType,
        name: item.name.trim(),
        normalizedName: normalizeEipCatalogName(item.name),
        caloriesKcal: String(item.nutrients.caloriesKcal),
        proteinG: optional(item.nutrients.proteinG),
        fatG: optional(item.nutrients.fatG),
        carbsG: optional(item.nutrients.carbsG),
        fiberG: optional(item.nutrients.fiberG),
        sodiumMg: optional(item.nutrients.sodiumMg),
        nutritionEstimated: item.nutritionEstimated
      }
    })

    const restaurantIds = [...new Set(values.map(value => value.restaurantId))]
    const existingRows = restaurantIds.length
      ? await database.select({
          restaurantId: eipMenuItems.restaurantId,
          normalizedName: eipMenuItems.normalizedName
        }).from(eipMenuItems).where(inArray(eipMenuItems.restaurantId, restaurantIds))
      : []
    const existingKeys = new Set(existingRows.map(row => `${row.restaurantId}\u0000${row.normalizedName}`))
    const updated = values.filter(value => existingKeys.has(`${value.restaurantId}\u0000${value.normalizedName}`)).length

    for (let index = 0; index < values.length; index += WRITE_BATCH_SIZE) {
      await database.insert(eipMenuItems).values(values.slice(index, index + WRITE_BATCH_SIZE)).onConflictDoUpdate({
        target: [eipMenuItems.restaurantId, eipMenuItems.normalizedName],
        set: {
          foodType: sql`excluded.food_type`,
          name: sql`excluded.name`,
          caloriesKcal: sql`excluded.calories_kcal`,
          proteinG: sql`excluded.protein_g`,
          fatG: sql`excluded.fat_g`,
          carbsG: sql`excluded.carbs_g`,
          fiberG: sql`excluded.fiber_g`,
          sodiumMg: sql`excluded.sodium_mg`,
          nutritionEstimated: sql`excluded.nutrition_estimated`,
          importedAt: sql`now()`
        }
      })
    }

    return {
      restaurants: restaurantNames.size,
      imported: values.length,
      inserted: values.length - updated,
      updated
    }
  })
}

function optional(value: number | null) {
  return value === null ? null : String(value)
}
