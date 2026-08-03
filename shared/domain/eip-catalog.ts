import { z } from 'zod'
import { nutrientSummarySchema } from './ai'

export const eipRestaurantNameSchema = z.string().trim().min(1).max(120)
export const eipMealNameSchema = z.string().trim().min(1).max(160)
export const eipNutritionFieldSchema = z.enum([
  'caloriesKcal',
  'proteinG',
  'fatG',
  'carbsG',
  'fiberG',
  'sodiumMg'
])

export const eipNutrientDraftSchema = z.object({
  caloriesKcal: z.number().nonnegative().nullable().default(null),
  proteinG: z.number().nonnegative().nullable().default(null),
  fatG: z.number().nonnegative().nullable().default(null),
  carbsG: z.number().nonnegative().nullable().default(null),
  fiberG: z.number().nonnegative().nullable().default(null),
  sodiumMg: z.number().nonnegative().nullable().default(null)
})

export const eipCatalogDraftItemSchema = z.object({
  rowId: z.string().trim().min(1).max(40),
  restaurantName: eipRestaurantNameSchema,
  name: eipMealNameSchema,
  foodType: z.enum(['meat', 'veg', 'unknown']).default('unknown'),
  nutrients: eipNutrientDraftSchema
})

export const eipCatalogItemSchema = z.object({
  restaurantName: eipRestaurantNameSchema,
  name: eipMealNameSchema,
  foodType: z.enum(['meat', 'veg', 'unknown']).default('unknown'),
  nutrients: nutrientSummarySchema,
  nutritionEstimated: z.boolean().default(false)
})

const aiEstimatedNutrientsSchema = z.object({
  caloriesKcal: z.number().nonnegative().max(5000),
  proteinG: z.number().nonnegative().max(500),
  fatG: z.number().nonnegative().max(500),
  carbsG: z.number().nonnegative().max(1000),
  fiberG: z.number().nonnegative().max(200),
  sodiumMg: z.number().nonnegative().max(50000)
})

export const eipNutritionEstimateInputItemSchema = eipCatalogDraftItemSchema.extend({
  missingFields: z.array(eipNutritionFieldSchema).min(1).max(6)
})

export const eipNutritionEstimateResultSchema = z.object({
  items: z.array(z.object({
    rowId: z.string().trim().min(1).max(40),
    nutrients: aiEstimatedNutrientsSchema
  })).min(1).max(200)
})

export const eipMenuImportResultSchema = z.object({
  restaurants: z.number().int().nonnegative(),
  imported: z.number().int().nonnegative(),
  inserted: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  estimated: z.number().int().nonnegative().default(0),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/i).optional()
})

export type EipCatalogDraftItem = z.infer<typeof eipCatalogDraftItemSchema>
export type EipCatalogItem = z.infer<typeof eipCatalogItemSchema>
export type EipNutritionField = z.infer<typeof eipNutritionFieldSchema>
export type EipNutritionEstimateInputItem = z.infer<typeof eipNutritionEstimateInputItemSchema>
export type EipNutritionEstimateResult = z.infer<typeof eipNutritionEstimateResultSchema>
export type EipMenuImportResult = z.infer<typeof eipMenuImportResultSchema>

export function normalizeEipCatalogName(value: string) {
  return value.normalize('NFKC').trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('zh-Hant')
}

export function deduplicateEipCatalogItems<T extends Pick<EipCatalogItem, 'restaurantName' | 'name'>>(items: T[]) {
  const unique = new Map<string, T>()
  for (const item of items) {
    const key = `${normalizeEipCatalogName(item.restaurantName)}\u0000${normalizeEipCatalogName(item.name)}`
    unique.set(key, item)
  }
  return [...unique.values()]
}

export function missingEipNutritionFields(item: EipCatalogDraftItem): EipNutritionField[] {
  return eipNutritionFieldSchema.options.filter(field => item.nutrients[field] === null)
}

export function toEipNutritionEstimateInput(item: EipCatalogDraftItem): EipNutritionEstimateInputItem {
  return eipNutritionEstimateInputItemSchema.parse({
    ...item,
    missingFields: missingEipNutritionFields(item)
  })
}

export function completeEipCatalogWithoutAi(items: EipCatalogDraftItem[]): EipCatalogItem[] {
  return items.map(item => eipCatalogItemSchema.parse({
    restaurantName: item.restaurantName,
    name: item.name,
    foodType: item.foodType,
    nutrients: item.nutrients,
    nutritionEstimated: false
  }))
}

export function mergeEipNutritionEstimates(
  drafts: EipCatalogDraftItem[],
  rawResult: unknown
): EipCatalogItem[] {
  const result = eipNutritionEstimateResultSchema.parse(rawResult)
  const incomplete = drafts.filter(item => missingEipNutritionFields(item).length > 0)
  const expectedIds = new Set(incomplete.map(item => item.rowId))
  const estimatesById = new Map<string, z.infer<typeof aiEstimatedNutrientsSchema>>()

  for (const estimate of result.items) {
    if (!expectedIds.has(estimate.rowId) || estimatesById.has(estimate.rowId)) {
      throw new Error('AI nutrition estimates did not match the imported rows')
    }
    estimatesById.set(estimate.rowId, estimate.nutrients)
  }
  if (estimatesById.size !== expectedIds.size) {
    throw new Error('AI nutrition estimates were incomplete')
  }

  return drafts.map(item => {
    const estimate = estimatesById.get(item.rowId)
    const hadMissingValues = missingEipNutritionFields(item).length > 0
    if (hadMissingValues && !estimate) throw new Error(`Missing AI nutrition estimate for ${item.rowId}`)
    return eipCatalogItemSchema.parse({
      restaurantName: item.restaurantName,
      name: item.name,
      foodType: item.foodType,
      nutritionEstimated: hadMissingValues,
      nutrients: Object.fromEntries(
        eipNutritionFieldSchema.options.map(field => [field, item.nutrients[field] ?? estimate?.[field] ?? null])
      )
    })
  })
}
