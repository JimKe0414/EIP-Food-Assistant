import { describe, expect, it } from 'vitest'
import { convertToGrams, findBestFoodMatch } from '../../shared/domain/food-matching'

describe('food matching', () => {
  it('matches aliases and common Chinese synonyms', () => {
    const match = findBestFoodMatch('烤番薯', [
      { id: '1', name: '烤地瓜', aliases: '甘藷' },
      { id: '2', name: '白飯' }
    ])
    expect(match?.candidate.id).toBe('1')
  })

  it('converts supported units', () => {
    expect(convertToGrams(1.5, 'kg')).toBe(1500)
    expect(convertToGrams(2, '份', 80)).toBe(160)
  })
})
