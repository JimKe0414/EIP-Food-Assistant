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

export const lunchCandidateContextSchema = z.object({
  id: z.string().trim().min(1).max(100),
  source: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(160),
  caloriesKcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative().nullable(),
  fatG: z.number().nonnegative().nullable(),
  carbsG: z.number().nonnegative().nullable()
})

export const lunchFoodTypeSchema = z.enum(['meat', 'veg'])

export const textOrImageSchema = z.object({
  text: z.string().trim().max(2000).optional(),
  imageBase64: z.string().max(15_000_000).optional(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional()
}).refine(value => Boolean(value.text || value.imageBase64), 'Text or image is required')

export const lunchContextSchema = z.object({
  goal: z.string().trim().min(1).max(80),
  foodType: lunchFoodTypeSchema.default('meat'),
  candidateIds: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
  candidates: z.array(lunchCandidateContextSchema).max(100).default([]),
  recentMealNames: z.array(z.string().max(160)).max(50).default([]),
  nutrientTargets: z.record(z.string(), z.number()).default({})
}).superRefine((value, context) => {
  const allowedIds = new Set(value.candidateIds)
  const seenIds = new Set<string>()
  for (const candidate of value.candidates) {
    if (!allowedIds.has(candidate.id)) {
      context.addIssue({ code: 'custom', path: ['candidates'], message: `Candidate ${candidate.id} is not present in candidateIds` })
    }
    if (seenIds.has(candidate.id)) {
      context.addIssue({ code: 'custom', path: ['candidates'], message: `Candidate ${candidate.id} is duplicated` })
    }
    seenIds.add(candidate.id)
  }
})

export type NutrientSummary = z.infer<typeof nutrientSummarySchema>
export type MealCandidate = z.infer<typeof mealCandidateSchema>
export type MealAnalysisResult = z.infer<typeof mealAnalysisResultSchema>
export type TranscriptionResult = z.infer<typeof transcriptionResultSchema>
export type LunchRecommendation = z.infer<typeof lunchRecommendationSchema>
export type LunchCandidateContext = z.infer<typeof lunchCandidateContextSchema>
export type LunchFoodType = z.infer<typeof lunchFoodTypeSchema>
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

const vegetarianForbiddenContent = /(?:葷|肉|豬|牛|羊|雞|鴨|鵝|魚|鮭|鮪|鯖|鱈|鯛|鰻|蝦|蟹|蚵|蛤|貝|魷|花枝|透抽|章魚|干貝|海鮮|培根|火腿|香腸|排骨|chicken|beef|pork|lamb|mutton|duck|turkey|fish|salmon|tuna|seafood|shrimp|prawn|crab|bacon|ham|sausage)/iu

export function enforceLunchRecommendationPolicy(context: LunchContext, recommendation: LunchRecommendation) {
  const candidatesById = new Map(context.candidates.map(candidate => [candidate.id, candidate]))
  for (const candidateId of recommendation.candidateIds) {
    if (!context.candidateIds.includes(candidateId) || !candidatesById.has(candidateId)) {
      throw new AiProviderError('INVALID_RECOMMENDATION_CANDIDATE', 'AI selected a candidate outside the supplied list')
    }
  }

  if (context.foodType === 'veg') {
    const selectedNames = recommendation.candidateIds.map(id => candidatesById.get(id)?.name ?? '')
    const responseReasons = Object.values(recommendation.reasonById)
    if ([...selectedNames, ...responseReasons].some(content => vegetarianForbiddenContent.test(content))) {
      throw new AiProviderError('VEGETARIAN_POLICY_VIOLATION', 'Vegetarian recommendation contained disallowed animal-food content')
    }
  }

  return recommendation
}
