import { eipOrders, mealImportBatches, meals } from '~/db/schema'
import { EipImportError, parseEipExport } from '~/server/services/eip/parser'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const files = await readMultipartFormData(event)
  const file = files?.find(part => part.name === 'file' && part.filename)
  if (!file?.data || !file.filename) throw createError({ statusCode: 400, statusMessage: 'EIP export file is required' })

  try {
    const config = useRuntimeConfig()
    const parsed = parseEipExport(file.data, file.filename, user.identityHmac, config.identityHmacSecret)
    const result = await withUserScope(user.id, async database => {
      const [batch] = await database.insert(mealImportBatches).values({
        userId: user.id,
        fileHash: parsed.fileHash,
        rowCount: parsed.rows.length
      }).onConflictDoNothing().returning({ id: mealImportBatches.id })
      if (!batch) return { duplicate: true }

      await database.insert(eipOrders).values(parsed.rows.map(row => ({
        userId: user.id,
        mealDate: row.mealDate,
        name: row.name,
        caloriesKcal: String(row.caloriesKcal),
        proteinG: optional(row.proteinG),
        fatG: optional(row.fatG),
        carbsG: optional(row.carbsG),
        sodiumMg: optional(row.sodiumMg)
      })))
      await database.insert(meals).values(parsed.rows.map((row, index) => ({
        userId: user.id,
        clientRequestId: `eip:${parsed.fileHash}:${index}`,
        mealDate: row.mealDate,
        mealTime: '12:00:00',
        mealType: 'lunch' as const,
        source: 'eip' as const,
        name: row.name,
        caloriesKcal: String(row.caloriesKcal),
        proteinG: optional(row.proteinG),
        fatG: optional(row.fatG),
        carbsG: optional(row.carbsG),
        fiberG: null,
        sodiumMg: optional(row.sodiumMg),
        confidence: null,
        summary: '由 EIP 個人點餐紀錄匯入'
      }))).onConflictDoNothing()
      return { duplicate: false }
    })
    setResponseStatus(event, result.duplicate ? 200 : 201)
    return {
      imported: result.duplicate ? 0 : parsed.rows.length,
      recordedMeals: result.duplicate ? 0 : parsed.rows.length,
      duplicate: result.duplicate,
      fileHash: parsed.fileHash
    }
  } catch (error) {
    if (error instanceof EipImportError) {
      throw createError({ statusCode: 400, statusMessage: error.message, data: { code: error.code } })
    }
    throw error
  }
})

function optional(value: number | null) { return value === null ? null : String(value) }
