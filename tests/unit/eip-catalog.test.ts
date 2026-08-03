import { describe, expect, it } from 'vitest'
import {
  deduplicateEipCatalogItems,
  mergeEipNutritionEstimates,
  normalizeEipCatalogName,
  type EipCatalogDraftItem,
  type EipCatalogItem
} from '../../shared/domain/eip-catalog'

function item(restaurantName: string, name: string, caloriesKcal: number): EipCatalogItem {
  return {
    restaurantName,
    name,
    foodType: 'unknown',
    nutritionEstimated: false,
    nutrients: {
      caloriesKcal,
      proteinG: null,
      fatG: null,
      carbsG: null,
      fiberG: null,
      sodiumMg: null
    }
  }
}

describe('EIP shared catalog identity', () => {
  it('normalizes width, case and repeated whitespace for stable duplicate keys', () => {
    expect(normalizeEipCatalogName('  ＡBC   餐廳 ')).toBe('abc 餐廳')
  })

  it('uses restaurant plus meal as the unique key and keeps the newest imported value', () => {
    const result = deduplicateEipCatalogItems([
      item('幸福食堂', '烤雞便當', 500),
      item('幸福食堂', '  烤雞便當 ', 620),
      item('第二餐廳', '烤雞便當', 700)
    ])

    expect(result).toHaveLength(2)
    expect(result[0].nutrients.caloriesKcal).toBe(620)
    expect(result[1].restaurantName).toBe('第二餐廳')
  })
})

describe('EIP AI nutrition merge', () => {
  const draft: EipCatalogDraftItem = {
    rowId: 'row-2',
    restaurantName: '幸福食堂',
    name: '烤雞便當',
    foodType: 'meat',
    nutrients: {
      caloriesKcal: null,
      proteinG: 32,
      fatG: null,
      carbsG: null,
      fiberG: null,
      sodiumMg: null
    }
  }

  it('fills only missing values and preserves numbers supplied by the import file', () => {
    const [result] = mergeEipNutritionEstimates([draft], {
      items: [{
        rowId: 'row-2',
        nutrients: {
          caloriesKcal: 620,
          proteinG: 18,
          fatG: 20,
          carbsG: 78,
          fiberG: 6,
          sodiumMg: 880
        }
      }]
    })

    expect(result.nutrients).toEqual({
      caloriesKcal: 620,
      proteinG: 32,
      fatG: 20,
      carbsG: 78,
      fiberG: 6,
      sodiumMg: 880
    })
    expect(result.nutritionEstimated).toBe(true)
  })

  it('rejects missing, duplicated or invented AI row IDs', () => {
    expect(() => mergeEipNutritionEstimates([draft], { items: [] })).toThrow()
    expect(() => mergeEipNutritionEstimates([draft], {
      items: [{
        rowId: 'row-999',
        nutrients: {
          caloriesKcal: 620,
          proteinG: 18,
          fatG: 20,
          carbsG: 78,
          fiberG: 6,
          sodiumMg: 880
        }
      }]
    })).toThrow(/did not match/)
  })
})
