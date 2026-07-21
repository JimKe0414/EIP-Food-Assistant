import { z } from 'zod'

export const nutrientSummarySchema = z.object({
  caloriesKcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative().nullable().default(null),
  fatG: z.number().nonnegative().nullable().default(null),
  carbsG: z.number().nonnegative().nullable().default(null),
  fiberG: z.number().nonnegative().nullable().default(null),
  sodiumMg: z.number().nonnegative().nullable().default(null)
})

export const mealCandidateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  portionDescription: z.string().trim().max(200).nullable().default(null),
  // The AI's own guess at the portion's weight in grams. This is what lets the frontend
  // scale nutrients by an actual gram amount the user enters, instead of only an abstract
  // "how many times the AI's serving" multiplier. Null when the model couldn't estimate it.
  estimatedGrams: z.number().positive().nullable().default(null),
  confidence: z.number().min(0).max(1),
  nutrients: nutrientSummarySchema
})

export const mealAnalysisResultSchema = z.object({
  candidates: z.array(mealCandidateSchema).min(1).max(10),
  summary: z.string().trim().min(1).max(500)
})

export const transcriptionResultSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  language: z.string().trim().min(2).max(20).default('zh-TW'),
  confidence: z.number().min(0).max(1).nullable().default(null)
})

export const lunchRecommendationSchema = z.object({
  candidateIds: z.array(z.string().trim().min(1).max(100)).min(1).max(10),
  reasonById: z.record(z.string(), z.string().max(300)).default({})
})

export const textOrImageSchema = z.object({
  text: z.string().trim().max(2000).optional(),
  imageBase64: z.string().max(15_000_000).optional(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional()
}).refine(value => Boolean(value.text || value.imageBase64), 'Text or image is required')

export const lunchContextSchema = z.object({
  goal: z.string().trim().min(1).max(80),
  candidateIds: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
  recentMealNames: z.array(z.string().max(160)).max(50).default([]),
  nutrientTargets: z.record(z.string(), z.number()).default({})
})

export type NutrientSummary = z.infer<typeof nutrientSummarySchema>
export type MealCandidate = z.infer<typeof mealCandidateSchema>
export type MealAnalysisResult = z.infer<typeof mealAnalysisResultSchema>
export type TranscriptionResult = z.infer<typeof transcriptionResultSchema>
export type LunchRecommendation = z.infer<typeof lunchRecommendationSchema>
export type TextOrImage = z.infer<typeof textOrImageSchema>
export type LunchContext = z.infer<typeof lunchContextSchema>

export interface AiProvider {
  analyzeMeal(input: TextOrImage): Promise<MealAnalysisResult>
  transcribeMeal(audio: Uint8Array, mimeType: string): Promise<TranscriptionResult>
  recommendLunch(context: LunchContext): Promise<LunchRecommendation>
}

export class AiProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = 'AiProviderError'
  }
}
