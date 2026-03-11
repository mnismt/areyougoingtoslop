export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export const startOfLocalDay = (date: Date) => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

export const toDateKey = (date: Date) => {
  const normalized = startOfLocalDay(date)
  const year = normalized.getFullYear()
  const month = String(normalized.getMonth() + 1).padStart(2, '0')
  const day = String(normalized.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const dateKeyToDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const dateKeyToTime = (dateKey: string) => {
  return dateKeyToDate(dateKey).getTime()
}

export const formatDate = (dateKey: string) => {
  return dateKeyToDate(dateKey).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export const buildHeatmapGrid = (windowDays: number, now = new Date()) => {
  const end = startOfLocalDay(now)
  const start = startOfLocalDay(now)
  start.setDate(start.getDate() - windowDays)

  // Align start to Monday so the final week still reaches today.
  const dayOfWeek = start.getDay()
  const toMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  start.setDate(start.getDate() - toMonday)

  const weeks: string[][] = []
  const monthLabels: { week: number; label: string }[] = []
  let lastMonth = -1
  const cursor = new Date(start)

  while (cursor <= end) {
    const week: string[] = []
    for (let day = 0; day < 7; day++) {
      if (cursor > end) {
        week.push('')
      } else {
        const key = toDateKey(cursor)
        week.push(key)
        if (day === 0 && cursor.getMonth() !== lastMonth) {
          lastMonth = cursor.getMonth()
          monthLabels.push({
            week: weeks.length,
            label: MONTH_NAMES[lastMonth],
          })
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    weeks.push(week)
  }

  return { weeks, monthLabels }
}

export const getFilterStartTime = (filterDays: number, now = new Date()) => {
  const cutoff = startOfLocalDay(now)
  cutoff.setDate(cutoff.getDate() - filterDays)
  return cutoff.getTime()
}
