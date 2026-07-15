import { syncTfdaFromBuffer, syncTfdaFromUrl } from '~/server/services/tfda/sync'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Administrator access required' })
  const config = useRuntimeConfig()
  const contentType = getRequestHeader(event, 'content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    const file = parts?.find(part => part.name === 'file' && part.filename)
    if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'TFDA XLSX file is required' })
    return syncTfdaFromBuffer(file.data)
  }

  if (!config.tfdaAutoDownload) {
    throw createError({ statusCode: 403, statusMessage: 'Automatic TFDA download is disabled; upload an authorized XLSX file' })
  }
  return syncTfdaFromUrl(config.tfdaNutrientXlsxUrl)
})
