import { createHash } from 'node:crypto'
import { parse as parseCsv } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { createIdentityHmac } from '~/server/utils/identity'

export interface EipImportRow {
  mealDate: string
  name: string
  caloriesKcal: number
  proteinG: number | null
  fatG: number | null
  carbsG: number | null
  sodiumMg: number | null
}

const columns = {
  date: ['日期'],
  name: ['餐點名稱'],
  calories: ['熱量(kcal)', '熱量（kcal）'],
  protein: ['蛋白質(g)', '蛋白質（g）'],
  fat: ['脂肪(g)', '脂肪（g）'],
  carbs: ['碳水化合物(g)', '碳水化合物（g）'],
  sodium: ['鈉(mg)', '鈉（mg）'],
  email: ['email', '電子郵件', '使用者email'],
  userName: ['使用者姓名', '姓名']
}

export function parseEipExport(buffer: Buffer, fileName: string, currentIdentityHmac: string, hmacSecret: string) {
  if (buffer.byteLength > 10 * 1024 * 1024) throw new EipImportError('FILE_TOO_LARGE', '檔案大小不可超過 10 MB')
  const rawRows = toRows(buffer, fileName)
  if (!rawRows.length) throw new EipImportError('EMPTY_FILE', '匯入檔案沒有資料')
  if (rawRows.length > 5000) throw new EipImportError('TOO_MANY_ROWS', '單次匯入不可超過 5,000 筆')

  const normalizedRows = rawRows.map(row => normalizeRecord(row))
  for (const required of [columns.date, columns.name, columns.calories]) {
    if (!required.some(name => name in normalizedRows[0])) {
      throw new EipImportError('MISSING_REQUIRED_COLUMN', `缺少必要欄位：${required[0]}`)
    }
  }

  const emails = unique(normalizedRows.map(row => first(row, columns.email)).filter(Boolean))
  const identityKeys = emails.map(email => createIdentityHmac(email, hmacSecret))
  if (new Set(identityKeys).size > 1) throw new EipImportError('MULTIPLE_USERS', '檔案包含多位使用者，已拒絕整批匯入')
  if (identityKeys.length && identityKeys[0] !== currentIdentityHmac) {
    throw new EipImportError('IDENTITY_MISMATCH', '檔案身分與目前登入者不符')
  }
  const names = unique(normalizedRows.map(row => first(row, columns.userName)).filter(Boolean))
  if (names.length > 1) throw new EipImportError('MULTIPLE_USERS', '檔案包含多個使用者姓名，已拒絕整批匯入')

  const rows = normalizedRows.map((row, index): EipImportRow => {
    const name = first(row, columns.name).trim()
    if (!name || name.length > 100) throw new EipImportError('INVALID_NAME', `第 ${index + 2} 列餐點名稱無效`)
    return {
      mealDate: parseDate(first(row, columns.date), index),
      name,
      caloriesKcal: positiveNumber(first(row, columns.calories), '熱量', index),
      proteinG: optionalNumber(first(row, columns.protein), '蛋白質', index),
      fatG: optionalNumber(first(row, columns.fat), '脂肪', index),
      carbsG: optionalNumber(first(row, columns.carbs), '碳水化合物', index),
      sodiumMg: optionalNumber(first(row, columns.sodium), '鈉', index)
    }
  })

  return { rows, fileHash: createHash('sha256').update(buffer).digest('hex') }
}

function toRows(buffer: Buffer, fileName: string): Record<string, unknown>[] {
  if (/\.csv$/i.test(fileName)) {
    return parseCsv(buffer, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, unknown>[]
  }
  if (!/\.xlsx?$/i.test(fileName)) throw new EipImportError('UNSUPPORTED_FILE', '僅接受 CSV、XLSX 或 XLS')
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

function parseDate(value: string, index: number) {
  const match = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (!match) throw new EipImportError('INVALID_DATE', `第 ${index + 2} 列日期格式錯誤`)
  const [, year, month, day] = match
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  if (Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) throw new EipImportError('INVALID_DATE', `第 ${index + 2} 列日期無效`)
  return iso
}

function positiveNumber(value: string, field: string, index: number) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new EipImportError('INVALID_NUMBER', `第 ${index + 2} 列${field}必須是正數`)
  return number
}

function optionalNumber(value: string, field: string, index: number) {
  if (!value) return null
  return positiveNumber(value, field, index)
}

function unique(values: string[]) {
  return [...new Set(values.map(value => value.trim().toLowerCase()))]
}

export class EipImportError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'EipImportError'
  }
}
