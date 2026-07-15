import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { desc, eq } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { nutrientSyncLogs, nutrientVersions, nutrients, nutrientsStaging } from '~/db/schema'
import { parseTfdaNumeric } from '~/shared/domain/tfda'

const requiredColumns = [
  '樣品編號', '樣品名稱', '俗名', '內容物描述', '廢棄率（%）', '熱量（kcal）', '修正熱量（kcal）',
  '水分（g）', '粗蛋白（g）', '粗脂肪（g）', '飽和脂肪（g）', '灰分（g）',
  '總碳水化合物（g）', '膳食纖維（g）', '糖質（g）'
]
const optionalColumns = [
  '膽固醇（mg）', '鈉（mg）', '鉀（mg）', '鈣（mg）', '鎂（mg）', '鐵（mg）', '鋅（mg）', '磷（mg）',
  '維生素A（μgRE）', '維生素B1（mg）', '維生素B2（mg）', '菸鹼素（mg）', '維生素C（mg）', '維生素E（mg）'
]

interface SourceMetadata { etag?: string | null, lastModified?: string | null }

export async function syncTfdaFromBuffer(buffer: Buffer, source: SourceMetadata = {}) {
  const fileHash = sha256(buffer)
  const database = useDatabase()
  const [existing] = await database.select().from(nutrientVersions).where(eq(nutrientVersions.fileHash, fileHash)).limit(1)
  if (existing) {
    await database.insert(nutrientSyncLogs).values({ status: 'no_change', message: '檔案雜湊未變動', fileHash })
    return { status: 'no_change' as const, fileHash, rowCount: existing.rowCount, warnings: [] }
  }

  try {
    const parsed = parseWorkbook(buffer, fileHash)
    await database.transaction(async transaction => {
      await transaction.delete(nutrientsStaging)
      for (const chunk of chunks(parsed.rows, 250)) {
        await transaction.insert(nutrientsStaging).values(chunk.map(row => ({ sampleId: row.sampleId, payload: row, versionHash: fileHash })))
      }
      await transaction.delete(nutrients)
      for (const chunk of chunks(parsed.rows, 250)) {
        await transaction.insert(nutrients).values(chunk.map(row => ({
          sampleId: row.sampleId,
          name: row.name,
          aliases: row.aliases,
          description: row.description,
          wastePercent: value(row.wastePercent),
          caloriesKcal: value(row.caloriesKcal),
          adjustedCaloriesKcal: value(row.adjustedCaloriesKcal),
          waterG: value(row.waterG), proteinG: value(row.proteinG), fatG: value(row.fatG),
          saturatedFatG: value(row.saturatedFatG), ashG: value(row.ashG), carbsG: value(row.carbsG),
          fiberG: value(row.fiberG), sugarG: value(row.sugarG), optionalNutrients: row.optionalNutrients,
          traceFields: row.traceFields, versionHash: fileHash
        })))
      }
      await transaction.insert(nutrientVersions).values({
        fileHash,
        columnsHash: parsed.columnsHash,
        sourceEtag: source.etag,
        sourceLastModified: source.lastModified,
        rowCount: parsed.rows.length
      })
      await transaction.insert(nutrientSyncLogs).values({
        status: 'success', message: parsed.warnings.length ? `同步完成；${parsed.warnings.join('；')}` : '同步完成', fileHash, rowCount: parsed.rows.length
      })
      await transaction.delete(nutrientsStaging)
    })
    return { status: 'success' as const, fileHash, rowCount: parsed.rows.length, warnings: parsed.warnings }
  } catch (error) {
    await database.insert(nutrientSyncLogs).values({ status: 'failed', message: safeMessage(error), fileHash })
    throw error
  }
}

export async function syncTfdaFromUrl(url: string) {
  const database = useDatabase()
  const [latest] = await database.select().from(nutrientVersions).orderBy(desc(nutrientVersions.syncedAt)).limit(1)
  const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) })
  if (!head.ok) throw new Error(`TFDA HEAD returned HTTP ${head.status}`)
  const etag = head.headers.get('etag')
  const lastModified = head.headers.get('last-modified')
  if ((etag && etag === latest?.sourceEtag) || (lastModified && lastModified === latest?.sourceLastModified)) {
    await database.insert(nutrientSyncLogs).values({ status: 'no_change', message: 'ETag / Last-Modified 未變動' })
    return { status: 'no_change' as const, fileHash: latest?.fileHash, rowCount: latest?.rowCount ?? 0, warnings: [] }
  }

  const tempDirectory = await mkdtemp(join(tmpdir(), 'tfda-'))
  const tempFile = join(tempDirectory, 'nutrients.xlsx')
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`TFDA download returned HTTP ${response.status}`)
    await writeFile(tempFile, Buffer.from(await response.arrayBuffer()))
    return await syncTfdaFromBuffer(await readFile(tempFile), { etag, lastModified })
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
  }
}

function parseWorkbook(buffer: Buffer, fileHash: string) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error('TFDA workbook does not contain Sheet 1')
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (!rawRows.length) throw new Error('TFDA workbook is empty')
  const headerMap = new Map(Object.keys(rawRows[0]).map(header => [normalize(header), header]))
  const missing = requiredColumns.filter(column => !headerMap.has(normalize(column)))
  if (missing.length) throw new Error(`TFDA required columns missing: ${missing.join(', ')}`)

  const known = new Set([...requiredColumns, ...optionalColumns].map(normalize))
  const unknown = [...headerMap.keys()].filter(column => !known.has(column))
  const warnings = unknown.length ? [`發現 ${unknown.length} 個未知欄位，已忽略`] : []
  const columnsHash = sha256(Buffer.from([...headerMap.keys()].sort().join('\n')))

  const rows = rawRows.map((raw, index) => {
    const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [normalize(key), value]))
    const traceFields: string[] = []
    const number = (column: string) => {
      const parsed = parseTfdaNumeric(row[normalize(column)])
      if (parsed.isTrace) traceFields.push(column)
      return parsed.value
    }
    const sampleId = String(row[normalize('樣品編號')] ?? '').trim()
    const name = String(row[normalize('樣品名稱')] ?? '').trim()
    if (!sampleId || !name) throw new Error(`TFDA row ${index + 2} is missing sample ID or name`)

    return {
      sampleId, name,
      aliases: String(row[normalize('俗名')] ?? '').trim() || null,
      description: String(row[normalize('內容物描述')] ?? '').trim() || null,
      wastePercent: number('廢棄率（%）'), caloriesKcal: number('熱量（kcal）'), adjustedCaloriesKcal: number('修正熱量（kcal）'),
      waterG: number('水分（g）'), proteinG: number('粗蛋白（g）'), fatG: number('粗脂肪（g）'), saturatedFatG: number('飽和脂肪（g）'),
      ashG: number('灰分（g）'), carbsG: number('總碳水化合物（g）'), fiberG: number('膳食纖維（g）'), sugarG: number('糖質（g）'),
      optionalNutrients: Object.fromEntries(optionalColumns.map(column => [column, number(column)])),
      traceFields, versionHash: fileHash
    }
  })
  return { rows, columnsHash, warnings }
}

function normalize(value: string) { return value.replaceAll(/\s+/g, '').replaceAll('(', '（').replaceAll(')', '）').toLowerCase() }
function sha256(value: Buffer) { return createHash('sha256').update(value).digest('hex') }
function value(input: number | null) { return input === null ? null : String(input) }
function safeMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 500) : 'Unknown TFDA sync error' }
function chunks<T>(rows: T[], size: number) { return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size)) }
