import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { customFoods, eipMenuItems, meals, nutrientVersions, nutrients, profileSnapshots } from '~/db/schema'
import { calculateBodyMetrics } from '~/shared/domain/body-metrics'
import { getMockLunchCandidates } from '~/server/services/lunch/mock-candidates'
import { getTfdaFreshness } from '~/shared/domain/tfda'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rate = lunchRecommendationLimiter.consume(user.id)
  if (!rate.allowed) {
    setResponseHeader(event, 'Retry-After', rate.retryAfterSeconds)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
  }

  const body = await readBody<{ goal?: string, foodType?: string, serviceDate?: string, useMockData?: boolean }>(event)
  const serviceDate = body.serviceDate || new Date().toISOString().slice(0, 10)
  const goal = String(body.goal || '均衡飲食').slice(0, 80)
  const foodType = body.foodType === 'veg' ? 'veg' : 'meat'
  const useMockData = body.useMockData === true
  const scoped = useMockData ? {
    freshness: getTfdaFreshness(new Date()),
    recent: foodType === 'veg'
      ? [{ name: '香煎豆腐餐盒' }, { name: '鷹嘴豆沙拉' }]
      : [{ name: '香煎雞腿便當' }, { name: '雞肉沙拉' }],
    snapshot: null,
    eatenToday: null,
    candidates: getMockLunchCandidates(foodType)
  } : await withUserScope(user.id, async database => {
    const eip = await database.select().from(eipMenuItems).where(and(eq(eipMenuItems.userId, user.id), eq(eipMenuItems.serviceDate, serviceDate))).limit(60)
    const custom = eip.length ? [] : await database.select().from(customFoods).where(eq(customFoods.userId, user.id)).limit(60)
    const [version] = await database.select().from(nutrientVersions).orderBy(desc(nutrientVersions.syncedAt)).limit(1)
    const freshness = getTfdaFreshness(version?.syncedAt ?? null)
    const publicFoods = eip.length || custom.length || freshness.status === 'expired'
      ? []
      : await database.select().from(nutrients).limit(60)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
    const recent = await database.select({ name: meals.name }).from(meals).where(and(eq(meals.userId, user.id), gte(meals.mealDate, sevenDaysAgo))).orderBy(desc(meals.mealDate)).limit(50)

    const [snapshot] = await database.select().from(profileSnapshots).where(eq(profileSnapshots.userId, user.id)).orderBy(desc(profileSnapshots.measuredAt)).limit(1)
    const [eatenToday] = snapshot
      ? await database.select({
          caloriesKcal: sql<string>`coalesce(sum(${meals.caloriesKcal}), 0)`,
          proteinG: sql<string>`coalesce(sum(${meals.proteinG}), 0)`,
          fatG: sql<string>`coalesce(sum(${meals.fatG}), 0)`,
          carbsG: sql<string>`coalesce(sum(${meals.carbsG}), 0)`
        }).from(meals).where(and(eq(meals.userId, user.id), eq(meals.mealDate, serviceDate)))
      : [null]

    return {
      freshness,
      recent,
      snapshot,
      eatenToday,
      candidates: [
        ...eip.map(item => ({ id: `eip:${item.id}`, source: 'eip', name: item.name, caloriesKcal: Number(item.caloriesKcal), proteinG: numberOrNull(item.proteinG), fatG: numberOrNull(item.fatG), carbsG: numberOrNull(item.carbsG) })),
        ...custom.map(item => ({ id: `custom:${item.id}`, source: 'custom', name: item.name, caloriesKcal: Number(item.caloriesKcal), proteinG: numberOrNull(item.proteinG), fatG: numberOrNull(item.fatG), carbsG: numberOrNull(item.carbsG) })),
        ...publicFoods.map(item => ({ id: `tfda:${item.sampleId}`, source: 'tfda', name: item.name, caloriesKcal: Number(item.caloriesKcal ?? 0), proteinG: numberOrNull(item.proteinG), fatG: numberOrNull(item.fatG), carbsG: numberOrNull(item.carbsG) }))
      ]
    }
  })
  const { candidates, freshness, recent, snapshot, eatenToday } = scoped
  if (!candidates.length) throw createError({ statusCode: 503, statusMessage: 'No lunch candidates are currently available' })

  // Budget remaining *for the rest of today* (daily target minus what's already been
  // logged), not the flat daily target — the AI should be picking a lunch that fits what's
  // left, not re-suggesting the user's entire day's allowance in one meal.
  const nutrientTargets = snapshot && eatenToday
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
        const remaining = (target: number, eaten: string) => Math.max(0, Math.round(target - Number(eaten)))
        return {
          caloriesKcal: remaining(metrics.tdee, eatenToday.caloriesKcal),
          proteinG: remaining(metrics.proteinTargetG, eatenToday.proteinG),
          fatG: remaining(metrics.fatTargetG, eatenToday.fatG),
          carbsG: remaining(metrics.carbsTargetG, eatenToday.carbsG)
        }
      })()
    : {}

  const jobId = await enqueueAiJob({
    type: 'recommendLunch',
    userId: user.id,
    context: {
      goal,
      foodType,
      candidateIds: candidates.map(candidate => candidate.id),
      candidates,
      recentMealNames: recent.map(item => item.name),
      nutrientTargets
    }
  })

  setResponseStatus(event, 202)
  return {
    jobId,
    statusUrl: `/api/jobs/${jobId}`,
    candidates,
    nutrientFreshness: freshness,
    dataMode: useMockData ? 'mock' : 'live',
    warning: useMockData
      ? 'FocusIT API 已使用固定假菜單完成測試'
      : freshness.status === 'stale' ? `營養資料可能較舊（${freshness.ageDays} 天前更新）` : undefined,
    rateLimitRemaining: rate.remaining
  }
})

function numberOrNull(value: string | null) { return value === null ? null : Number(value) }
