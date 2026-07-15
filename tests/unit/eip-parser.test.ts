import { describe, expect, it } from 'vitest'
import { createIdentityHmac } from '../../server/utils/identity'
import { parseEipExport } from '../../server/services/eip/parser'

describe('EIP import parser', () => {
  const secret = 'eip-test-secret'
  const identity = createIdentityHmac('me@example.com', secret)

  it('accepts a valid single-user CSV and binds no request user id', () => {
    const csv = '日期,餐點名稱,熱量(kcal),蛋白質(g),email\n2026/07/15,烤雞便當,620,32,me@example.com\n'
    const result = parseEipExport(Buffer.from(csv), 'orders.csv', identity, secret)
    expect(result.rows[0]).toMatchObject({ mealDate: '2026-07-15', name: '烤雞便當', caloriesKcal: 620, proteinG: 32 })
    expect(result.rows[0]).not.toHaveProperty('userId')
  })

  it('rejects a batch containing multiple names before any insert', () => {
    const csv = '日期,餐點名稱,熱量(kcal),使用者姓名\n2026-07-15,餐A,500,王一\n2026-07-16,餐B,510,王二\n'
    expect(() => parseEipExport(Buffer.from(csv), 'orders.csv', identity, secret)).toThrow(/多個使用者姓名/)
  })
})
