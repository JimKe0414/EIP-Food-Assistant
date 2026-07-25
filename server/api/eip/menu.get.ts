import { and, desc, eq, inArray } from 'drizzle-orm'
import { eipMenuItems } from '~/db/schema'
import { formatDateInTimeZone } from '~/shared/domain/date'
import { lunchFoodTypeSchema } from '~/shared/domain/ai'
import { z } from 'zod'

const querySchema = z.object({
  serviceDate: z.iso.date().optional(),
  foodType: lunchFoodTypeSchema.default('meat')
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = querySchema.parse(getQuery(event))
  const serviceDate = query.serviceDate ?? formatDateInTimeZone(new Date(), useRuntimeConfig().appTimeZone)
  const foodTypes = query.foodType === 'veg' ? ['veg'] as const : ['meat', 'unknown'] as const
  const rows = await withUserScope(user.id, database => database.select().from(eipMenuItems).where(and(
    eq(eipMenuItems.userId, user.id),
    eq(eipMenuItems.serviceDate, serviceDate),
    inArray(eipMenuItems.foodType, foodTypes)
  )).orderBy(desc(eipMenuItems.importedAt)).limit(200))

  return {
    serviceDate,
    foodType: query.foodType,
    vendorNames: [...new Set(rows.map(row => row.vendorName).filter((name): name is string => Boolean(name)))],
    items: rows.map(row => ({
      id: `eip:${row.id}`,
      source: 'eip' as const,
      name: row.name,
      caloriesKcal: Number(row.caloriesKcal),
      proteinG: numberOrNull(row.proteinG),
      fatG: numberOrNull(row.fatG),
      carbsG: numberOrNull(row.carbsG),
      fiberG: null,
      sodiumMg: numberOrNull(row.sodiumMg),
      importedAt: row.importedAt
    }))
  }
})

function numberOrNull(value: string | null) {
  return value === null ? null : Number(value)
}
