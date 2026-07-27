import { mealBatchInputSchema } from '~/shared/domain/meals'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, value => mealBatchInputSchema.parse(value))
  const timeZone = useRuntimeConfig().appTimeZone

  const results = await withUserScope(user.id, async (database) => {
    const persisted = []
    for (const meal of input.meals) {
      persisted.push(await persistMeal(database, user.id, meal, timeZone))
    }
    return persisted
  })

  const duplicateCount = results.filter(result => result.duplicate).length
  setResponseStatus(event, duplicateCount === results.length ? 200 : 201)
  return {
    meals: results.map(result => result.meal),
    createdCount: results.length - duplicateCount,
    duplicateCount
  }
})
