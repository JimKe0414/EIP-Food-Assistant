import { AiProviderError } from '~/shared/domain/ai'

export async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  parse: (response: Response) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) {
      throw new AiProviderError('UPSTREAM_HTTP_ERROR', `AI provider returned HTTP ${response.status}`)
    }
    return await parse(response)
  } catch (error) {
    if (error instanceof AiProviderError) throw error
    if ((error as Error).name === 'AbortError') {
      throw new AiProviderError('PROVIDER_TIMEOUT', `AI provider timed out after ${timeoutMs} ms`, { cause: error })
    }
    throw new AiProviderError('PROVIDER_REQUEST_FAILED', 'AI provider request failed', { cause: error })
  } finally {
    clearTimeout(timeout)
  }
}

export function parseJsonContent(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(trimmed)
  } catch (error) {
    throw new AiProviderError('INVALID_PROVIDER_JSON', 'AI provider did not return valid JSON', { cause: error })
  }
}

export const mealSystemPrompt = `You analyze meal descriptions or images. Return JSON only with this shape:
{"candidates":[{"name":"string","portionDescription":"string|null","confidence":0.0,"nutrients":{"caloriesKcal":0,"proteinG":0,"fatG":0,"carbsG":0,"fiberG":0,"sodiumMg":0}}],"summary":"string"}.
Use null when a nutrient cannot be estimated. Do not provide medical diagnosis.`

export const recommendationSystemPrompt = `Select only candidate IDs present in candidateIds. Return JSON only:
{"candidateIds":["uuid"],"reasonById":{"uuid":"short reason"}}. Never invent IDs.`
