import { createHash } from 'node:crypto'
import { parse as parseCsv } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { eipCatalogDraftItemSchema, type EipCatalogDraftItem } from '~/shared/domain/eip-catalog'

const columns = {
  restaurant: ['餐廳名稱', '餐廳', '廠商名稱', '供應商'],
  name: ['餐點名稱'],
  foodType: ['葷素', '餐點類型', 'foodtype'],
  calories: ['熱量(kcal)', '熱量（kcal）'],
  protein: ['蛋白質(g)', '蛋白質（g）'],
  fat: ['脂肪(g)', '脂肪（g）'],
  carbs: ['碳水化合物(g)', '碳水化合物（g）'],
  fiber: ['膳食纖維(g)', '膳食纖維（g）'],
  sodium: ['鈉(mg)', '鈉（mg）']
}

export function parseEipMenuCatalog(buffer: Buffer, fileName: string) {
  if (buffer.byteLength > 10 * 1024 * 1024) throw new EipMenuImportError('FILE_TOO_LARGE', '檔案大小不可超過 10 MB')
  const rawRows = toRows(buffer, fileName)
  if (!rawRows.length) throw new EipMenuImportError('EMPTY_FILE', '匯入檔案沒有資料')
  if (rawRows.length > 5000) throw new EipMenuImportError('TOO_MANY_ROWS', '單次匯入不可超過 5,000 筆')

  const normalizedRows = rawRows.map(row => normalizeRecord(row))
  for (const required of [columns.restaurant, columns.name]) {
    if (!required.some(name => normalizeHeader(name) in normalizedRows[0])) {
      throw new EipMenuImportError('MISSING_REQUIRED_COLUMN', `缺少必要欄位：${required[0]}`)
    }
  }

  const rows = normalizedRows.map((row, index): EipCatalogDraftItem => {
    try {
      return eipCatalogDraftItemSchema.parse({
        rowId: `row-${index + 2}`,
        restaurantName: first(row, columns.restaurant),
        name: first(row, columns.name),
        foodType: parseFoodType(first(row, columns.foodType), index),
        nutrients: {
          caloriesKcal: optionalNumber(first(row, columns.calories), '熱量', index),
          proteinG: optionalNumber(first(row, columns.protein), '蛋白質', index),
          fatG: optionalNumber(first(row, columns.fat), '脂肪', index),
          carbsG: optionalNumber(first(row, columns.carbs), '碳水化合物', index),
          fiberG: optionalNumber(first(row, columns.fiber), '膳食纖維', index),
          sodiumMg: optionalNumber(first(row, columns.sodium), '鈉', index)
        }
      })
    } catch (error) {
      if (error instanceof EipMenuImportError) throw error
      throw new EipMenuImportError('INVALID_ROW', `第 ${index + 2} 列的餐廳、餐點名稱或營養數值無效`)
    }
  })

  return { rows, fileHash: createHash('sha256').update(buffer).digest('hex') }
}

function toRows(buffer: Buffer, fileName: string): Record<string, unknown>[] {
  if (/\.csv$/i.test(fileName)) {
    return parseCsv(buffer, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, unknown>[]
  }
  if (!/\.xlsx?$/i.test(fileName)) throw new EipMenuImportError('UNSUPPORTED_FILE', '僅接受 CSV、XLSX 或 XLS')
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
}

function normalizeRecord(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value ?? '').trim()]))
}

function normalizeHeader(header: string) {
  return header.trim().replaceAll(/\s+/g, '').toLowerCase()
}

function first(row: Record<string, string>, candidates: string[]) {
  return candidates.map(normalizeHeader).map(name => row[name]).find(value => value !== undefined) ?? ''
}

function parseFoodType(value: string, index: number): 'meat' | 'veg' | 'unknown' {
  const normalized = value.trim().toLowerCase()
  if (!normalized || ['unknown', '未分類'].includes(normalized)) return 'unknown'
  if (['veg', 'vegetarian', '素', '素食'].includes(normalized)) return 'veg'
  if (['meat', '葷', '葷食'].includes(normalized)) return 'meat'
  throw new EipMenuImportError('INVALID_FOOD_TYPE', `第 ${index + 2} 列葷素欄位必須是葷食、素食或未分類`)
}

function requiredNumber(value: string, field: string, index: number) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new EipMenuImportError('INVALID_NUMBER', `第 ${index + 2} 列${field}必須是非負數`)
  return number
}

function optionalNumber(value: string, field: string, index: number) {
  if (!value) return null
  return requiredNumber(value, field, index)
}

export class EipMenuImportError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'EipMenuImportError'
  }
}
