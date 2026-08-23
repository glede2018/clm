export function formatDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatShortDate(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}月${Number(day)}日`
}

export function recentDates(days: number, end = new Date()): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setDate(end.getDate() - (days - index - 1))
    return formatDate(date)
  })
}
