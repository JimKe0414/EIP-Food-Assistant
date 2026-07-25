import { existsSync, readFileSync } from 'node:fs'
import type { AiProvider } from '~/shared/domain/ai'
import { GoogleGenAiProvider } from './google-genai'
import { LocalWhisperProvider } from './local-whisper'
import { OllamaAiProvider } from './ollama'
import { OpenAiCompatibleProvider } from './openai-compatible'
import { StubAiProvider } from './stub'
import { WhisperCppProvider } from './whisper-cpp'

export type ProviderName = 'stub' | 'ollama' | 'local-whisper' | 'whisper-cpp' | 'openai-compatible' | 'google-genai'
export type ProviderPurpose = 'text' | 'vision' | 'audio'

export interface AiConfiguration {
  egressMode: 'local-only' | 'cloud-approved'
  textProvider: ProviderName
  visionProvider: ProviderName
  audioProvider: ProviderName
  textModel: string
  visionModel: string
  audioModel: string
  ollamaBaseUrl: string
  whisperBaseUrl: string
  openAiBaseUrl: string
  openAiApiKey: string
  openAiTextModel: string
  openAiVisionModel: string
  openAiAudioModel: string
  openAiMaxTokens: number | undefined
  googleApiKey: string
  googleTextModel: string
  googleVisionModel: string
  googleAudioModel: string
}

export function validateAiConfiguration(config: AiConfiguration) {
  const configured = [config.textProvider, config.visionProvider, config.audioProvider]
  const usesCloud = configured.some(provider => provider === 'openai-compatible' || provider === 'google-genai')
  if (config.egressMode === 'local-only' && usesCloud) {
    throw new Error('AI_EGRESS_MODE=local-only forbids cloud AI providers')
  }
  if (configured.includes('openai-compatible') && (!config.openAiBaseUrl || !config.openAiApiKey)) {
    throw new Error('OpenAI-compatible provider requires base URL and API key')
  }
  if (configured.includes('google-genai') && !config.googleApiKey) {
    throw new Error('Google GenAI provider requires an API key')
  }
}

export function createAiProvider(config: AiConfiguration, purpose: ProviderPurpose): AiProvider {
  validateAiConfiguration(config)
  const name = purpose === 'text' ? config.textProvider : purpose === 'vision' ? config.visionProvider : config.audioProvider
  switch (name) {
    case 'stub': return new StubAiProvider()
    case 'ollama': return new OllamaAiProvider({ baseUrl: config.ollamaBaseUrl, textModel: config.textModel, visionModel: config.visionModel })
    case 'local-whisper': return new LocalWhisperProvider(config.whisperBaseUrl)
    case 'whisper-cpp': return new WhisperCppProvider(config.whisperBaseUrl)
    case 'openai-compatible': return new OpenAiCompatibleProvider({
      baseUrl: config.openAiBaseUrl,
      apiKey: config.openAiApiKey,
      textModel: config.openAiTextModel || config.textModel,
      visionModel: config.openAiVisionModel || config.visionModel,
      audioModel: config.openAiAudioModel || config.audioModel,
      maxTokens: config.openAiMaxTokens
    })
    case 'google-genai': return new GoogleGenAiProvider({
      apiKey: config.googleApiKey,
      textModel: config.googleTextModel,
      visionModel: config.googleVisionModel,
      audioModel: config.googleAudioModel
    })
  }
}

export function aiConfigurationFromEnv(env: NodeJS.ProcessEnv = process.env): AiConfiguration {
  return {
    egressMode: (env.AI_EGRESS_MODE || 'local-only') as AiConfiguration['egressMode'],
    textProvider: (env.AI_TEXT_PROVIDER || 'stub') as ProviderName,
    visionProvider: (env.AI_VISION_PROVIDER || 'stub') as ProviderName,
    audioProvider: (env.AI_AUDIO_PROVIDER || 'stub') as ProviderName,
    textModel: env.AI_TEXT_MODEL || 'llama3.1:8b',
    visionModel: env.AI_VISION_MODEL || 'llava:13b',
    audioModel: env.AI_AUDIO_MODEL || '',
    ollamaBaseUrl: env.OLLAMA_BASE_URL || 'http://ollama:11434',
    whisperBaseUrl: env.WHISPER_BASE_URL || 'http://whisper:8000',
    openAiBaseUrl: env.OPENAI_COMPAT_BASE_URL || '',
    openAiApiKey: secretValue('openai_compat_api_key', env.OPENAI_COMPAT_API_KEY),
    openAiTextModel: env.OPENAI_COMPAT_TEXT_MODEL || '',
    openAiVisionModel: env.OPENAI_COMPAT_VISION_MODEL || '',
    openAiAudioModel: env.OPENAI_COMPAT_AUDIO_MODEL || '',
    openAiMaxTokens: env.OPENAI_COMPAT_MAX_TOKENS ? Number(env.OPENAI_COMPAT_MAX_TOKENS) : undefined,
    googleApiKey: secretValue('google_genai_api_key', env.GOOGLE_GENAI_API_KEY),
    googleTextModel: env.GOOGLE_GENAI_TEXT_MODEL || 'gemini-2.5-flash',
    googleVisionModel: env.GOOGLE_GENAI_VISION_MODEL || 'gemini-2.5-flash',
    googleAudioModel: env.GOOGLE_GENAI_AUDIO_MODEL || 'gemini-2.5-flash'
  }
}

function secretValue(name: string, fallback?: string) {
  const path = `/run/secrets/${name}`
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : (fallback || '')
}
