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
  sodium_mg: string | null
}

// AI candidates carry the model's own calorie/macro guesses. This replaces the macro
// *composition* with the matched TFDA food's real per-100g ratios, using the AI's own
// calorie estimate as the portion signal (there is no structured portion-size input yet —
// that lands in a later stage). Unmatched candidates are left as pure AI guesses, with
// their confidence capped so the UI can flag them as unverified.
export async function enrichMealAnalysisWithNutrients(result: MealAnalysisResult, sql: Sql): Promise<MealAnalysisResult> {
  const rows = await sql<NutrientRow[]>`
    select sample_id, name, aliases, calories_kcal, protein_g, fat_g, carbs_g, fiber_g, sodium_mg
    from nutrients
  `
  if (!rows.length) return result

  const pool: FoodMatchCandidate[] = rows.map(row => ({ id: row.sample_id, name: row.name, aliases: row.aliases }))
  const byId = new Map(rows.map(row => [row.sample_id, row]))

  return { ...result, candidates: result.candidates.map(candidate => matchCandidate(candidate, pool, byId)) }
}

export function matchCandidate(candidate: MealCandidate, pool: FoodMatchCandidate[], byId: Map<string, NutrientRow>): MealCandidate {
  const unverified = () => ({ ...candidate, confidence: Math.min(candidate.confidence, 0.5) })

  const match = findBestFoodMatch(candidate.name, pool)
  if (!match) return unverified()

  const nutrient = byId.get(match.candidate.id)
  const caloriesPer100g = numberOrNull(nutrient?.calories_kcal)
  const aiCalories = candidate.nutrients.caloriesKcal
  if (!nutrient || !caloriesPer100g || caloriesPer100g <= 0 || !Number.isFinite(aiCalories) || aiCalories <= 0) return unverified()

  const estimatedGrams = aiCalories / caloriesPer100g * 100
  const scale = (perHundredGram: number | null) => perHundredGram === null ? null : round(perHundredGram * estimatedGrams / 100)

  return {
    ...candidate,
    nutrients: {
      caloriesKcal: aiCalories,
      proteinG: scale(numberOrNull(nutrient.protein_g)),
      fatG: scale(numberOrNull(nutrient.fat_g)),
      carbsG: scale(numberOrNull(nutrient.carbs_g)),
      fiberG: scale(numberOrNull(nutrient.fiber_g)),
      sodiumMg: scale(numberOrNull(nutrient.sodium_mg))
    }
  }
}

function numberOrNull(value: string | null | undefined) { return value === null || value === undefined ? null : Number(value) }
function round(value: number) { return Math.round(value * 100) / 100 }
