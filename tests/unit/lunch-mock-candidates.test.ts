import { describe, expect, it } from 'vitest'
import { getMockLunchCandidates } from '../../server/services/lunch/mock-candidates'
import { enforceLunchRecommendationPolicy, type LunchContext } from '../../shared/domain/ai'

describe('lunch mock candidates', () => {
  it('uses distinct candidate payloads for meat and vegetarian selections', () => {
    const meat = getMockLunchCandidates('meat')
    const veg = getMockLunchCandidates('veg')

    expect(meat.map(item => item.id)).toEqual(['mock:chicken', 'mock:beef', 'mock:salmon'])
    expect(veg.map(item => item.id)).toEqual(['mock:tofu', 'mock:chickpea', 'mock:mushroom-soba'])
    expect(meat.map(item => item.id)).not.toEqual(veg.map(item => item.id))
  })
})

describe('vegetarian recommendation policy', () => {
  const context: LunchContext = {
    goal: '均衡飲食',
    foodType: 'veg',
    candidateIds: ['mock:tofu'],
    candidates: [getMockLunchCandidates('veg')[0]!],
    recentMealNames: [],
    nutrientTargets: {}
  }

  it('accepts vegetarian-only candidates and reasons', () => {
    expect(enforceLunchRecommendationPolicy(context, {
      candidateIds: ['mock:tofu'],
      reasonById: { 'mock:tofu': '豆腐提供植物性蛋白質，搭配多色蔬菜。' }
    }).candidateIds).toEqual(['mock:tofu'])
  })

  it('rejects animal-food references in vegetarian reasons', () => {
    expect(() => enforceLunchRecommendationPolicy(context, {
      candidateIds: ['mock:tofu'],
      reasonById: { 'mock:tofu': '蛋白質可取代雞胸。' }
    })).toThrow(/animal-food content/i)
  })

  it('rejects candidates that were not supplied to the AI', () => {
    expect(() => enforceLunchRecommendationPolicy(context, {
      candidateIds: ['mock:chicken'],
      reasonById: { 'mock:chicken': '不應出現' }
    })).toThrow(/outside the supplied list/i)
  })
})
