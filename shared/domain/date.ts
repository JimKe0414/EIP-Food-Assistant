export const DEFAULT_APP_TIME_ZONE = 'Asia/Taipei'

export function formatDateInTimeZone(date: Date, timeZone = DEFAULT_APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function shiftIsoDate(value: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must use YYYY-MM-DD')
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function isoDateRangeEndingOn(endDate: string, length: number) {
  if (!Number.isInteger(length) || length < 1) throw new Error('Range length must be a positive integer')
  return Array.from({ length }, (_, index) => shiftIsoDate(endDate, index - length + 1))
}
