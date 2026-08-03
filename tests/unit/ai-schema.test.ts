import { afterEach, describe, expect, it, vi } from 'vitest'
import { lunchRecommendationSchema, mealAnalysisResultSchema, transcriptionResultSchema } from '../../shared/domain/ai'
import { eipNutritionEstimateResultSchema } from '../../shared/domain/eip-catalog'
import { StubAiProvider } from '../../server/services/ai/stub'
import { aiConfigurationFromEnv, createAiProvider, validateAiConfiguration } from '../../server/services/ai'

afterEach(() => vi.unstubAllGlobals())

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

  it('routes transcription to its own endpoint and key while chat keeps the shared pair', async () => {
    const calls: { url: string, authorization: unknown }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, authorization: new Headers(init.headers).get('authorization') })
      return new Response(JSON.stringify({ text: '午餐吃了雞腿便當' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    const config = aiConfigurationFromEnv({
      AI_EGRESS_MODE: 'cloud-approved',
      AI_TEXT_PROVIDER: 'openai-compatible',
      AI_AUDIO_PROVIDER: 'openai-compatible',
      OPENAI_COMPAT_BASE_URL: 'https://chat.test/openai/v1',
      OPENAI_COMPAT_API_KEY: 'chat-key',
      OPENAI_COMPAT_AUDIO_BASE_URL: 'https://audio.test/openai/v1',
      OPENAI_COMPAT_AUDIO_API_KEY: 'audio-key',
      OPENAI_COMPAT_AUDIO_MODEL: 'whisper'
    })
    await createAiProvider(config, 'audio').transcribeMeal(new Uint8Array([1, 2, 3]), 'audio/webm')

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://audio.test/openai/v1/audio/transcriptions')
    expect(calls[0].authorization).toBe('Bearer audio-key')
  })

  it('keeps the api-version query when the audio base URL is an Azure deployment path', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify({ text: '午餐吃了雞腿便當' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    const config = aiConfigurationFromEnv({
      AI_EGRESS_MODE: 'cloud-approved',
      AI_AUDIO_PROVIDER: 'openai-compatible',
      OPENAI_COMPAT_BASE_URL: 'https://chat.test/openai/v1',
      OPENAI_COMPAT_API_KEY: 'chat-key',
      OPENAI_COMPAT_AUDIO_BASE_URL: 'https://foundry.test/openai/deployments/whisper?api-version=2024-06-01',
      OPENAI_COMPAT_AUDIO_API_KEY: 'audio-key',
      OPENAI_COMPAT_AUDIO_MODEL: 'whisper'
    })
    await createAiProvider(config, 'audio').transcribeMeal(new Uint8Array([1, 2, 3]), 'audio/webm')

    expect(calls[0]).toBe('https://foundry.test/openai/deployments/whisper/audio/transcriptions?api-version=2024-06-01')
  })

  it('rejects an audio endpoint that has no matching key', () => {
    const config = aiConfigurationFromEnv({
      AI_EGRESS_MODE: 'cloud-approved',
      AI_AUDIO_PROVIDER: 'openai-compatible',
      OPENAI_COMPAT_BASE_URL: 'https://chat.test/openai/v1',
      OPENAI_COMPAT_API_KEY: 'chat-key',
      OPENAI_COMPAT_AUDIO_BASE_URL: 'https://audio.test/openai/v1'
    })
    expect(() => validateAiConfiguration(config)).toThrow(/audio provider requires base URL and API key/i)
  })
})
