import { EipMenuImportError, parseEipMenuCatalog } from '~/server/services/eip/menu-parser'
import { upsertEipCatalog } from '~/server/services/eip/catalog'
import {
  completeEipCatalogWithoutAi,
  deduplicateEipCatalogItems,
  missingEipNutritionFields
} from '~/shared/domain/eip-catalog'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const files = await readMultipartFormData(event)
  const file = files?.find(part => part.name === 'file' && part.filename)
  if (!file?.data || !file.filename) throw createError({ statusCode: 400, statusMessage: 'EIP menu file is required' })

  try {
    const parsed = parseEipMenuCatalog(file.data, file.filename)
    const rows = deduplicateEipCatalogItems(parsed.rows)
    const estimated = rows.filter(row => missingEipNutritionFields(row).length > 0).length
    if (estimated > 200) {
      throw new EipMenuImportError('TOO_MANY_AI_ESTIMATES', '單次匯入最多可由 AI 估算 200 筆餐點；請分批匯入')
    }
    if (estimated > 0) {
      const jobId = await enqueueAiJob({
        type: 'estimateEipMenuNutrition',
        userId: user.id,
        fileHash: parsed.fileHash,
        items: rows
      })
      setResponseStatus(event, 202)
      return {
        pending: true as const,
        jobId,
        statusUrl: `/api/jobs/${jobId}`,
        imported: rows.length,
        estimated
      }
    }

    const result = await upsertEipCatalog(completeEipCatalogWithoutAi(rows))
    setResponseStatus(event, result.inserted ? 201 : 200)
    return { pending: false as const, ...result, estimated: 0, fileHash: parsed.fileHash }
  } catch (error) {
    if (error instanceof EipMenuImportError) {
      throw createError({ statusCode: 400, statusMessage: error.message, data: { code: error.code } })
    }
    throw error
  }
})
