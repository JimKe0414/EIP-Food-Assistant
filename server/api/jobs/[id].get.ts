import { AI_QUEUE, aiJobSchema } from '~/shared/domain/jobs'
import { enforceLunchRecommendationPolicy, lunchRecommendationSchema } from '~/shared/domain/ai'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'Job not found' })

  const boss = await useJobQueue()
  const job = await boss.getJobById<unknown>(AI_QUEUE, id)
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  const data = aiJobSchema.safeParse(job.data)
  if (!data.success || data.data.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  let output = job.state === 'completed' ? job.output : undefined
  if (job.state === 'completed' && data.data.type === 'recommendLunch') {
    const parsed = lunchRecommendationSchema.safeParse(output)
    if (parsed.success) {
      try {
        const safeRecommendation = enforceLunchRecommendationPolicy(data.data.context, parsed.data)
        const candidateIds = safeRecommendation.candidateIds
        output = {
          candidateIds,
          reasonById: Object.fromEntries(candidateIds.map(id => [id, safeRecommendation.reasonById[id] ?? '符合目前條件']))
        }
      } catch {
        output = { candidateIds: [], reasonById: {} }
      }
    } else {
      output = { candidateIds: [], reasonById: {} }
    }
  }

  return {
    id: job.id,
    state: job.state,
    output,
    error: job.state === 'failed' ? { code: 'AI_JOB_FAILED', message: 'AI task failed' } : undefined,
    createdAt: job.createdOn,
    completedAt: job.completedOn
  }
})
