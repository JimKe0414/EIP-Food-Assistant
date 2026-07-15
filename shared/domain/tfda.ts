export type TfdaFreshness = 'fresh' | 'stale' | 'expired' | 'missing'

export function getTfdaFreshness(lastSuccessfulSync: Date | null, now = new Date()): { status: TfdaFreshness, ageDays: number | null } {
  if (!lastSuccessfulSync) return { status: 'missing', ageDays: null }
  const ageDays = Math.max(0, Math.floor((now.getTime() - lastSuccessfulSync.getTime()) / 86_400_000))
  if (ageDays <= 7) return { status: 'fresh', ageDays }
  if (ageDays <= 30) return { status: 'stale', ageDays }
  return { status: 'expired', ageDays }
}

export function parseTfdaNumeric(value: unknown): { value: number | null, isTrace: boolean } {
  if (value === null || value === undefined) return { value: null, isTrace: false }
  const normalized = String(value).trim()
  if (!normalized || normalized === '—' || normalized === '-') return { value: null, isTrace: false }
  if (/^(tr|trace)$/i.test(normalized)) return { value: 0.001, isTrace: true }
  const numeric = Number(normalized.replaceAll(',', ''))
  if (!Number.isFinite(numeric)) throw new Error(`Invalid numeric value: ${normalized}`)
  return { value: numeric, isTrace: false }
}
