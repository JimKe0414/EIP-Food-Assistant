import { AiProviderError, transcriptionResultSchema, type AiProvider } from '~/shared/domain/ai'
import { fetchWithTimeout } from './base'

export class LocalWhisperProvider implements AiProvider {
  constructor(private readonly baseUrl: string) {}

  analyzeMeal(): Promise<never> {
    throw new AiProviderError('UNSUPPORTED_OPERATION', 'Local Whisper only transcribes audio')
  }

  async transcribeMeal(audio: Uint8Array, mimeType: string) {
    const form = new FormData()
    form.append('file', new Blob([Uint8Array.from(audio)], { type: mimeType }), 'meal-audio')
    return fetchWithTimeout(
      `${this.baseUrl.replace(/\/$/, '')}/transcribe`,
      { method: 'POST', body: form },
      60_000,
      async response => transcriptionResultSchema.parse(await response.json())
    )
  }

  recommendLunch(): Promise<never> {
    throw new AiProviderError('UNSUPPORTED_OPERATION', 'Local Whisper does not recommend meals')
  }
}
