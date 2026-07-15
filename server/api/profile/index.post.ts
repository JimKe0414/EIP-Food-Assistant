import { profileSnapshots } from '~/db/schema'
import { calculateBodyMetrics, profileInputSchema } from '~/shared/domain/body-metrics'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const profile = await readValidatedBody(event, value => profileInputSchema.parse(value))
  const [snapshot] = await withUserScope(user.id, database => database.insert(profileSnapshots).values({
    userId: user.id,
    age: profile.age,
    sex: profile.sex,
    heightCm: String(profile.height),
    weightKg: String(profile.weight),
    bodyFatPercent: profile.bodyFat === null ? null : String(profile.bodyFat),
    muscleKg: profile.muscle === null ? null : String(profile.muscle),
    activityFactor: String(profile.activity)
  }).returning())
  setResponseStatus(event, 201)
  return { id: snapshot.id, profile, metrics: calculateBodyMetrics(profile), measuredAt: snapshot.measuredAt }
})
