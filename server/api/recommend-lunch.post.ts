import { and, desc, eq, gte } from 'drizzle-orm'
import { customFoods, eipMenuItems, meals, nutrientVersions, nutrients } from '~/db/schema'
import { getTfdaFreshness } from '~/shared/domain/tfda'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rate = lunchRecommendationLimiter.consume(user.id)
  if (!rate.allowed) {
    setResponseHeader(event, 'Retry-After', rate.retryAfterSeconds)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
  }

  const body = await readBody<{ goal?: string, serviceDate?: string }>(event)
  const serviceDate = body.serviceDate || new Date().toISOString().slice(0, 10)
  const goal = String(body.goal || '均衡飲食').slice(0, 80)
  const scoped = await withUserScope(user.id, async database => {
    const eip = await database.select().from(eipMenuItems).where(and(eq(eipMenuItems.userId, user.id), eq(eipMenuItems.serviceDate, serviceDate))).limit(60)
    const custom = eip.length ? [] : await database.select().from(customFoods).where(eq(customFoods.userId, user.id)).limit(60)
    const [version] = await database.select().from(nutrientVersions).orderBy(desc(nutrientVersions.syncedAt)).limit(1)
    const freshness = getTfdaFreshness(version?.syncedAt ?? null)
    const publicFoods = eip.length || custom.length || freshness.status === 'expired'
      ? []
      : await database.select().from(nutrients).limit(60)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
    const recent = await database.select({ name: meals.name }).from(meals).where(and(eq(meals.userId, user.id), gte(meals.mealDate, sevenDaysAgo))).orderBy(desc(meals.mealDate)).limit(50)
    return {
      freshness,
      recent,
      candidates: [
        ...eip.map(item => ({ id: `eip:${item.id}`, source: 'eip', name: item.name, caloriesKcal: Number(item.caloriesKcal), proteinG: numberOrNull(item.proteinG), fatG: numberOrNull(item.fatG), carbsG: numberOrNull(item.carbsG) })),
        ...custom.map(item => ({ id: `custom:${item.id}`, source: 'custom', name: item.name, caloriesKcal: Number(item.caloriesKcal), proteinG: numberOrNull(item.proteinG), fatG: numberOrNull(item.fatG), carbsG: numberOrNull(item.carbsG) })),
        ...publicFoods.map(item => ({ id: `tfda:${item.sampleId}`, source: 'tfda', name: item.name, caloriesKcal: Number(item.caloriesKcal ?? 0), proteinG: numberOrNull(item.proteinG), fatG: numberOrNull(item.fatG), carbsG: numberOrNull(item.carbsG) }))
      ]
    }
  })
  const { candidates, freshness, recent } = scoped
  if (!candidates.length) throw createError({ statusCode: 503, statusMessage: 'No lunch candidates are currently available' })

  const jobId = await enqueueAiJob({
    type: 'recommendLunch',
    userId: user.id,
    context: { goal, candidateIds: candidates.map(candidate => candidate.id), recentMealNames: recent.map(item => item.name), nutrientTargets: {} }
  })

  setResponseStatus(event, 202)
  return {
    jobId,
    statusUrl: `/api/jobs/${jobId}`,
    candidates,
    nutrientFreshness: freshness,
    warning: freshness.status === 'stale' ? `營養資料可能較舊（${freshness.ageDays} 天前更新）` : undefined,
    rateLimitRemaining: rate.remaining
  }
})

function numberOrNull(value: string | null) { return value === null ? null : Number(value) }
