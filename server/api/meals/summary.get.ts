import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { meals, profileSnapshots } from '~/db/schema'
import { calculateBodyMetrics } from '~/shared/domain/body-metrics'
import { formatDateInTimeZone, isoDateRangeEndingOn } from '~/shared/domain/date'
import { compareMealsByTypeThenRecordedAt } from '~/shared/domain/meals'

interface DailyTotals {
  date: string
  caloriesKcal: number
  proteinG: number
  fatG: number
  carbsG: number
  fiberG: number
  sodiumMg: number
  mealCount: number
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const config = useRuntimeConfig()
  const today = formatDateInTimeZone(new Date(), config.appTimeZone)
  const dates = isoDateRangeEndingOn(today, 7)
  const weekStart = dates[0]

  const { rows, snapshot, todayMeals, totalMealCount } = await withUserScope(user.id, async database => {
    const rows = await database.select({
      mealDate: meals.mealDate,
      caloriesKcal: sql<string>`coalesce(sum(${meals.caloriesKcal}), 0)`,
      proteinG: sql<string>`coalesce(sum(${meals.proteinG}), 0)`,
      fatG: sql<string>`coalesce(sum(${meals.fatG}), 0)`,
      carbsG: sql<string>`coalesce(sum(${meals.carbsG}), 0)`,
      fiberG: sql<string>`coalesce(sum(${meals.fiberG}), 0)`,
      sodiumMg: sql<string>`coalesce(sum(${meals.sodiumMg}), 0)`,
      mealCount: sql<string>`count(*)`
    }).from(meals)
      .where(and(eq(meals.userId, user.id), gte(meals.mealDate, weekStart), lte(meals.mealDate, today)))
      .groupBy(meals.mealDate)

    const [snapshot] = await database.select().from(profileSnapshots)
      .where(eq(profileSnapshots.userId, user.id))
      .orderBy(desc(profileSnapshots.measuredAt))
      .limit(1)

    const todayMeals = await database.select().from(meals)
      .where(and(eq(meals.userId, user.id), eq(meals.mealDate, today)))
      .orderBy(desc(meals.createdAt))
      .limit(100)

    const [total] = await database.select({
      mealCount: sql<string>`count(*)`
    }).from(meals).where(eq(meals.userId, user.id))

    return { rows, snapshot, todayMeals, totalMealCount: Number(total?.mealCount ?? 0) }
  })

  const byDate = new Map(rows.map(row => [row.mealDate, row]))
  const daily: DailyTotals[] = dates.map((date) => {
    const row = byDate.get(date)
    return {
      date,
      caloriesKcal: Number(row?.caloriesKcal ?? 0),
      proteinG: Number(row?.proteinG ?? 0),
      fatG: Number(row?.fatG ?? 0),
      carbsG: Number(row?.carbsG ?? 0),
      fiberG: Number(row?.fiberG ?? 0),
      sodiumMg: Number(row?.sodiumMg ?? 0),
      mealCount: Number(row?.mealCount ?? 0)
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

  return {
    today: daily[daily.length - 1],
    daily,
    targets,
    totalMealCount,
    todayMeals: todayMeals.sort(compareMealsByTypeThenRecordedAt).map(meal => ({
      id: meal.id,
      mealDate: meal.mealDate,
      mealTime: meal.mealTime,
      mealType: meal.mealType,
      source: meal.source,
      name: meal.name,
      caloriesKcal: Number(meal.caloriesKcal),
      proteinG: numberOrNull(meal.proteinG),
      fatG: numberOrNull(meal.fatG),
      carbsG: numberOrNull(meal.carbsG),
      fiberG: numberOrNull(meal.fiberG),
      sodiumMg: numberOrNull(meal.sodiumMg),
      confidence: numberOrNull(meal.confidence),
      summary: meal.summary,
      createdAt: meal.createdAt
    }))
  }
})

function numberOrNull(value: string | null) {
  return value === null ? null : Number(value)
}
