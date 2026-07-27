import { and, eq } from 'drizzle-orm'
import { eipRestaurants, userDailyRestaurantSelections } from '~/db/schema'
import { formatDateInTimeZone } from '~/shared/domain/date'
import { z } from 'zod'

const querySchema = z.object({
  serviceDate: z.iso.date().optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = querySchema.parse(getQuery(event))
  const serviceDate = query.serviceDate ?? formatDateInTimeZone(new Date(), useRuntimeConfig().appTimeZone)
  const [selection] = await withUserScope(user.id, database => database.select({
    restaurantId: eipRestaurants.id,
    restaurantName: eipRestaurants.name
  }).from(userDailyRestaurantSelections)
    .innerJoin(eipRestaurants, eq(eipRestaurants.id, userDailyRestaurantSelections.restaurantId))
    .where(and(
      eq(userDailyRestaurantSelections.userId, user.id),
      eq(userDailyRestaurantSelections.serviceDate, serviceDate)
    ))
    .limit(1))

  return {
    serviceDate,
    restaurant: selection
      ? { id: selection.restaurantId, name: selection.restaurantName }
      : null
  }
})
