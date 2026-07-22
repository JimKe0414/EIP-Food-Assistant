import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { meals, profileSnapshots } from '~/db/schema'
import { calculateBodyMetrics } from '~/shared/domain/body-metrics'

interface DailyTotals {
  date: string
  caloriesKcal: number
  proteinG: number
  fatG: number
  carbsG: number
  fiberG: number
  sodiumMg: number
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const today = new Date().toISOString().slice(0, 10)
  const weekStart = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)

  const { rows, snapshot } = await withUserScope(user.id, async database => {
    const rows = await database.select({
      mealDate: meals.mealDate,
      caloriesKcal: sql<string>`coalesce(sum(${meals.caloriesKcal}), 0)`,
      proteinG: sql<string>`coalesce(sum(${meals.proteinG}), 0)`,
      fatG: sql<string>`coalesce(sum(${meals.fatG}), 0)`,
      carbsG: sql<string>`coalesce(sum(${meals.carbsG}), 0)`,
      fiberG: sql<string>`coalesce(sum(${meals.fiberG}), 0)`,
      sodiumMg: sql<string>`coalesce(sum(${meals.sodiumMg}), 0)`
    }).from(meals)
      .where(and(eq(meals.userId, user.id), gte(meals.mealDate, weekStart), lte(meals.mealDate, today)))
      .groupBy(meals.mealDate)

    const [snapshot] = await database.select().from(profileSnapshots)
      .where(eq(profileSnapshots.userId, user.id))
      .orderBy(desc(profileSnapshots.measuredAt))
      .limit(1)

    return { rows, snapshot }
  })

  const byDate = new Map(rows.map(row => [row.mealDate, row]))
  const daily: DailyTotals[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86_400_000).toISOString().slice(0, 10)
    const row = byDate.get(date)
    return {
      date,
      caloriesKcal: Number(row?.caloriesKcal ?? 0),
      proteinG: Number(row?.proteinG ?? 0),
      fatG: Number(row?.fatG ?? 0),
      carbsG: Number(row?.carbsG ?? 0),
      fiberG: Number(row?.fiberG ?? 0),
      sodiumMg: Number(row?.sodiumMg ?? 0)
    }
  })

  const targets = snapshot
    ? (() => {
        const metrics = calculateBodyMetrics({
          age: snapshot.age,
          sex: snapshot.sex,
          height: Number(snapshot.heightCm),
          weight: Number(snapshot.weightKg),
          bodyFat: snapshot.bodyFatPercent === null ? null : Number(snapshot.bodyFatPercent),
          muscle: snapshot.muscleKg === null ? null : Number(snapshot.muscleKg),
          activity: Number(snapshot.activityFactor)
        })
        return { caloriesKcal: metrics.tdee, proteinG: metrics.proteinTargetG, fatG: metrics.fatTargetG, carbsG: metrics.carbsTargetG }
      })()
    : null

  return { today: daily[daily.length - 1], daily, targets }
})
