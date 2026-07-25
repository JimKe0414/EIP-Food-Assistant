import {
  AiProviderError,
  lunchRecommendationSchema,
  mealAnalysisResultSchema,
  portionEstimateSchema,
  type AiProvider,
  type LunchContext,
  type PortionEstimateQuery,
  type TextOrImage
} from '~/shared/domain/ai'
import { fetchWithTimeout, mealSystemPrompt, parseJsonContent, portionEstimateSystemPrompt, recommendationSystemPrompt } from './base'

interface OllamaOptions {
  baseUrl: string
  textModel: string
  visionModel: string
}

export class OllamaAiProvider implements AiProvider {
  constructor(private readonly options: OllamaOptions) {}

  async analyzeMeal(input: TextOrImage) {
    const model = input.imageBase64 ? this.options.visionModel : this.options.textModel
    // "Thinking" models (e.g. qwen3.5's vision-capable build) spend a chunk of the timeout on
    // chain-of-thought before answering — 30s was cutting them off before a response arrived.
    // Text-dense images (e.g. a nutrition label) push this further still (observed ~90s+ vs
    // ~20-30s for a plain food photo), so the ceiling needs real headroom above the common case.
    const content = await this.chat(model, mealSystemPrompt, input.text || 'Analyze this meal image.', input.imageBase64 ? [input.imageBase64] : undefined, 150_000)
    return mealAnalysisResultSchema.parse(parseJsonContent(content))
  }

  async transcribeMeal(): Promise<never> {
    throw new AiProviderError('UNSUPPORTED_OPERATION', 'Ollama does not transcribe audio')
  }

  async recommendLunch(context: LunchContext) {
    const content = await this.chat(this.options.textModel, recommendationSystemPrompt, JSON.stringify(context), undefined, 20_000)
    return lunchRecommendationSchema.parse(parseJsonContent(content))
  }

  async estimatePortionGrams(query: PortionEstimateQuery) {
    const content = await this.chat(this.options.textModel, portionEstimateSystemPrompt, JSON.stringify(query), undefined, 20_000)
    return portionEstimateSchema.parse(parseJsonContent(content))
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
          // Ollama's default context window (4096 tokens) is too small once a real photo's
          // image tokens are added to the system+user prompt, causing an immediate 400
          // ("exceeds the available context size"). think:false skips chain-of-thought for
          // reasoning-capable models (e.g. qwen3.5) — observed spending its entire output
          // budget on self-doubting "thinking" text and never emitting the actual answer.
          options: { num_ctx: 16384 },
          think: false,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt, images }]
        })
      },
      timeoutMs,
      async response => String((await response.json() as { message?: { content?: string } }).message?.content ?? '')
    )
  }
}
