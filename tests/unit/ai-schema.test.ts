import { describe, expect, it } from 'vitest'
import { lunchRecommendationSchema, mealAnalysisResultSchema, transcriptionResultSchema } from '../../shared/domain/ai'
import { eipNutritionEstimateResultSchema } from '../../shared/domain/eip-catalog'
import { StubAiProvider } from '../../server/services/ai/stub'
import { aiConfigurationFromEnv, validateAiConfiguration } from '../../server/services/ai'

describe('AI provider contract', () => {
  it('validates all three stub operations with the shared schemas', async () => {
    const provider = new StubAiProvider()
    expect(mealAnalysisResultSchema.parse(await provider.analyzeMeal({ text: '雞肉便當' })).candidates).toHaveLength(1)
    expect(transcriptionResultSchema.parse(await provider.transcribeMeal()).text).toBeTruthy()
    expect(lunchRecommendationSchema.parse(await provider.recommendLunch({ goal: '均衡', foodType: 'veg', candidateIds: ['eip:1'], candidates: [], recentMealNames: [], nutrientTargets: {} })).candidateIds).toEqual(['eip:1'])
    const estimated = await provider.estimateEipMenuNutrition([
      {
        rowId: 'row-2',
        restaurantName: '幸福食堂',
        name: '烤雞便當',
        foodType: 'meat',
        missingFields: ['caloriesKcal'],
        nutrients: { caloriesKcal: null, proteinG: 30, fatG: null, carbsG: null, fiberG: null, sodiumMg: null }
      },
      {
        rowId: 'row-3',
        restaurantName: '綠意廚房',
        name: '豆腐蔬菜餐盒',
        foodType: 'veg',
        missingFields: ['caloriesKcal'],
        nutrients: { caloriesKcal: null, proteinG: null, fatG: null, carbsG: null, fiberG: null, sodiumMg: null }
      }
    ])
    expect(eipNutritionEstimateResultSchema.parse(estimated).items).toHaveLength(2)
    expect(estimated.items[0].nutrients.caloriesKcal).not.toBe(estimated.items[1].nutrients.caloriesKcal)
  })

  it('rejects invalid model output and cloud providers in local-only mode', () => {
    expect(() => mealAnalysisResultSchema.parse({ candidates: [{ name: '餐點', confidence: 2 }] })).toThrow()
    const config = aiConfigurationFromEnv({ AI_EGRESS_MODE: 'local-only', AI_TEXT_PROVIDER: 'google-genai', GOOGLE_GENAI_API_KEY: 'secret' })
    expect(() => validateAiConfiguration(config)).toThrow(/forbids cloud/i)
  })

  it('rejects a non-positive OpenAI-compatible max token limit', () => {
    const config = aiConfigurationFromEnv({
      AI_EGRESS_MODE: 'cloud-approved',
      AI_TEXT_PROVIDER: 'openai-compatible',
      OPENAI_COMPAT_BASE_URL: 'https://example.test/v1',
      OPENAI_COMPAT_API_KEY: 'test-only',
      OPENAI_COMPAT_MAX_TOKENS: '0'
    })
    expect(() => validateAiConfiguration(config)).toThrow(/positive integer/i)
  })
})
