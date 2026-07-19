import { z } from 'zod'
import { nutrientSummarySchema } from './ai'

export const mealInputSchema = z.object({
  mealDate: z.iso.date(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  source: z.enum(['manual', 'photo', 'voice', 'eip', 'custom']),
  name: z.string().trim().min(1).max(160),
  confidence: z.number().min(0).max(1).nullable().optional(),
  confirmed: z.literal(true),
  nutrients: nutrientSummarySchema,
  summary: z.string().trim().max(500).nullable().optional().default(null)
})

export const mealAnalysisInputSchema = z.object({
  mode: z.enum(['text', 'photo', 'voice']),
  text: z.string().trim().max(2000).optional(),
  imageBase64: z.string().max(15_000_000).optional(),
  mimeType: z.string().max(100).optional(),
  audioBase64: z.string().max(30_000_000).optional()
})

export type MealInput = z.infer<typeof mealInputSchema>
