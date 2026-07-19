import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseWorkbook } from '../../server/services/tfda/sync'

function buildWorkbook(rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}

const newFormatHeader = [
  '整合編號', '樣品名稱', '內容物描述', '俗名', '廢棄率(%)', '熱量(kcal)', '修正熱量(kcal)',
  '水分(g)', '粗蛋白(g)', '粗脂肪(g)', '飽和脂肪(g)', '灰分(g)', '總碳水化合物(g)', '膳食纖維(g)', '糖質總量(g)'
]

describe('TFDA workbook parser', () => {
  it('parses the 2025版UPDATE1 layout: footnote on row 1, real header on row 2, renamed columns', () => {
    const buffer = buildWorkbook([
      ['*本資料庫所列數值單位均為每100 g可食部分之含量。'],
      newFormatHeader,
      ['A001', '白飯', '', '', 0, 183, 183, 68.6, 3.1, 0.3, 0.1, 0.4, 41.2, 0.6, 0.1]
    ])

    const parsed = parseWorkbook(buffer, 'test-hash')
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0]).toMatchObject({ sampleId: 'A001', name: '白飯', caloriesKcal: 183, sugarG: 0.1 })
  })

  it('still parses the legacy layout: header on row 1, original column names', () => {
    const buffer = buildWorkbook([
      ['樣品編號', '樣品名稱', '內容物描述', '俗名', '廢棄率(%)', '熱量(kcal)', '修正熱量(kcal)',
        '水分(g)', '粗蛋白(g)', '粗脂肪(g)', '飽和脂肪(g)', '灰分(g)', '總碳水化合物(g)', '膳食纖維(g)', '糖質(g)'],
      ['B002', '糙米飯', '', '', 0, 173, 173, 66.0, 3.3, 1.2, 0.3, 0.6, 37.3, 1.7, 0.2]
    ])

    const parsed = parseWorkbook(buffer, 'test-hash-2')
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0]).toMatchObject({ sampleId: 'B002', name: '糙米飯', sugarG: 0.2 })
  })

  it('throws a clear error when a required column is missing entirely', () => {
    const buffer = buildWorkbook([
      ['樣品名稱', '熱量(kcal)'],
      ['白飯', 183]
    ])
    expect(() => parseWorkbook(buffer, 'test-hash-3')).toThrow(/required columns missing/)
  })
})
