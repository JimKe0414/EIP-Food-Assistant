import { mealInputSchema } from '~/shared/domain/meals'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, value => mealInputSchema.parse(value))
  const timeZone = useRuntimeConfig().appTimeZone
  const result = await withUserScope(user.id, database => persistMeal(database, user.id, input, timeZone))
  setResponseStatus(event, result.duplicate ? 200 : 201)
  return result
})
