import {
  AiProviderError,
  lunchRecommendationSchema,
  mealAnalysisResultSchema,
  transcriptionResultSchema,
  type AiProvider,
  type LunchContext,
  type TextOrImage
} from '~/shared/domain/ai'
import { fetchWithTimeout, logAiPrompt, mealSystemPrompt, parseJsonContent, recommendationSystemPrompt } from './base'

interface GoogleOptions { apiKey: string, textModel: string, visionModel: string, audioModel: string }

export class GoogleGenAiProvider implements AiProvider {
  private readonly root = 'https://generativelanguage.googleapis.com/v1beta'
  constructor(private readonly options: GoogleOptions) {}

  async analyzeMeal(input: TextOrImage) {
    const parts: object[] = [{ text: `${mealSystemPrompt}\n${input.text || 'Analyze this meal image.'}` }]
    if (input.imageBase64) parts.push({ inline_data: { mime_type: input.mimeType, data: input.imageBase64 } })
    const content = await this.generate(input.imageBase64 ? this.options.visionModel : this.options.textModel, parts, 30_000)
    return mealAnalysisResultSchema.parse(parseJsonContent(content))
  }

  async transcribeMeal(audio: Uint8Array, mimeType: string) {
    let file: { name: string, uri: string } | undefined
    try {
      file = await this.uploadFile(audio, mimeType)
      await this.waitUntilActive(file.name)
      const content = await this.generate(this.options.audioModel, [
        { text: 'Transcribe this meal description. Return JSON only: {"text":"...","language":"zh-TW","confidence":null}' },
        { file_data: { mime_type: mimeType, file_uri: file.uri } }
      ], 60_000)
      return transcriptionResultSchema.parse(parseJsonContent(content))
    } finally {
      if (file?.name) {
        await fetch(`${this.root}/${file.name}?key=${encodeURIComponent(this.options.apiKey)}`, { method: 'DELETE' }).catch(() => undefined)
      }
    }
  }

  async recommendLunch(context: LunchContext) {
    logAiPrompt('google-genai', recommendationSystemPrompt, context)
    const content = await this.generate(this.options.textModel, [{ text: `${recommendationSystemPrompt}\n${JSON.stringify(context)}` }], 20_000)
    return lunchRecommendationSchema.parse(parseJsonContent(content))
  }

  private generate(model: string, parts: object[], timeoutMs: number) {
    return fetchWithTimeout(
      `${this.root}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.options.apiKey)}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json' } }) },
      timeoutMs,
      async response => String((await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts?.[0]?.text ?? '')
    )
  }

  private async uploadFile(audio: Uint8Array, mimeType: string) {
    const start = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(this.options.apiKey)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-upload-protocol': 'resumable',
        'x-goog-upload-command': 'start',
        'x-goog-upload-header-content-length': String(audio.byteLength),
        'x-goog-upload-header-content-type': mimeType
      },
      body: JSON.stringify({ file: { display_name: 'temporary-meal-audio' } })
    })
    const uploadUrl = start.headers.get('x-goog-upload-url')
    if (!start.ok || !uploadUrl) throw new AiProviderError('GEMINI_UPLOAD_START_FAILED', 'Gemini audio upload could not start')

    const uploaded = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'content-type': mimeType, 'x-goog-upload-offset': '0', 'x-goog-upload-command': 'upload, finalize' },
      body: new Blob([Uint8Array.from(audio)], { type: mimeType })
    })
    if (!uploaded.ok) throw new AiProviderError('GEMINI_UPLOAD_FAILED', 'Gemini audio upload failed')
    const payload = await uploaded.json() as { file?: { name?: string, uri?: string } }
    if (!payload.file?.name || !payload.file.uri) throw new AiProviderError('GEMINI_UPLOAD_INVALID', 'Gemini upload response was invalid')
    return { name: payload.file.name, uri: payload.file.uri }
  }

  private async waitUntilActive(name: string) {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const response = await fetch(`${this.root}/${name}?key=${encodeURIComponent(this.options.apiKey)}`)
      const payload = await response.json() as { state?: string }
      if (payload.state === 'ACTIVE') return
      if (payload.state === 'FAILED') throw new AiProviderError('GEMINI_FILE_FAILED', 'Gemini rejected the audio file')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    throw new AiProviderError('GEMINI_FILE_TIMEOUT', 'Gemini audio file did not become active in 30 seconds')
  }
}
