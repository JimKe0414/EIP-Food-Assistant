import { meals } from '~/db/schema'
import { mealInputSchema } from '~/shared/domain/meals'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, value => mealInputSchema.parse(value))
  const [meal] = await withUserScope(user.id, database => database.insert(meals).values({
    userId: user.id,
    mealDate: input.mealDate,
    mealType: input.mealType,
    source: input.source,
    name: input.name,
    caloriesKcal: String(input.nutrients.caloriesKcal),
    proteinG: nullableNumber(input.nutrients.proteinG),
    fatG: nullableNumber(input.nutrients.fatG),
    carbsG: nullableNumber(input.nutrients.carbsG),
    fiberG: nullableNumber(input.nutrients.fiberG),
    sodiumMg: nullableNumber(input.nutrients.sodiumMg),
    confidence: input.confidence == null ? null : String(input.confidence),
    summary: input.summary ?? null
  }).returning())
  setResponseStatus(event, 201)
  return { meal }
})

function nullableNumber(value: number | null) {
  return value === null ? null : String(value)
}
