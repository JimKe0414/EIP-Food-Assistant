import { z } from 'zod'
import { upsertEipCatalog } from '~/server/services/eip/catalog'
import { eipCatalogItemSchema, eipMenuImportResultSchema } from '~/shared/domain/eip-catalog'
import { safeEqual } from '~/server/utils/identity'

const bodySchema = z.object({
  items: z.array(eipCatalogItemSchema).min(1).max(200),
  estimated: z.number().int().positive().max(200)
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getRequestHeader(event, 'x-internal-worker-token') ?? ''
  if (!config.internalWorkerToken || !token || !safeEqual(token, config.internalWorkerToken)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const input = await readValidatedBody(event, value => bodySchema.parse(value))
  const result = await upsertEipCatalog(input.items)
  return eipMenuImportResultSchema.parse({ ...result, estimated: input.estimated })
})
