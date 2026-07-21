import { describe, expect, it } from 'vitest'
import { scaleNutrients } from '../../composables/usePortionAdjustment'

describe('scaleNutrients', () => {
  const base = { caloriesKcal: 200, proteinG: 10, fatG: 4, carbsG: 30, fiberG: null, sodiumMg: 500 }

  it('scales every nutrient by the given factor, preserving null', () => {
    expect(scaleNutrients(base, 0.5)).toEqual({ caloriesKcal: 100, proteinG: 5, fatG: 2, carbsG: 15, fiberG: null, sodiumMg: 250 })
  })

  it('is a no-op at factor 1', () => {
    expect(scaleNutrients(base, 1)).toEqual(base)
  })

  it('rounds to 2 decimal places', () => {
    const result = scaleNutrients({ ...base, proteinG: 3.333 }, 1.5)
    expect(result.proteinG).toBe(5)
  })
})
