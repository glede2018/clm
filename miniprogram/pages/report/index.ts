import { formatDate, formatShortDate, recentDates } from '../../utils/date'
import { getMealRecords, getProfile, getWeightRecords, getWorkoutLogs, guardPageAccess } from '../../utils/storage'

interface DayExecution {
  date: string
  label: string
  completed: number
  target: number
  percent: number
  barHeight: number
}

Page({
  data: {
    profile: getProfile(),
    latestWeight: '--',
    weightChange: '--',
    executionRate: 0,
    completedMeals: 0,
    workoutCount: 0,
    workoutMinutes: 0,
    days: [] as DayExecution[],
    weights: [] as Array<WeightRecord & { label: string; barHeight: number }>,
  },

  onShow() {
    if (!guardPageAccess()) return
    this.refresh()
  },

  refresh() {
    const profile = getProfile()
    const dates = recentDates(7)
    const meals = getMealRecords()
    const target = profile.mealsPerDay
    const days = dates.map(date => {
      const completed = meals.filter(record => record.date === date).length
      const percent = Math.min(100, Math.round(completed / target * 100))
      return { date, label: date === formatDate() ? '今天' : `${Number(date.slice(8))}日`, completed, target, percent, barHeight: Math.max(8, percent) }
    })
    const completedMeals = days.reduce((sum, day) => sum + day.completed, 0)
    const executionRate = Math.round(completedMeals / Math.max(1, days.length * target) * 100)
    const workouts = getWorkoutLogs().filter(log => dates.includes(log.date))
    const workoutCount = workouts.length
    const workoutMinutes = workouts.reduce((sum, log) => sum + log.durationMinutes, 0)
    const records = getWeightRecords().slice(-7)
    const values = records.map(record => record.weightKg)
    const min = values.length ? Math.min(...values) : 0
    const max = values.length ? Math.max(...values) : 0
    const weights = records.map(record => ({
      ...record,
      label: formatShortDate(record.date).replace('月', '/').replace('日', ''),
      barHeight: max === min ? 55 : 22 + (record.weightKg - min) / (max - min) * 65,
    }))
    const latestWeight = records.length ? records[records.length - 1].weightKg.toFixed(1) : '--'
    const weightChange = records.length > 1 ? `${records[records.length - 1].weightKg - records[0].weightKg > 0 ? '+' : ''}${(records[records.length - 1].weightKg - records[0].weightKg).toFixed(1)}` : '--'
    this.setData({ profile, days, completedMeals, executionRate, workoutCount, workoutMinutes, weights, latestWeight, weightChange })
  },
})
