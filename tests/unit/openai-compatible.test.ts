import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenAiCompatibleProvider } from '../../server/services/ai/openai-compatible'

afterEach(() => vi.unstubAllGlobals())

describe('OpenAI-compatible lunch recommendation', () => {
  it('sends candidate details and configured max_tokens', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"candidateIds":["mock:chicken"],"reasonById":{"mock:chicken":"蛋白質較高"}}' } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', request)

    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://api.focusit.tw/openai/v1',
      apiKey: 'test-only',
      textModel: 'Qwen3.6-35B-A3B-fast',
      visionModel: '',
      audioModel: '',
      maxTokens: 4096
    })
    const result = await provider.recommendLunch({
      goal: '高蛋白',
      foodType: 'meat',
      candidateIds: ['mock:chicken'],
      candidates: [{ id: 'mock:chicken', source: 'mock', name: '烤雞胸藜麥餐盒', caloriesKcal: 520, proteinG: 42, fatG: 14, carbsG: 56 }],
      recentMealNames: [],
      nutrientTargets: { proteinG: 35 }
    })

    expect(result.candidateIds).toEqual(['mock:chicken'])
    const calls = request.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>
    const [, options] = calls[0] ?? []
    const body = JSON.parse(String(options?.body))
    expect(body.max_tokens).toBe(4096)
    const context = JSON.parse(body.messages[1].content)
    expect(context.foodType).toBe('meat')
    expect(context.candidates[0].name).toBe('烤雞胸藜麥餐盒')
  })
})
