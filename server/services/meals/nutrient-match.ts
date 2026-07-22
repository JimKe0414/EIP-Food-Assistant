import type { Sql } from 'postgres'
import type { MealAnalysisResult, MealCandidate, PortionEstimate, PortionEstimateQuery } from '../../../shared/domain/ai'
import { findBestFoodMatch, stripCookingMethod, type FoodMatchCandidate } from '../../../shared/domain/food-matching'

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

// Injected rather than a full AiProvider so this stays trivially unit-testable with a plain
// fake function instead of having to stub out the whole provider interface.
export type PortionGramsEstimator = (query: PortionEstimateQuery) => Promise<PortionEstimate>

const SODIUM_KEY = '鈉（mg）'
const STRONG_MATCH_SCORE = 0.75

// AI candidates carry the model's own calorie/macro/weight guesses. When a food match is
// found, this replaces ALL nutrient values (including calories) with the matched TFDA
// food's real per-100g composition scaled by a portion weight — preferring a fresh AI
// estimate grounded in the specific matched food identity, then the AI's original
// (ungrounded) gram guess, then reverse-deriving grams from its calorie guess as a last
// resort. Unmatched candidates are left as pure AI guesses, with their confidence capped so
// the UI can flag them as unverified.
export async function enrichMealAnalysisWithNutrients(result: MealAnalysisResult, sql: Sql, estimateGrams: PortionGramsEstimator): Promise<MealAnalysisResult> {
  const rows = await sql<NutrientRow[]>`
    select sample_id, name, aliases, calories_kcal, protein_g, fat_g, carbs_g, fiber_g, optional_nutrients
    from nutrients
  `
  if (!rows.length) return result

  const pool: FoodMatchCandidate[] = rows.map(row => ({ id: row.sample_id, name: row.name, aliases: row.aliases }))
  const byId = new Map(rows.map(row => [row.sample_id, row]))

  const outcomes = await Promise.all(result.candidates.map(candidate => matchCandidate(candidate, pool, byId, estimateGrams)))
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

interface ResolvedMatch {
  nutrient: NutrientRow
  matchedName: string
  matchedSampleId: string
  score: number
  viaCookingStrip: boolean
}

// Tries the full name first (preserves cooking-method-specific entries like "炸雞排" that
// carry real oil/calorie differences). Only falls back to a cooking-method-stripped name
// when the full name didn't match at all, or matched weakly — a stripped-name match is
// always flagged as a gap even if its score is high, since it means the specific dish/
// cooking-method combination wasn't found as-is.
function resolveMatch(candidateName: string, pool: FoodMatchCandidate[], byId: Map<string, NutrientRow>): ResolvedMatch | null {
  let match = findBestFoodMatch(candidateName, pool)
  let viaCookingStrip = false

  if (!match || match.score < STRONG_MATCH_SCORE) {
    const stripped = stripCookingMethod(candidateName)
    if (stripped && stripped !== candidateName) {
      const strippedMatch = findBestFoodMatch(stripped, pool)
      if (strippedMatch && (!match || strippedMatch.score > match.score)) {
        match = strippedMatch
        viaCookingStrip = true
      }
    }
  }
  if (!match) return null

  const nutrient = byId.get(match.candidate.id)
  if (!nutrient) return null
  return { nutrient, matchedName: match.candidate.name, matchedSampleId: match.candidate.id, score: match.score, viaCookingStrip }
}

export async function matchCandidate(
  candidate: MealCandidate,
  pool: FoodMatchCandidate[],
  byId: Map<string, NutrientRow>,
  estimateGrams: PortionGramsEstimator
): Promise<MatchOutcome> {
  const unverified = (gap: MatchOutcome['gap']): MatchOutcome => ({
    candidate: { ...candidate, confidence: Math.min(candidate.confidence, 0.5) },
    gap
  })

  const found = resolveMatch(candidate.name, pool, byId)
  if (!found) return unverified({ matchedSampleId: null, matchedName: null, score: null })

  const caloriesPer100g = numberOrNull(found.nutrient.calories_kcal)
  const gap = (found.score < STRONG_MATCH_SCORE || found.viaCookingStrip)
    ? { matchedSampleId: found.matchedSampleId, matchedName: found.matchedName, score: round(found.score) }
    : null
  if (!caloriesPer100g || caloriesPer100g <= 0) return unverified(gap)

  const estimatedGrams = await resolveEstimatedGrams(candidate, found, caloriesPer100g, estimateGrams)
  if (estimatedGrams === null) return unverified(gap)

  const scale = (perHundredGram: number | null) => perHundredGram === null ? null : round(perHundredGram * estimatedGrams / 100)

  return {
    candidate: {
      ...candidate,
      estimatedGrams: round(estimatedGrams),
      nutrients: {
        caloriesKcal: scale(caloriesPer100g) ?? 0,
        proteinG: scale(numberOrNull(found.nutrient.protein_g)),
        fatG: scale(numberOrNull(found.nutrient.fat_g)),
        carbsG: scale(numberOrNull(found.nutrient.carbs_g)),
        fiberG: scale(numberOrNull(found.nutrient.fiber_g)),
        sodiumMg: scale(found.nutrient.optional_nutrients?.[SODIUM_KEY] ?? null)
      }
    },
    gap
  }
}

// Priority: (1) ask the model again, now grounded in the specific matched food identity —
// more accurate than its first guess since it knows exactly which TFDA entry this is; (2)
// the AI's own first-pass gram guess, if it gave one; (3) reverse-derive grams from its
// calorie guess as a last resort. (1) is a network call and allowed to fail silently — it's
// a refinement, not a requirement.
async function resolveEstimatedGrams(candidate: MealCandidate, found: ResolvedMatch, caloriesPer100g: number, estimateGrams: PortionGramsEstimator): Promise<number | null> {
  try {
    const refined = await estimateGrams({
      originalDescription: candidate.name,
      portionDescription: candidate.portionDescription,
      matchedFoodName: found.matchedName
    })
    if (refined.estimatedGrams && refined.estimatedGrams > 0) return refined.estimatedGrams
  } catch (error) {
    console.error('[nutrient-match] portion re-estimate failed, falling back', error)
  }

  if (candidate.estimatedGrams && candidate.estimatedGrams > 0) return candidate.estimatedGrams
  const aiCalories = candidate.nutrients.caloriesKcal
  return Number.isFinite(aiCalories) && aiCalories > 0 ? aiCalories / caloriesPer100g * 100 : null
}

function numberOrNull(value: string | null | undefined) { return value === null || value === undefined ? null : Number(value) }
function round(value: number) { return Math.round(value * 100) / 100 }
