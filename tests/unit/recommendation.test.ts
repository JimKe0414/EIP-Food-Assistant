import { describe, expect, it } from 'vitest'
import { chooseRecommendationCandidates, restrictRecommendationIds } from '../../shared/domain/recommendation'

const candidate = (id: string, source: 'eip' | 'custom' | 'tfda') => ({ id, source, name: id })

describe('recommendation fallback', () => {
  it('uses EIP, then custom foods, then TFDA', () => {
    expect(chooseRecommendationCandidates([candidate('e', 'eip')], [candidate('c', 'custom')], [candidate('t', 'tfda')])[0].id).toBe('e')
    expect(chooseRecommendationCandidates([], [candidate('c', 'custom')], [candidate('t', 'tfda')])[0].id).toBe('c')
    expect(chooseRecommendationCandidates([], [], [candidate('t', 'tfda')])[0].id).toBe('t')
    expect(chooseRecommendationCandidates([], [], [candidate('t', 'tfda')], false)).toEqual([])
  })

  it('drops fabricated or duplicate model IDs', () => {
    expect(restrictRecommendationIds(['e:1', 'fake', 'e:1'], ['e:1', 'c:2'])).toEqual(['e:1'])
  })
})
