import {
  lunchRecommendationSchema,
  mealAnalysisResultSchema,
  portionEstimateSchema,
  transcriptionResultSchema,
  type AiProvider,
  type LunchContext,
  type PortionEstimateQuery,
  type TextOrImage
} from '~/shared/domain/ai'
import {
  eipNutritionEstimateResultSchema,
  type EipNutritionEstimateInputItem
} from '~/shared/domain/eip-catalog'

export class StubAiProvider implements AiProvider {
  async analyzeMeal(input: TextOrImage) {
    const name = input.text?.trim() || '照片中的餐點'
    return mealAnalysisResultSchema.parse({
      candidates: [{
        name,
        portionDescription: '一份',
        estimatedGrams: 350,
        confidence: 0.9,
        nutrients: { caloriesKcal: 520, proteinG: 30, fatG: 18, carbsG: 55, fiberG: 6, sodiumMg: 680 }
      }],
      summary: '測試 Provider 產生的可確認候選。'
    })
  }

  async transcribeMeal() {
    return transcriptionResultSchema.parse({ text: '一份雞胸便當和無糖豆漿', language: 'zh-TW', confidence: 0.92 })
  }

  async recommendLunch(context: LunchContext) {
    const candidateIds = context.candidateIds.slice(0, 3)
    return lunchRecommendationSchema.parse({
      candidateIds,
      reasonById: Object.fromEntries(candidateIds.map(id => [id, `符合「${context.goal}」且在既有候選中`]))
    })
  }

  async estimatePortionGrams(query: PortionEstimateQuery) {
    void query
    return portionEstimateSchema.parse({ estimatedGrams: 150 })
  }

  async estimateEipMenuNutrition(items: EipNutritionEstimateInputItem[]) {
    return eipNutritionEstimateResultSchema.parse({
      items: items.map((item) => {
        const seed = [...item.name].reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0)
        return {
          rowId: item.rowId,
          nutrients: {
            caloriesKcal: 360 + seed % 361,
            proteinG: 12 + seed % 31,
            fatG: 8 + seed % 23,
            carbsG: 35 + seed % 56,
            fiberG: 3 + seed % 10,
            sodiumMg: 480 + seed % 921
          }
        }
      })
    })
  }
}
