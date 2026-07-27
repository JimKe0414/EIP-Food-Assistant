import { describe, expect, it } from 'vitest'
import { compareMealsByTypeThenRecordedAt, mealBatchInputSchema, mealInputSchema, mealUpdateInputSchema } from '../../shared/domain/meals'

const baseMeal = {
  mealDate: '2026-07-27',
  mealTime: '12:00',
  mealType: 'lunch' as const,
  source: 'manual' as const,
  name: '雞胸肉',
  confirmed: true as const,
  nutrients: {
    caloriesKcal: 180,
    proteinG: 30,
    fatG: 4,
    carbsG: 2,
    fiberG: 0,
    sodiumMg: 320
  }
}

describe('meal persistence input', () => {
  it('accepts an explicit actual meal time and keeps legacy queued input compatible', () => {
    expect(mealInputSchema.parse(baseMeal).mealTime).toBe('12:00')
    const { mealTime: _mealTime, ...legacyMeal } = baseMeal
    expect(mealInputSchema.parse(legacyMeal).mealTime).toBeUndefined()
  })

  it('accepts up to ten selected candidates in one batch', () => {
    const batch = mealBatchInputSchema.parse({
      meals: [
        baseMeal,
        { ...baseMeal, name: '燙青菜' }
      ]
    })
    expect(batch.meals).toHaveLength(2)
  })

  it('validates editable meal details without changing record metadata', () => {
    const update = mealUpdateInputSchema.parse({
      mealDate: '2026-07-27',
      mealTime: '18:30',
      mealType: 'dinner',
      name: '雞胸肉便當',
      nutrients: baseMeal.nutrients,
      summary: null
    })

    expect(update).toMatchObject({
      mealDate: '2026-07-27',
      mealTime: '18:30',
      mealType: 'dinner',
      name: '雞胸肉便當'
    })
    expect(() => mealUpdateInputSchema.parse({ ...update, mealTime: '25:00' })).toThrow()
  })

  it('orders meal periods first and record time second', () => {
    const meals = [
      { mealType: 'dinner' as const, createdAt: '2026-07-27T10:00:00.000Z' },
      { mealType: 'breakfast' as const, createdAt: '2026-07-27T01:00:00.000Z' },
      { mealType: 'lunch' as const, createdAt: '2026-07-27T06:00:00.000Z' },
      { mealType: 'breakfast' as const, createdAt: '2026-07-27T02:00:00.000Z' }
    ]

    expect(meals.sort(compareMealsByTypeThenRecordedAt)).toEqual([
      { mealType: 'breakfast', createdAt: '2026-07-27T02:00:00.000Z' },
      { mealType: 'breakfast', createdAt: '2026-07-27T01:00:00.000Z' },
      { mealType: 'lunch', createdAt: '2026-07-27T06:00:00.000Z' },
      { mealType: 'dinner', createdAt: '2026-07-27T10:00:00.000Z' }
    ])
  })
})
