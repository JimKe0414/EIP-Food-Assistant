import { describe, expect, it } from 'vitest'
import { parseEipMenuCatalog } from '../../server/services/eip/menu-parser'

describe('EIP shared menu import parser', () => {
  it('reads restaurant, meal, food type and nutrients without user identity fields', () => {
    const csv = [
      '餐廳名稱,餐點名稱,葷素,熱量(kcal),蛋白質(g)',
      '幸福食堂,烤雞便當,葷食,620,32',
      '綠意廚房,香煎豆腐餐盒,素食,520,24'
    ].join('\n')

    const result = parseEipMenuCatalog(Buffer.from(csv), 'menu.csv')

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      restaurantName: '幸福食堂',
      name: '烤雞便當',
      foodType: 'meat',
      nutrients: { caloriesKcal: 620, proteinG: 32 }
    })
    expect(result.rows[0]).not.toHaveProperty('userId')
    expect(result.rows[1].foodType).toBe('veg')
  })

  it('requires restaurant name as part of every shared menu row', () => {
    const csv = '餐點名稱,熱量(kcal)\n烤雞便當,620\n'
    expect(() => parseEipMenuCatalog(Buffer.from(csv), 'menu.csv')).toThrow(/餐廳名稱/)
  })

  it('accepts a file with no nutrition columns so AI can estimate them later', () => {
    const csv = '餐廳名稱,餐點名稱,葷素\n幸福食堂,烤雞便當,葷食\n綠意廚房,豆腐餐盒,素食\n'
    const result = parseEipMenuCatalog(Buffer.from(csv), 'menu.csv')

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      rowId: 'row-2',
      nutrients: {
        caloriesKcal: null,
        proteinG: null,
        fatG: null,
        carbsG: null,
        fiberG: null,
        sodiumMg: null
      }
    })
  })
})
