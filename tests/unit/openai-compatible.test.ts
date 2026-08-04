import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenAiCompatibleProvider } from '../../server/services/ai/openai-compatible'

const transcodeToWav = vi.hoisted(() => vi.fn(async () => Buffer.from([9, 9, 9])))
vi.mock('../../server/services/ai/base', async importOriginal => ({
  ...(await importOriginal<typeof import('../../server/services/ai/base')>()),
  transcodeToWav
}))

afterEach(() => {
  vi.unstubAllGlobals()
  transcodeToWav.mockClear()
})

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

describe('OpenAI-compatible transcription upload', () => {
  // Whisper endpoints identify the container by filename extension and reject an extensionless
  // upload outright ("Unrecognized file format"), so the browser's MIME type has to survive the
  // trip as a suffix.
  it.each([
    ['audio/webm;codecs=opus', 'meal-audio.webm'],
    ['audio/mp4', 'meal-audio.mp4'],
    ['audio/ogg;codecs=opus', 'meal-audio.ogg'],
    ['audio/wav', 'meal-audio.wav']
  ])('names a %s upload %s', async (mimeType, expected) => {
    const request = vi.fn(async () => new Response(JSON.stringify({ text: '早餐吃了鮪魚蛋吐司' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))
    vi.stubGlobal('fetch', request)

    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://example.test/openai/v1',
      apiKey: 'test-only',
      textModel: '',
      visionModel: '',
      audioModel: 'whisper',
      maxTokens: 4096
    })
    await provider.transcribeMeal(new Uint8Array([1, 2, 3]), mimeType)

    const calls = request.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>
    const form = calls[0]?.[1]?.body as FormData
    expect((form.get('file') as File).name).toBe(expected)
    expect(transcodeToWav).not.toHaveBeenCalled()
  })

  // Android's device recorder hands back audio/3gpp or audio/amr, which the endpoint decodes and
  // rejects outright — renaming them to a listed extension doesn't help, only transcoding does.
  it.each(['audio/3gpp', 'audio/amr', 'audio/aac', ''])('transcodes an unsupported %s upload to WAV', async mimeType => {
    const request = vi.fn(async () => new Response(JSON.stringify({ text: '早餐吃了鮪魚蛋吐司' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))
    vi.stubGlobal('fetch', request)

    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://example.test/openai/v1',
      apiKey: 'test-only',
      textModel: '',
      visionModel: '',
      audioModel: 'whisper',
      maxTokens: 4096
    })
    await provider.transcribeMeal(new Uint8Array([1, 2, 3]), mimeType)

    expect(transcodeToWav).toHaveBeenCalledOnce()
    const calls = request.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>
    const file = (calls[0]?.[1]?.body as FormData).get('file') as File
    expect(file.name).toBe('meal-audio.wav')
    expect(file.type).toBe('audio/wav')
    expect(await file.arrayBuffer()).toEqual(Uint8Array.from([9, 9, 9]).buffer)
  })
})
