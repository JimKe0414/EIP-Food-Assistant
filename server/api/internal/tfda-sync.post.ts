import { safeEqual } from '~/server/utils/identity'
import { syncTfdaFromUrl } from '~/server/services/tfda/sync'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getRequestHeader(event, 'x-internal-worker-token') ?? ''
  if (!config.internalWorkerToken || !token || !safeEqual(token, config.internalWorkerToken)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  if (!config.tfdaAutoDownload) {
    return { status: 'disabled', message: 'Automatic TFDA download requires explicit authorization' }
  }
  return syncTfdaFromUrl(config.tfdaNutrientXlsxUrl)
})
