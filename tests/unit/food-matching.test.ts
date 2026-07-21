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

  it('matches names that differ by a single inserted/substituted character', () => {
    const candidates = [{ id: '1', name: '白飯' }, { id: '2', name: '烤地瓜' }]
    // AI output commonly adds a word, e.g. "白飯" -> "白米飯" — should still resolve to
    // the same TFDA entry, not fall through to "no match". (Simplified-Chinese AI output
    // like "白米饭" is a separate, unhandled problem — see FEATURE-PLAN.md.)
    expect(findBestFoodMatch('白米飯', candidates)?.candidate.id).toBe('1')
  })

  it('does not force a match onto an unrelated candidate', () => {
    const match = findBestFoodMatch('炸雞排', [{ id: '1', name: '白飯' }, { id: '2', name: '烤地瓜' }])
    expect(match).toBeNull()
  })
})
