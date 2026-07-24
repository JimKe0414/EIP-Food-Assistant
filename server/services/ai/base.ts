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

export const recommendationSystemPrompt = `Recommend up to three lunch candidates using foodType, the goal, candidate nutrition details, recent meals, and nutrient targets.
Rules:
1. Select only IDs present in candidateIds. Never invent IDs.
2. When foodType is "veg", select vegetarian candidates only.
3. When foodType is "veg", candidateIds and every reasonById value must not mention, compare with, or refer to meat, poultry, seafood, or related dish names, including statements that say those foods are absent.
4. Vegetarian reasons must discuss only the selected vegetarian candidate's plant ingredients, nutrition, and suitability for the goal.
Return JSON only:
{"candidateIds":["candidate-id"],"reasonById":{"candidate-id":"short Traditional Chinese reason"}}.`

export function logAiPrompt(provider: string, system: string, user: unknown) {
  if (process.env.AI_LOG_PROMPTS !== 'true') return
  console.log(`[ai:prompt:${provider}] ${JSON.stringify({ system, user })}`)
}
