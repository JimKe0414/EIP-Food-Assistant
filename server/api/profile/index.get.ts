import { desc, eq } from 'drizzle-orm'
import { profileSnapshots } from '~/db/schema'
import { calculateBodyMetrics } from '~/shared/domain/body-metrics'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const [snapshot] = await withUserScope(user.id, database => database.select().from(profileSnapshots)
    .where(eq(profileSnapshots.userId, user.id))
    .orderBy(desc(profileSnapshots.measuredAt))
    .limit(1))
  if (!snapshot) return { profile: null, metrics: null }

  const profile = {
    age: snapshot.age,
    sex: snapshot.sex,
    height: Number(snapshot.heightCm),
    weight: Number(snapshot.weightKg),
    bodyFat: snapshot.bodyFatPercent === null ? null : Number(snapshot.bodyFatPercent),
    muscle: snapshot.muscleKg === null ? null : Number(snapshot.muscleKg),
    activity: Number(snapshot.activityFactor)
  }
  return { profile, metrics: calculateBodyMetrics(profile), measuredAt: snapshot.measuredAt }
})
