import { describe, expect, it } from 'vitest'
import type { MealCandidate } from '../../shared/domain/ai'
import type { FoodMatchCandidate } from '../../shared/domain/food-matching'
import { matchCandidate, type NutrientRow } from '../../server/services/meals/nutrient-match'

const pool: FoodMatchCandidate[] = [{ id: 'A001', name: '白飯', aliases: null }, { id: 'A002', name: '意麵', aliases: null }]
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
  }]
])

function candidate(overrides: Partial<MealCandidate> = {}): MealCandidate {
  return {
    name: '白飯', portionDescription: null, estimatedGrams: null, confidence: 0.9,
    nutrients: { caloriesKcal: 366, proteinG: 20, fatG: 20, carbsG: 20, fiberG: null, sodiumMg: null },
    ...overrides
  }
}

describe('matchCandidate', () => {
  it('prefers the AI-provided estimatedGrams over back-deriving it from the calorie guess', () => {
    // AI's calorie guess (400) is inconsistent with its own grams guess (200 @ 183kcal/100g
    // = 366) — the grams estimate should win, not get overridden by the calorie guess.
    const result = matchCandidate(candidate({ estimatedGrams: 200, nutrients: { ...candidate().nutrients, caloriesKcal: 400 } }), pool, byId)
    expect(result.candidate.estimatedGrams).toBe(200)
    expect(result.candidate.nutrients).toEqual({ caloriesKcal: 366, proteinG: 6.2, fatG: 0.6, carbsG: 82.4, fiberG: 1.2, sodiumMg: 4 })
    expect(result.gap).toBeNull()
  })

  it('falls back to deriving grams from the calorie guess when the AI gives no estimatedGrams', () => {
    const result = matchCandidate(candidate(), pool, byId)
    // 366 kcal AI guess / 183 kcal per 100g = estimated 200g portion
    expect(result.candidate.estimatedGrams).toBe(200)
    expect(result.candidate.nutrients).toEqual({ caloriesKcal: 366, proteinG: 6.2, fatG: 0.6, carbsG: 82.4, fiberG: 1.2, sodiumMg: 4 })
    expect(result.gap).toBeNull()
  })

  it('caps confidence and records a gap when no food match is found at all', () => {
    const result = matchCandidate(candidate({ name: '不存在的食物xyz' }), pool, byId)
    expect(result.candidate.nutrients).toEqual(candidate().nutrients)
    expect(result.candidate.confidence).toBeLessThanOrEqual(0.5)
    expect(result.gap).toEqual({ matchedSampleId: null, matchedName: null, score: null })
  })

  it('falls back to the AI guess when neither estimatedGrams nor a usable calorie guess exists', () => {
    const result = matchCandidate(candidate({ nutrients: { caloriesKcal: 0, proteinG: null, fatG: null, carbsG: null, fiberG: null, sodiumMg: null } }), pool, byId)
    expect(result.candidate.confidence).toBeLessThanOrEqual(0.5)
    expect(result.gap).toBeNull()
  })

  it('records a gap for a weak match, using it anyway (composite dish force-matched to a raw ingredient)', () => {
    const result = matchCandidate(candidate({ name: '炒麵', estimatedGrams: 100 }), pool, byId)
    expect(result.candidate.nutrients.caloriesKcal).toBe(289)
    expect(result.gap).toMatchObject({ matchedSampleId: 'A002', matchedName: '意麵' })
    expect(result.gap?.score).toBeLessThan(0.75)
  })
})
