import { describe, expect, it } from 'vitest'
import { calculateBodyMetrics } from '../../shared/domain/body-metrics'

describe('body metrics', () => {
  it('uses Katch-McArdle when body fat is provided', () => {
    const result = calculateBodyMetrics({ age: 35, sex: 'male', height: 173, weight: 68.2, bodyFat: 20, muscle: null, activity: 1.2 })
    expect(result).toMatchObject({ bmi: 22.8, ibw: 65.8, usesEstimatedBmr: false })
    expect(result.bmr).toBe(1548)
    expect(result.tdee).toBe(1858)
  })

  it('derives protein/fat/carb gram targets from bodyweight and TDEE', () => {
    const result = calculateBodyMetrics({ age: 35, sex: 'male', height: 173, weight: 68.2, bodyFat: 20, muscle: null, activity: 1.2 })
    expect(result.proteinTargetG).toBe(82)
    expect(result.fatTargetG).toBe(62)
    expect(result.carbsTargetG).toBe(243)
    // protein + fat + carb calories should roughly reconstruct the TDEE they were split from
    expect(result.proteinTargetG * 4 + result.fatTargetG * 9 + result.carbsTargetG * 4).toBeCloseTo(result.tdee, -1)
  })

  it('falls back to Mifflin-St Jeor and labels the result as estimated', () => {
    const result = calculateBodyMetrics({ age: 40, sex: 'female', height: 160, weight: 55, bodyFat: null, muscle: null, activity: 1.375 })
    expect(result).toMatchObject({ bmr: 1189, tdee: 1635, usesEstimatedBmr: true, fatMass: null, lbm: null })
  })
})
