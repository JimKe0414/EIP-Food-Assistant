import { z } from 'zod'
import { nutrientSummarySchema } from './ai'

export const mealInputSchema = z.object({
  clientRequestId: z.string().trim().min(1).max(100).optional(),
  mealDate: z.iso.date(),
  mealTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  source: z.enum(['manual', 'photo', 'voice', 'eip', 'custom', 'tfda']),
  name: z.string().trim().min(1).max(160),
  confidence: z.number().min(0).max(1).nullable().optional(),
  confirmed: z.literal(true),
  nutrients: nutrientSummarySchema,
  summary: z.string().trim().max(500).nullable().optional().default(null)
})

export const mealBatchInputSchema = z.object({
  meals: z.array(mealInputSchema).min(1).max(10)
})

export const mealUpdateInputSchema = z.object({
  mealDate: z.iso.date(),
  mealTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  name: z.string().trim().min(1).max(160),
  nutrients: nutrientSummarySchema,
  summary: z.string().trim().max(500).nullable().default(null)
})

export const mealAnalysisInputSchema = z.object({
  mode: z.enum(['text', 'photo', 'voice']),
  text: z.string().trim().max(2000).optional(),
  imageBase64: z.string().max(15_000_000).optional(),
  mimeType: z.string().max(100).optional(),
  audioBase64: z.string().max(30_000_000).optional()
})

export type MealInput = z.infer<typeof mealInputSchema>
export type MealUpdateInput = z.infer<typeof mealUpdateInputSchema>

export const mealTypeOrder: Record<MealInput['mealType'], number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3
}

export function compareMealsByTypeThenRecordedAt(
  left: Pick<MealInput, 'mealType'> & { createdAt: string | Date },
  right: Pick<MealInput, 'mealType'> & { createdAt: string | Date }
) {
  const typeDifference = mealTypeOrder[left.mealType] - mealTypeOrder[right.mealType]
  if (typeDifference !== 0) return typeDifference
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
}
