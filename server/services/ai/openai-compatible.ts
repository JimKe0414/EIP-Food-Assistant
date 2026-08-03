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
import { extensionFromMimeType, fetchWithTimeout, mealSystemPrompt, parseJsonContent, portionEstimateSystemPrompt, recommendationSystemPrompt } from './base'

interface OpenAiCompatibleOptions {
  baseUrl: string
  apiKey: string
  textModel: string
  visionModel: string
  audioModel: string
  // Some models (e.g. Qwen's "thinking" variants) spend a chunk of the token budget on
  // chain-of-thought before the final answer; a low/unset max_tokens can cut them off
  // before they produce a usable response.
  maxTokens?: number
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
    // Same rationale as ollama.ts: thinking-variant models (e.g. Qwen's "-thinking" models)
    // need more than 30s to spend part of the budget on chain-of-thought before answering, and
    // text-dense images (e.g. a nutrition label) push this further still.
    const content = await this.chat(input.imageBase64 ? this.options.visionModel : this.options.textModel, mealSystemPrompt, userContent, 150_000)
    return mealAnalysisResultSchema.parse(parseJsonContent(content))
  }

  async transcribeMeal(audio: Uint8Array, mimeType: string) {
    const form = new FormData()
    form.append('model', this.options.audioModel)
    // Whisper-API-compatible endpoints (this one included, per its Azure-flavored error message)
    // detect format from the filename's extension, not the actual file content or the
    // multipart part's Content-Type — an extensionless filename gets rejected as "invalid file
    // format" even though the bytes themselves are a supported type. Desktop/mobile browsers
    // default MediaRecorder to different container formats (e.g. webm vs mp4), so this only
    // surfaced once mobile started sending something other than whatever desktop happened to
    // send.
    form.append('file', new Blob([Uint8Array.from(audio)], { type: mimeType }), `meal-audio.${extensionFromMimeType(mimeType)}`)
    return fetchWithTimeout(
      `${this.options.baseUrl.replace(/\/$/, '')}/audio/transcriptions`,
      { method: 'POST', headers: this.authHeaders(false), body: form },
      60_000,
      async response => transcriptionResultSchema.parse({ ...(await response.json()), confidence: null })
    )
  }

  async recommendLunch(context: LunchContext) {
    const content = await this.chat(this.options.textModel, recommendationSystemPrompt, JSON.stringify(context), 20_000)
    return lunchRecommendationSchema.parse(parseJsonContent(content))
  }

  async estimatePortionGrams(query: PortionEstimateQuery) {
    const content = await this.chat(this.options.textModel, portionEstimateSystemPrompt, JSON.stringify(query), 20_000)
    return portionEstimateSchema.parse(parseJsonContent(content))
  }

  private chat(model: string, system: string, content: unknown, timeoutMs: number) {
    return fetchWithTimeout(
      `${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: this.authHeaders(true),
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content }],
          ...(this.options.maxTokens ? { max_tokens: this.options.maxTokens } : {})
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
