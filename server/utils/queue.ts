import { PgBoss } from 'pg-boss'
import { AI_QUEUE, AI_PRIORITY, AI_TIMEOUT_SECONDS, type AiJob } from '~/shared/domain/jobs'

let boss: PgBoss | undefined
let starting: Promise<PgBoss> | undefined

export async function useJobQueue() {
  if (boss) return boss
  if (starting) return starting
  const config = useRuntimeConfig()
  if (!config.databaseUrl) throw createError({ statusCode: 503, statusMessage: 'Job queue database is not configured' })

  starting = (async () => {
    const instance = new PgBoss({ connectionString: config.databaseUrl, application_name: 'food-web-queue' })
    instance.on('error', error => console.error('[queue]', error.message))
    await instance.start()
    await instance.createQueue(AI_QUEUE)
    boss = instance
    return instance
  })()
  return starting
}

export async function enqueueAiJob(job: AiJob) {
  const queue = await useJobQueue()
  const id = await queue.send(AI_QUEUE, job, {
    priority: AI_PRIORITY[job.type],
    expireInSeconds: AI_TIMEOUT_SECONDS[job.type],
    retryLimit: 1,
    retryDelay: 2,
    retryBackoff: true
  })
  if (!id) throw createError({ statusCode: 503, statusMessage: 'AI job could not be queued' })
  return id
}
