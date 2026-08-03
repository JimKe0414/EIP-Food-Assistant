import { z } from 'zod'
import { nutrientSummarySchema } from '~/shared/domain/ai'
import { upsertEipCatalog } from '~/server/services/eip/catalog'

const menuUploadSchema = z.object({
  restaurantName: z.string().trim().min(1).max(120),
  foodType: z.enum(['meat', 'veg', 'unknown']),
  items: z.array(z.object({ name: z.string().trim().min(1).max(160), nutrients: nutrientSummarySchema })).min(1).max(200)
})

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const input = await readValidatedBody(event, value => menuUploadSchema.parse(value))
  const result = await upsertEipCatalog(input.items.map(item => ({
    restaurantName: input.restaurantName,
    name: item.name,
    foodType: input.foodType,
    nutrients: item.nutrients,
    nutritionEstimated: false
  })))
  setResponseStatus(event, result.inserted ? 201 : 200)
  return result
})
