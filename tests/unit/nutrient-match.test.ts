import { describe, expect, it } from 'vitest'
import type { MealCandidate } from '../../shared/domain/ai'
import type { FoodMatchCandidate } from '../../shared/domain/food-matching'
import { matchCandidate, type NutrientRow } from '../../server/services/meals/nutrient-match'

const pool: FoodMatchCandidate[] = [{ id: 'A001', name: '白飯', aliases: null }]
const byId = new Map<string, NutrientRow>([
  ['A001', {
    sample_id: 'A001', name: '白飯', aliases: null,
    calories_kcal: '183', protein_g: '3.1', fat_g: '0.3', carbs_g: '41.2', fiber_g: '0.6',
    optional_nutrients: { '鈉（mg）': 2 }
  }]
])

function candidate(overrides: Partial<MealCandidate> = {}): MealCandidate {
  return {
    name: '白飯', portionDescription: null, confidence: 0.9,
    nutrients: { caloriesKcal: 366, proteinG: 20, fatG: 20, carbsG: 20, fiberG: null, sodiumMg: null },
    ...overrides
  }
}

describe('matchCandidate', () => {
  it('replaces AI-guessed macros with TFDA ratios scaled by the AI calorie estimate', () => {
    const result = matchCandidate(candidate(), pool, byId)
    // 366 kcal AI guess / 183 kcal per 100g = estimated 200g portion
    expect(result.nutrients).toEqual({ caloriesKcal: 366, proteinG: 6.2, fatG: 0.6, carbsG: 82.4, fiberG: 1.2, sodiumMg: 4 })
    expect(result.confidence).toBe(0.9)
  })

  it('caps confidence and keeps the AI guess when no food match is found', () => {
    const result = matchCandidate(candidate({ name: '不存在的食物xyz' }), pool, byId)
    expect(result.nutrients).toEqual(candidate().nutrients)
    expect(result.confidence).toBeLessThanOrEqual(0.5)
  })

  it('falls back to the AI guess when the AI calorie estimate is zero', () => {
    const result = matchCandidate(candidate({ nutrients: { caloriesKcal: 0, proteinG: null, fatG: null, carbsG: null, fiberG: null, sodiumMg: null } }), pool, byId)
    expect(result.confidence).toBeLessThanOrEqual(0.5)
  })
})
