import { formatDate } from '../../utils/date'
import { activeMealTypes, calculateDailyTarget, mealName, portionsForDisplay } from '../../utils/nutrition'
import { consumeCelebration, getMealsByDate, getProfile, guardPageAccess } from '../../utils/storage'

interface MealCard {
  type: MealType
  name: string
  icon: string
  done: boolean
  disabled: boolean
  caption: string
  foods: string[]
}

Page({
  data: {
    profile: getProfile(),
    dailyTarget: calculateDailyTarget(getProfile()),
    meals: [] as MealCard[],
    completedCount: 0,
    activeCount: 3,
    ropePosition: 28,
    avatarScaleX: 1,
    avatarScaleY: 1,
    celebrationClass: '',
    celebrationText: '',
  },

  onShow() {
    if (!guardPageAccess()) return
    this.refresh()
  },

  refresh() {
    const profile = getProfile()
    const today = formatDate()
    const records = getMealsByDate(today)
    const active = activeMealTypes(profile.mealsPerDay)
    const meta: Record<MealType, { icon: string; idle: string }> = {
      breakfast: { icon: '🥣', idle: '燕麦 · 鸡蛋 · 蓝莓' },
      lunch: { icon: '🍚', idle: '选择现有食材' },
      dinner: { icon: '🍠', idle: '选择现有食材' },
    }
    const meals = (['breakfast', 'lunch', 'dinner'] as MealType[]).map(type => {
      const record = records.find(item => item.mealType === type)
      const done = Boolean(record)
      const disabled = !active.includes(type)
      return {
        type,
        name: mealName(type),
        icon: meta[type].icon,
        done,
        disabled,
        foods: record
          ? portionsForDisplay(record.portions).map(portion => `${portion.detail || portion.name} ${portion.grams}g`)
          : [],
        caption: disabled
          ? '两餐模式不安排'
          : meta[type].idle,
      }
    })
    const completedCount = meals.filter(meal => meal.done).length
    const bmi = profile.weightKg / Math.pow(profile.heightCm / 100, 2)
    const avatarScaleX = Math.max(0.86, Math.min(1.25, 0.88 + (bmi - 17) * 0.024 + (profile.gender === 'male' ? 0.04 : 0)))
    const avatarScaleY = Math.max(0.92, Math.min(1.08, 0.92 + (profile.heightCm - 145) * 0.0032))

    this.setData({
      profile,
      dailyTarget: calculateDailyTarget(profile),
      meals,
      completedCount,
      activeCount: active.length,
      ropePosition: 24 + completedCount / active.length * 58,
      avatarScaleX: Math.round(avatarScaleX * 100) / 100,
      avatarScaleY: Math.round(avatarScaleY * 100) / 100,
    })

    const celebration = consumeCelebration()
    if (celebration) this.playCelebration(celebration)
  },

  openMeal(event: WechatMiniprogram.TouchEvent) {
    const type = event.currentTarget.dataset.type as MealType
    const meal = this.data.meals.find(item => item.type === type)
    if (!meal || meal.disabled) {
      wx.showToast({ title: '当前为两餐模式', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/meal/index?type=${type}` })
  },

  playCelebration(mealType: MealType) {
    const completed = this.data.completedCount >= this.data.activeCount
    this.setData({
      celebrationClass: 'celebrating',
      celebrationText: completed ? '今日拉锯胜利！' : `${mealName(mealType)}完成，向胜利移动一步！`,
    })
    setTimeout(() => this.setData({ celebrationClass: '' }), 1100)
  },
})
