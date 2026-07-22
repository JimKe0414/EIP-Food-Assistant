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
{"candidates":[{"name":"string","portionDescription":"string|null","estimatedGrams":0,"confidence":0.0,"nutrients":{"caloriesKcal":0,"proteinG":0,"fatG":0,"carbsG":0,"fiberG":0,"sodiumMg":0}}],"summary":"string"}.
For portionDescription, describe the amount using a bowl-fraction phrase in Traditional Chinese such as
"一碗"、"半碗"、"四分之一碗"（or an equivalent unit like 一份/一片 when a bowl does not make sense for that food）,
picking whichever fraction most closely matches what you observe. Use null only when the portion truly cannot be judged.
estimatedGrams is your own best-guess weight of that portion in grams (a plain number, e.g. 150) — this is used
downstream to scale nutrient values against a food-composition database, so give a real estimate whenever you can
judge the portion at all; only use null when you genuinely cannot judge a weight.
Use null for a nutrient value when it cannot be estimated. Do not provide medical diagnosis.`

export const recommendationSystemPrompt = `Select only candidate IDs present in candidateIds. Return JSON only:
{"candidateIds":["uuid"],"reasonById":{"uuid":"short reason"}}. Never invent IDs.
If nutrientTargets is non-empty, it is the user's remaining nutrient budget for the rest of today (calories/protein/
fat/carbs already adjusted for what they've logged so far) — prefer candidates whose calories fit within
nutrientTargets.caloriesKcal rather than picking the largest/richest option regardless of it, and mention the fit in
reasonById when it influenced your pick. An empty nutrientTargets means the user hasn't set up a profile yet —
fall back to goal and recentMealNames only.`

export const portionEstimateSystemPrompt = `Estimate the weight in grams of one food portion. You are given JSON with:
originalDescription (what the user/model first said this food was), portionDescription (a rough portion phrase like
一碗/半碗/一份, may be absent), and matchedFoodName (the specific food-composition-database entry this was matched
to — trust this as the concrete food identity over your own reading of originalDescription, since it is the entry
whose per-100g nutrition values will actually be used).
Return JSON only: {"estimatedGrams": number|null}. Use null only if you genuinely cannot judge a weight.`
