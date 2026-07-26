import { AI_QUEUE, aiJobSchema } from '~/shared/domain/jobs'
import { enforceLunchRecommendationPolicy, lunchRecommendationSchema } from '~/shared/domain/ai'
import { eipMenuImportResultSchema } from '~/shared/domain/eip-catalog'

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

  // The AI queue processes strictly one job at a time (see worker/index.ts's localConcurrency:1
  // guard), so while your own job is still waiting/running, "how many others are ready or
  // active right now" is a fair "you're queued, not stuck" signal for the client to show.
  let queueDepth: number | undefined
  if (job.state !== 'completed' && job.state !== 'failed') {
    const [stats] = await boss.getQueueStats(AI_QUEUE, { force: true })
    queueDepth = stats ? Math.max(0, stats.readyCount + stats.activeCount - 1) : undefined
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
  if (job.state === 'completed' && data.data.type === 'estimateEipMenuNutrition') {
    const parsed = eipMenuImportResultSchema.safeParse(output)
    output = parsed.success ? parsed.data : undefined
  }

  // pg-boss stores { message, stack } as the job's output when a handler throws — surface the
  // real message (e.g. "HTTP 403: IP not allowed") instead of a one-size-fits-all string, so a
  // config/auth/rate-limit problem is diagnosable from the UI instead of requiring a DB query.
  const failureMessage = job.state === 'failed' && job.output && typeof job.output === 'object' && 'message' in job.output
    ? String((job.output as { message?: unknown }).message)
    : 'AI task failed'

  return {
    id: job.id,
    state: job.state,
    output,
    queueDepth,
    error: job.state === 'failed' ? { code: 'AI_JOB_FAILED', message: failureMessage } : undefined,
    createdAt: job.createdOn,
    completedAt: job.completedOn
  }
})
