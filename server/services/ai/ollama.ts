import {
  AiProviderError,
  lunchRecommendationSchema,
  mealAnalysisResultSchema,
  type AiProvider,
  type LunchContext,
  type TextOrImage
} from '~/shared/domain/ai'
import { fetchWithTimeout, mealSystemPrompt, parseJsonContent, recommendationSystemPrompt } from './base'

interface OllamaOptions {
  baseUrl: string
  textModel: string
  visionModel: string
}

export class OllamaAiProvider implements AiProvider {
  constructor(private readonly options: OllamaOptions) {}

  async analyzeMeal(input: TextOrImage) {
    const model = input.imageBase64 ? this.options.visionModel : this.options.textModel
    const content = await this.chat(model, mealSystemPrompt, input.text || 'Analyze this meal image.', input.imageBase64 ? [input.imageBase64] : undefined, 30_000)
    return mealAnalysisResultSchema.parse(parseJsonContent(content))
  }

  async transcribeMeal(): Promise<never> {
    throw new AiProviderError('UNSUPPORTED_OPERATION', 'Ollama does not transcribe audio')
  }

  async recommendLunch(context: LunchContext) {
    const content = await this.chat(this.options.textModel, recommendationSystemPrompt, JSON.stringify(context), undefined, 20_000)
    return lunchRecommendationSchema.parse(parseJsonContent(content))
  }

  private chat(model: string, system: string, prompt: string, images: string[] | undefined, timeoutMs: number) {
    return fetchWithTimeout(
      `${this.options.baseUrl.replace(/\/$/, '')}/api/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt, images }]
        })
      },
      timeoutMs,
      async response => String((await response.json() as { message?: { content?: string } }).message?.content ?? '')
    )
  }
}
