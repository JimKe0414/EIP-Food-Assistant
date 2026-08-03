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
import {
  eipNutritionEstimateSystemPrompt,
  fetchWithTimeout,
  mealSystemPrompt,
  parseJsonContent,
  portionEstimateSystemPrompt,
  recommendationSystemPrompt
} from './base'

/** Whisper-style transcription endpoints (OpenAI's and Azure's alike) sniff the audio container
 * from the upload's *filename extension* and reject anything they can't name — the MIME type on
 * the blob is ignored. Browser recordings arrive as audio/webm or audio/mp4, so map the type
 * back to an extension the endpoint lists as supported. */
const audioExtensions: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac'
}

function audioFileName(mimeType: string) {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  return `meal-audio.${audioExtensions[base] || 'webm'}`
}

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
    if (!this.options.audioModel) {
      throw new Error('OPENAI_COMPAT_AUDIO_MODEL（或 AI_AUDIO_MODEL）未設定，無法進行語音轉文字')
    }
    const form = new FormData()
    form.append('model', this.options.audioModel)
    form.append('file', new Blob([Uint8Array.from(audio)], { type: mimeType }), audioFileName(mimeType))
    return fetchWithTimeout(
      this.endpoint('/audio/transcriptions'),
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

  async estimateEipMenuNutrition(items: EipNutritionEstimateInputItem[]) {
    const content = await this.chat(this.options.textModel, eipNutritionEstimateSystemPrompt, JSON.stringify(items), 90_000)
    return eipNutritionEstimateResultSchema.parse(parseJsonContent(content))
  }

  /** Azure exposes transcription as /openai/deployments/<deployment>/audio/transcriptions and
   * *requires* an ?api-version= query param, so a configured base URL may legitimately carry a
   * query string. Plain concatenation would bury the route inside it
   * (".../whisper?api-version=2024-06-01/audio/transcriptions"), so append to the path instead
   * and let the search params ride along. */
  private endpoint(path: string) {
    const url = new URL(this.options.baseUrl)
    url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`
    return url.toString()
  }

  private chat(model: string, system: string, content: unknown, timeoutMs: number) {
    return fetchWithTimeout(
      this.endpoint('/chat/completions'),
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
