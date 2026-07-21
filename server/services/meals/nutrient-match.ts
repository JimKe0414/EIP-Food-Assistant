import type { Sql } from 'postgres'
import type { MealAnalysisResult, MealCandidate } from '../../../shared/domain/ai'
import { findBestFoodMatch, type FoodMatchCandidate } from '../../../shared/domain/food-matching'

export interface NutrientRow {
  sample_id: string
  name: string
  aliases: string | null
  calories_kcal: string | null
  protein_g: string | null
  fat_g: string | null
  carbs_g: string | null
  fiber_g: string | null
  // nutrients has no dedicated sodium column (unlike meals) — TFDA sodium lives in
  // optional_nutrients, a jsonb map keyed by the original Chinese column label.
  optional_nutrients: Record<string, number | null> | null
}

export interface MatchOutcome {
  candidate: MealCandidate
  // null candidate/score means findBestFoodMatch found nothing at all; a non-null one below
  // STRONG_MATCH_SCORE means it matched *something*, but loosely enough to be worth a human
  // double-checking (TFDA catalogs raw ingredients, not composite dishes, so e.g. "炒麵"
  // force-matching to "意麵" is expected, not a bug).
  gap: { matchedSampleId: string | null, matchedName: string | null, score: number | null } | null
}

const SODIUM_KEY = '鈉（mg）'
const STRONG_MATCH_SCORE = 0.75

// AI candidates carry the model's own calorie/macro/weight guesses. When a food match is
// found, this replaces ALL nutrient values (including calories) with the matched TFDA
// food's real per-100g composition scaled by a portion weight — preferring the AI's own
// gram estimate, falling back to reverse-deriving grams from its calorie guess if it didn't
// give one. Unmatched candidates are left as pure AI guesses, with their confidence capped
// so the UI can flag them as unverified.
export async function enrichMealAnalysisWithNutrients(result: MealAnalysisResult, sql: Sql): Promise<MealAnalysisResult> {
  const rows = await sql<NutrientRow[]>`
    select sample_id, name, aliases, calories_kcal, protein_g, fat_g, carbs_g, fiber_g, optional_nutrients
    from nutrients
  `
  if (!rows.length) return result

  const pool: FoodMatchCandidate[] = rows.map(row => ({ id: row.sample_id, name: row.name, aliases: row.aliases }))
  const byId = new Map(rows.map(row => [row.sample_id, row]))

  const outcomes = result.candidates.map(candidate => matchCandidate(candidate, pool, byId))
  await recordGaps(sql, outcomes)
  return { ...result, candidates: outcomes.map(outcome => outcome.candidate) }
}

async function recordGaps(sql: Sql, outcomes: MatchOutcome[]) {
  for (const outcome of outcomes) {
    if (!outcome.gap) continue
    await sql`
      insert into nutrient_match_gaps (query_name, matched_sample_id, matched_name, score)
      values (${outcome.candidate.name}, ${outcome.gap.matchedSampleId}, ${outcome.gap.matchedName}, ${outcome.gap.score})
      on conflict (query_name) do update set
        occurrences = nutrient_match_gaps.occurrences + 1,
        matched_sample_id = excluded.matched_sample_id,
        matched_name = excluded.matched_name,
        score = excluded.score,
        last_seen_at = now()
    `.catch(error => console.error('[nutrient-match] failed to record gap', error))
  }
}

export function matchCandidate(candidate: MealCandidate, pool: FoodMatchCandidate[], byId: Map<string, NutrientRow>): MatchOutcome {
  const unverified = (gap: MatchOutcome['gap']): MatchOutcome => ({
    candidate: { ...candidate, confidence: Math.min(candidate.confidence, 0.5) },
    gap
  })

  const match = findBestFoodMatch(candidate.name, pool)
  if (!match) return unverified({ matchedSampleId: null, matchedName: null, score: null })

  const nutrient = byId.get(match.candidate.id)
  const caloriesPer100g = numberOrNull(nutrient?.calories_kcal)
  const gap = match.score < STRONG_MATCH_SCORE
    ? { matchedSampleId: match.candidate.id, matchedName: match.candidate.name, score: round(match.score) }
    : null
  if (!nutrient || !caloriesPer100g || caloriesPer100g <= 0) return unverified(gap)

  // Prefer the AI's own weight estimate — it's a direct judgment, not a number reverse-
  // engineered from a possibly-unrelated calorie guess. Only back-calculate from calories
  // when the model didn't give one (older prompt/provider, or it genuinely couldn't judge).
  const aiCalories = candidate.nutrients.caloriesKcal
  const estimatedGrams = candidate.estimatedGrams && candidate.estimatedGrams > 0
    ? candidate.estimatedGrams
    : Number.isFinite(aiCalories) && aiCalories > 0 ? aiCalories / caloriesPer100g * 100 : null
  if (estimatedGrams === null) return unverified(gap)

  const scale = (perHundredGram: number | null) => perHundredGram === null ? null : round(perHundredGram * estimatedGrams / 100)

  return {
    candidate: {
      ...candidate,
      estimatedGrams: round(estimatedGrams),
      nutrients: {
        caloriesKcal: scale(caloriesPer100g) ?? 0,
        proteinG: scale(numberOrNull(nutrient.protein_g)),
        fatG: scale(numberOrNull(nutrient.fat_g)),
        carbsG: scale(numberOrNull(nutrient.carbs_g)),
        fiberG: scale(numberOrNull(nutrient.fiber_g)),
        sodiumMg: scale(nutrient.optional_nutrients?.[SODIUM_KEY] ?? null)
      }
    },
    gap
  }
}

function numberOrNull(value: string | null | undefined) { return value === null || value === undefined ? null : Number(value) }
function round(value: number) { return Math.round(value * 100) / 100 }
