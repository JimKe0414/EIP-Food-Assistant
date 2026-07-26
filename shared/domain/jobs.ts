import { z } from 'zod'
import { lunchContextSchema, textOrImageSchema } from './ai'
import { eipCatalogDraftItemSchema } from './eip-catalog'

export const aiJobSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('analyzeMeal'), userId: z.string().uuid(), input: textOrImageSchema }),
  z.object({ type: z.literal('transcribeMeal'), userId: z.string().uuid(), audioBase64: z.string().max(30_000_000), mimeType: z.string().max(100) }),
  z.object({ type: z.literal('recommendLunch'), userId: z.string().uuid(), context: lunchContextSchema }),
  z.object({
    type: z.literal('estimateEipMenuNutrition'),
    userId: z.string().uuid(),
    fileHash: z.string().regex(/^[a-f0-9]{64}$/i),
    items: z.array(eipCatalogDraftItemSchema).min(1).max(200)
  })
])

export type AiJob = z.infer<typeof aiJobSchema>

export const AI_QUEUE = 'ai-tasks'
export const TFDA_QUEUE = 'tfda-sync'
export const AI_PRIORITY = { analyzeMeal: 30, transcribeMeal: 20, recommendLunch: 10, estimateEipMenuNutrition: 5 } as const
export const AI_TIMEOUT_SECONDS = { analyzeMeal: 30, transcribeMeal: 60, recommendLunch: 20, estimateEipMenuNutrition: 360 } as const
