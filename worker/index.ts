import { PgBoss } from 'pg-boss'
import postgres from 'postgres'
import { AiProviderError, enforceLunchRecommendationPolicy } from '../shared/domain/ai'
import {
  eipMenuImportResultSchema,
  mergeEipNutritionEstimates,
  missingEipNutritionFields,
  toEipNutritionEstimateInput,
  type EipCatalogItem,
  type EipNutritionEstimateResult
} from '../shared/domain/eip-catalog'
import { AI_QUEUE, TFDA_QUEUE, aiJobSchema } from '../shared/domain/jobs'
import { aiConfigurationFromEnv, createAiProvider, validateAiConfiguration } from '../server/services/ai'
import { enrichMealAnalysisWithNutrients } from '../server/services/meals/nutrient-match'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const concurrency = Number(process.env.GPU_CONCURRENCY ?? '1')
if (concurrency !== 1) throw new Error('GPU_CONCURRENCY must be exactly 1 to prevent concurrent GPU tasks')

const aiConfig = aiConfigurationFromEnv()
validateAiConfiguration(aiConfig)

const boss = new PgBoss({ connectionString, application_name: 'food-ai-worker' })
const sql = postgres(connectionString, { max: 2, prepare: false })
boss.on('error', error => console.error('[worker:queue]', error.message))

await boss.start()
await boss.createQueue(AI_QUEUE)
await boss.createQueue(TFDA_QUEUE)
await boss.schedule(TFDA_QUEUE, '0 2 * * *', {}, { tz: 'Asia/Taipei', retryLimit: 3, retryDelay: 60, retryBackoff: true })
await boss.work(AI_QUEUE, { batchSize: 1, localConcurrency: 1 }, async ([job]) => {
  const task = aiJobSchema.parse(job.data)
  const started = Date.now()
  const purpose = task.type === 'analyzeMeal' && task.input.imageBase64 ? 'vision' : task.type === 'transcribeMeal' ? 'audio' : 'text'
  const providerName = purpose === 'vision' ? aiConfig.visionProvider : purpose === 'audio' ? aiConfig.audioProvider : aiConfig.textProvider

  try {
    const provider = createAiProvider(aiConfig, purpose)
    let output: object
    if (task.type === 'analyzeMeal') {
      const analyzed = await provider.analyzeMeal(task.input)
      output = await enrichMealAnalysisWithNutrients(analyzed, sql, query => provider.estimatePortionGrams(query))
    } else if (task.type === 'transcribeMeal') output = await provider.transcribeMeal(Buffer.from(task.audioBase64, 'base64'), task.mimeType)
    else if (task.type === 'recommendLunch') output = enforceLunchRecommendationPolicy(task.context, await provider.recommendLunch(task.context))
    else {
      const estimateInputs = task.items
        .filter(item => missingEipNutritionFields(item).length > 0)
        .map(toEipNutritionEstimateInput)
      const estimates: EipNutritionEstimateResult['items'] = []
      for (let index = 0; index < estimateInputs.length; index += 40) {
        const batch = await provider.estimateEipMenuNutrition(estimateInputs.slice(index, index + 40))
        estimates.push(...batch.items)
      }
      const completedItems = mergeEipNutritionEstimates(task.items, { items: estimates })
      const imported = await persistEipMenu(completedItems, estimateInputs.length)
      output = eipMenuImportResultSchema.parse({ ...imported, fileHash: task.fileHash })
    }

    await audit(task.userId, task.type, providerName, 'success', Date.now() - started)
    return output
  } catch (error) {
    const code = error instanceof AiProviderError ? error.code : 'UNEXPECTED_WORKER_ERROR'
    await audit(task.userId, task.type, providerName, 'failed', Date.now() - started, code)
    throw error
  }
})

await boss.work(TFDA_QUEUE, { batchSize: 1, localConcurrency: 1 }, async () => {
  const webUrl = process.env.WEB_INTERNAL_URL || 'http://web:3000'
  const token = process.env.INTERNAL_WORKER_TOKEN || ''
  if (!token) throw new Error('INTERNAL_WORKER_TOKEN is required for scheduled TFDA sync')
  const response = await fetch(`${webUrl.replace(/\/$/, '')}/api/internal/tfda-sync`, {
    method: 'POST',
    headers: { 'x-internal-worker-token': token },
    signal: AbortSignal.timeout(60_000)
  })
  if (!response.ok) throw new Error(`Scheduled TFDA sync returned HTTP ${response.status}`)
  return response.json()
})

console.log('[worker] AI queue started with concurrency=1; TFDA schedule=02:00 Asia/Taipei')

async function audit(userId: string, jobType: string, provider: string, status: string, durationMs: number, errorCode?: string) {
  await sql`
    insert into ai_audit_events (user_id, job_type, provider, status, duration_ms, error_code)
    values (${userId}, ${jobType}, ${provider}, ${status}, ${durationMs}, ${errorCode ?? null})
  `
}

async function persistEipMenu(items: EipCatalogItem[], estimated: number) {
  const webUrl = process.env.WEB_INTERNAL_URL || 'http://web:3000'
  const token = process.env.INTERNAL_WORKER_TOKEN || ''
  if (!token) throw new Error('INTERNAL_WORKER_TOKEN is required for EIP menu import')
  const response = await fetch(`${webUrl.replace(/\/$/, '')}/api/internal/eip-menu-import`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-worker-token': token
    },
    body: JSON.stringify({ items, estimated }),
    signal: AbortSignal.timeout(60_000)
  })
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).trim().slice(0, 500)
    throw new Error(`EIP menu import returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
  }
  return eipMenuImportResultSchema.parse(await response.json())
}

async function shutdown() {
  await boss.stop({ graceful: true, timeout: 10_000 })
  await sql.end({ timeout: 5 })
  process.exit(0)
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
