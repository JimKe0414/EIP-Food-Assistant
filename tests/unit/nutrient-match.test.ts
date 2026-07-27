import { describe, expect, it, vi } from 'vitest'
import type { MealCandidate, PortionEstimate } from '../../shared/domain/ai'
import type { FoodMatchCandidate } from '../../shared/domain/food-matching'
import { matchCandidate, type NutrientRow, type PortionGramsEstimator } from '../../server/services/meals/nutrient-match'

const pool: FoodMatchCandidate[] = [
  { id: 'A001', name: '白飯', aliases: null },
  { id: 'A002', name: '意麵', aliases: null },
  { id: 'A003', name: '魚', aliases: null }
]
const byId = new Map<string, NutrientRow>([
  ['A001', {
    sample_id: 'A001', name: '白飯', aliases: null,
    calories_kcal: '183', protein_g: '3.1', fat_g: '0.3', carbs_g: '41.2', fiber_g: '0.6',
    optional_nutrients: { '鈉（mg）': 2 }
  }],
  ['A002', {
    sample_id: 'A002', name: '意麵', aliases: null,
    calories_kcal: '289', protein_g: '9.0', fat_g: '1.2', carbs_g: '58.0', fiber_g: '2.0',
    optional_nutrients: { '鈉（mg）': 5 }
  }],
  ['A003', {
    sample_id: 'A003', name: '魚', aliases: null,
    calories_kcal: '100', protein_g: '20.0', fat_g: '2.0', carbs_g: '0', fiber_g: '0',
    optional_nutrients: { '鈉（mg）': 50 }
  }]
])

const noRefinement: PortionGramsEstimator = async () => ({ estimatedGrams: null })
function refineTo(grams: number | null): PortionGramsEstimator {
  return async () => ({ estimatedGrams: grams } as PortionEstimate)
}

function candidate(overrides: Partial<MealCandidate> = {}): MealCandidate {
  return {
    name: '白飯', portionDescription: null, estimatedGrams: null, confidence: 0.9,
    nutrients: { caloriesKcal: 366, proteinG: 20, fatG: 20, carbsG: 20, fiberG: null, sodiumMg: null },
    ...overrides
  }
}

describe('matchCandidate', () => {
  it('prefers a fresh AI re-estimate (grounded in the matched food) over everything else', async () => {
    const result = await matchCandidate(candidate({ estimatedGrams: 200, nutrients: { ...candidate().nutrients, caloriesKcal: 400 } }), pool, byId, refineTo(100))
    // re-estimate says 100g, not the candidate's own 200g guess or the 400kcal back-calc
    expect(result.candidate.estimatedGrams).toBe(100)
    expect(result.candidate.nutrients).toEqual({ caloriesKcal: 183, proteinG: 3.1, fatG: 0.3, carbsG: 41.2, fiberG: 0.6, sodiumMg: 2 })
    expect(result.gap).toBeNull()
  })

  it('falls back to the AI-provided estimatedGrams when the re-estimate declines (returns null)', async () => {
    const result = await matchCandidate(candidate({ estimatedGrams: 200, nutrients: { ...candidate().nutrients, caloriesKcal: 400 } }), pool, byId, noRefinement)
    expect(result.candidate.estimatedGrams).toBe(200)
    expect(result.candidate.nutrients).toEqual({ caloriesKcal: 366, proteinG: 6.2, fatG: 0.6, carbsG: 82.4, fiberG: 1.2, sodiumMg: 4 })
    expect(result.gap).toBeNull()
  })

  it('falls back to deriving grams from the calorie guess when nothing else is available', async () => {
    const result = await matchCandidate(candidate(), pool, byId, noRefinement)
    // 366 kcal AI guess / 183 kcal per 100g = estimated 200g portion
    expect(result.candidate.estimatedGrams).toBe(200)
    expect(result.candidate.nutrients).toEqual({ caloriesKcal: 366, proteinG: 6.2, fatG: 0.6, carbsG: 82.4, fiberG: 1.2, sodiumMg: 4 })
    expect(result.gap).toBeNull()
  })

  it('falls back gracefully when the re-estimate call throws', async () => {
    const throwing: PortionGramsEstimator = async () => { throw new Error('network error') }
    const result = await matchCandidate(candidate(), pool, byId, throwing)
    expect(result.candidate.estimatedGrams).toBe(200)
    expect(result.gap).toBeNull()
  })

  it('caps confidence and records a gap when no food match is found at all', async () => {
    const result = await matchCandidate(candidate({ name: '不存在的食物xyz' }), pool, byId, noRefinement)
    expect(result.candidate.nutrients).toEqual(candidate().nutrients)
    expect(result.candidate.confidence).toBeLessThanOrEqual(0.5)
    expect(result.gap).toEqual({ matchedSampleId: null, matchedName: null, score: null })
  })

  it('records a gap for a weak match, using it anyway (composite dish force-matched to a raw ingredient)', async () => {
    const result = await matchCandidate(candidate({ name: '炒麵', estimatedGrams: 100 }), pool, byId, noRefinement)
    expect(result.candidate.nutrients.caloriesKcal).toBe(289)
    expect(result.gap).toMatchObject({ matchedSampleId: 'A002', matchedName: '意麵' })
    expect(result.gap?.score).toBeLessThan(0.75)
  })

  it('falls back to a cooking-method-stripped name when the full name matches nothing, and flags it as a gap even though the stripped match is strong', async () => {
    const result = await matchCandidate(candidate({ name: '紅燒魚', estimatedGrams: 150 }), pool, byId, noRefinement)
    expect(result.candidate.nutrients).toEqual({ caloriesKcal: 150, proteinG: 30, fatG: 3, carbsG: 0, fiberG: 0, sodiumMg: 75 })
    expect(result.gap).toMatchObject({ matchedSampleId: 'A003', matchedName: '魚' })
  })

  it('does not bother calling the re-estimator when there is no match to ground it in', async () => {
    const estimator = vi.fn(noRefinement)
    await matchCandidate(candidate({ name: '不存在的食物xyz' }), pool, byId, estimator)
    expect(estimator).not.toHaveBeenCalled()
  })
})
