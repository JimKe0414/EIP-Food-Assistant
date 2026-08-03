import { formatDateInTimeZone, formatDateTimeLocalInTimeZone } from '~/shared/domain/date'

export function useAppDate() {
  const config = useRuntimeConfig()
  const timeZone = String(config.public.appTimeZone || 'Asia/Taipei')

  function todayDate() {
    return formatDateInTimeZone(new Date(), timeZone)
  }

  function nowDateTimeLocal() {
    return formatDateTimeLocalInTimeZone(new Date(), timeZone)
  }

  function formatTime(value: string | Date) {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(value))
  }

  function formatCalendarDate(value: string | Date) {
    const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00.000Z`)
      : new Date(value)
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone,
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    }).format(date)
  }

  return { timeZone, todayDate, nowDateTimeLocal, formatTime, formatCalendarDate }
}
