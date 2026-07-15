import { z } from 'zod'
import { lunchContextSchema, textOrImageSchema } from './ai'

export const aiJobSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('analyzeMeal'), userId: z.string().uuid(), input: textOrImageSchema }),
  z.object({ type: z.literal('transcribeMeal'), userId: z.string().uuid(), audioBase64: z.string().max(30_000_000), mimeType: z.string().max(100) }),
  z.object({ type: z.literal('recommendLunch'), userId: z.string().uuid(), context: lunchContextSchema })
])

export type AiJob = z.infer<typeof aiJobSchema>

export const AI_QUEUE = 'ai-tasks'
export const TFDA_QUEUE = 'tfda-sync'
export const AI_PRIORITY = { analyzeMeal: 30, transcribeMeal: 20, recommendLunch: 10 } as const
export const AI_TIMEOUT_SECONDS = { analyzeMeal: 30, transcribeMeal: 60, recommendLunch: 20 } as const
