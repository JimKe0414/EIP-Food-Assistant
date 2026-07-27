import { and, eq } from 'drizzle-orm'
import { eipRestaurants, userDailyRestaurantSelections } from '~/db/schema'
import { z } from 'zod'

const selectionSchema = z.object({
  serviceDate: z.iso.date(),
  restaurantId: z.uuid().nullable()
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, value => selectionSchema.parse(value))

  if (input.restaurantId) {
    const [restaurant] = await useDatabase().select({
      id: eipRestaurants.id,
      name: eipRestaurants.name
    }).from(eipRestaurants).where(eq(eipRestaurants.id, input.restaurantId)).limit(1)
    if (!restaurant) throw createError({ statusCode: 404, statusMessage: 'Restaurant not found' })

    await withUserScope(user.id, database => database.insert(userDailyRestaurantSelections).values({
      userId: user.id,
      serviceDate: input.serviceDate,
      restaurantId: restaurant.id
    }).onConflictDoUpdate({
      target: [userDailyRestaurantSelections.userId, userDailyRestaurantSelections.serviceDate],
      set: { restaurantId: restaurant.id, updatedAt: new Date() }
    }))
    return { serviceDate: input.serviceDate, restaurant }
  }

  await withUserScope(user.id, database => database.delete(userDailyRestaurantSelections).where(and(
    eq(userDailyRestaurantSelections.userId, user.id),
    eq(userDailyRestaurantSelections.serviceDate, input.serviceDate)
  )))
  return { serviceDate: input.serviceDate, restaurant: null }
})
