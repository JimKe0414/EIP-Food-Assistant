import { AiProviderError, transcriptionResultSchema, type AiProvider } from '~/shared/domain/ai'
import { fetchWithTimeout, transcodeToWav } from './base'

/** Talks to whisper.cpp's `examples/server` HTTP API (POST /inference), not the faster-whisper
 * FastAPI service that LocalWhisperProvider targets — the two have different routes/response shapes. */
export class WhisperCppProvider implements AiProvider {
  constructor(private readonly baseUrl: string) {}

  analyzeMeal(): Promise<never> {
    throw new AiProviderError('UNSUPPORTED_OPERATION', 'whisper.cpp only transcribes audio')
  }

  async transcribeMeal(audio: Uint8Array, _mimeType: string) {
    // whisper.cpp's built-in decoder only reads raw WAV/PCM — browser mic recordings arrive as
    // WebM/Opus, which it fails to decode ("failed to decode audio data from memory buffer").
    let wav: Buffer
    try {
      wav = await transcodeToWav(audio)
    } catch (error) {
      throw new AiProviderError('PROVIDER_REQUEST_FAILED', 'Failed to transcode audio for whisper.cpp', { cause: error })
    }
    const form = new FormData()
    form.append('file', new Blob([Uint8Array.from(wav)], { type: 'audio/wav' }), 'meal-audio.wav')
    form.append('response_format', 'json')
    return fetchWithTimeout(
      `${this.baseUrl.replace(/\/$/, '')}/inference`,
      { method: 'POST', body: form },
      60_000,
      async response => transcriptionResultSchema.parse(await response.json())
    )
  }

  recommendLunch(): Promise<never> {
    throw new AiProviderError('UNSUPPORTED_OPERATION', 'whisper.cpp does not recommend meals')
  }

  estimatePortionGrams(): Promise<never> {
    throw new AiProviderError('UNSUPPORTED_OPERATION', 'whisper.cpp does not estimate portions')
  }

  estimateEipMenuNutrition(): Promise<never> {
    throw new AiProviderError('UNSUPPORTED_OPERATION', 'whisper.cpp does not estimate menu nutrition')
  }
}
