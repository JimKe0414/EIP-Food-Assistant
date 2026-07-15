import { eipOrders, mealImportBatches } from '~/db/schema'
import { EipImportError, parseEipExport } from '~/server/services/eip/parser'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const files = await readMultipartFormData(event)
  const file = files?.find(part => part.name === 'file' && part.filename)
  if (!file?.data || !file.filename) throw createError({ statusCode: 400, statusMessage: 'EIP export file is required' })

  try {
    const config = useRuntimeConfig()
    const parsed = parseEipExport(file.data, file.filename, user.identityHmac, config.identityHmacSecret)
    await withUserScope(user.id, async database => {
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
      await database.insert(mealImportBatches).values({ userId: user.id, fileHash: parsed.fileHash, rowCount: parsed.rows.length })
    })
    setResponseStatus(event, 201)
    return { imported: parsed.rows.length, fileHash: parsed.fileHash }
  } catch (error) {
    if (error instanceof EipImportError) {
      throw createError({ statusCode: 400, statusMessage: error.message, data: { code: error.code } })
    }
    throw error
  }
})

function optional(value: number | null) { return value === null ? null : String(value) }
