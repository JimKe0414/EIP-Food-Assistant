import {
  lunchRecommendationSchema,
  mealAnalysisResultSchema,
  transcriptionResultSchema,
  type AiProvider,
  type LunchContext,
  type TextOrImage
} from '~/shared/domain/ai'
import { fetchWithTimeout, logAiPrompt, mealSystemPrompt, parseJsonContent, recommendationSystemPrompt } from './base'

interface OpenAiCompatibleOptions {
  baseUrl: string
  apiKey: string
  textModel: string
  visionModel: string
  audioModel: string
  maxTokens: number
}

export class OpenAiCompatibleProvider implements AiProvider {
  constructor(private readonly options: OpenAiCompatibleOptions) {}

  async analyzeMeal(input: TextOrImage) {
    const userContent: unknown = input.imageBase64
      ? [
          { type: 'text', text: input.text || 'Analyze this meal image.' },
          { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` } }
        ]
      : input.text
    const content = await this.chat(input.imageBase64 ? this.options.visionModel : this.options.textModel, mealSystemPrompt, userContent, 30_000)
    return mealAnalysisResultSchema.parse(parseJsonContent(content))
  }

  async transcribeMeal(audio: Uint8Array, mimeType: string) {
    const form = new FormData()
    form.append('model', this.options.audioModel)
    form.append('file', new Blob([Uint8Array.from(audio)], { type: mimeType }), 'meal-audio')
    return fetchWithTimeout(
      `${this.options.baseUrl.replace(/\/$/, '')}/audio/transcriptions`,
      { method: 'POST', headers: this.authHeaders(false), body: form },
      60_000,
      async response => transcriptionResultSchema.parse({ ...(await response.json()), confidence: null })
    )
  }

  async recommendLunch(context: LunchContext) {
    logAiPrompt('openai-compatible', recommendationSystemPrompt, context)
    const content = await this.chat(this.options.textModel, recommendationSystemPrompt, JSON.stringify(context), 20_000)
    return lunchRecommendationSchema.parse(parseJsonContent(content))
  }

  private chat(model: string, system: string, content: unknown, timeoutMs: number) {
    return fetchWithTimeout(
      `${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: this.authHeaders(true),
        body: JSON.stringify({
          model,
          max_tokens: this.options.maxTokens,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content }]
        })
      },
      timeoutMs,
      async response => String((await response.json() as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? '')
    )
  }

  private authHeaders(json: boolean): Record<string, string> {
    return { authorization: `Bearer ${this.options.apiKey}`, ...(json ? { 'content-type': 'application/json' } : {}) }
  }
}
