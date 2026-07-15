import { z } from 'zod'
import { eipMenuItems } from '~/db/schema'
import { nutrientSummarySchema } from '~/shared/domain/ai'

const menuUploadSchema = z.object({
  serviceDate: z.iso.date(),
  vendorName: z.string().trim().min(1).max(120),
  foodType: z.enum(['meat', 'veg', 'unknown']),
  items: z.array(z.object({ name: z.string().trim().min(1).max(160), nutrients: nutrientSummarySchema })).min(1).max(200)
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, value => menuUploadSchema.parse(value))
  const rows = await withUserScope(user.id, database => database.insert(eipMenuItems).values(input.items.map(item => ({
    userId: user.id,
    serviceDate: input.serviceDate,
    vendorName: input.vendorName,
    foodType: input.foodType,
    name: item.name,
    caloriesKcal: String(item.nutrients.caloriesKcal),
    proteinG: optional(item.nutrients.proteinG),
    fatG: optional(item.nutrients.fatG),
    carbsG: optional(item.nutrients.carbsG),
    sodiumMg: optional(item.nutrients.sodiumMg)
  }))).returning({ id: eipMenuItems.id }))
  setResponseStatus(event, 201)
  return { imported: rows.length, ids: rows.map(row => row.id) }
})

function optional(value: number | null) { return value === null ? null : String(value) }
