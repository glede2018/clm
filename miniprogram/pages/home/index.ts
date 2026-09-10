import { callApi } from '../../services/cloud'
import { formatDate } from '../../utils/date'
import { activeMealTypes, calculateDailyTarget, calculateMealTarget, mealName, portionsForDisplay } from '../../utils/nutrition'
import { consumeCelebration, getMealsByDate, getProfile, getWeightRecords, guardPageAccess, saveProfile, saveWeightRecord } from '../../utils/storage'

interface MealCard {
  type: MealType
  name: string
  done: boolean
  disabled: boolean
  caption: string
  foods: DisplayPortion[]
  foodSummary: string
  macro: MacroTarget
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10
}

function foodSummary(foods: DisplayPortion[]): string {
  return foods
    .map(food => `${food.name} ${food.grams}g${food.detail ? `（${food.detail}）` : ''}`)
    .join('  ·  ')
}

function sumConsumed(records: MealPlan[]): MacroTarget {
  return records.reduce<MacroTarget>((total, record) => ({
    carbs: roundMacro(total.carbs + record.actual.carbs),
    protein: roundMacro(total.protein + record.actual.protein),
    fat: roundMacro(total.fat + record.actual.fat),
    calories: Math.round(total.calories + record.actual.calories),
  }), { carbs: 0, protein: 0, fat: 0, calories: 0 })
}

Page({
  data: {
    profile: getProfile(),
    dailyTarget: calculateDailyTarget(getProfile()),
    consumed: { carbs: 0, protein: 0, fat: 0, calories: 0 } as MacroTarget,
    intakeProgress: 0,
    intakeProgressScale: 0,
    meals: [] as MealCard[],
    completedCount: 0,
    activeCount: 3,
    celebrationClass: '',
    celebrationText: '',
    weightInput: '',
    weightModalVisible: false,
    weightSaving: false,
  },

  onShow() {
    if (!guardPageAccess()) return
    this.refresh()
  },

  refresh() {
    const profile = getProfile()
    const records = getMealsByDate(formatDate())
    const active = activeMealTypes(profile.mealsPerDay)
    const dailyTarget = calculateDailyTarget(profile)
    const consumed = sumConsumed(records)
    const meals = (['breakfast', 'lunch', 'dinner'] as MealType[]).map(type => {
      const record = records.find(item => item.mealType === type)
      const disabled = !active.includes(type)
      const foods = record ? portionsForDisplay(record.portions) : []
      return {
        type,
        name: mealName(type),
        done: Boolean(record),
        disabled,
        caption: disabled ? '两餐模式' : '选择食材',
        foods,
        foodSummary: foodSummary(foods),
        macro: record?.actual || calculateMealTarget(profile, type),
      }
    })
    const completedCount = meals.filter(meal => meal.done).length
    this.setData({
      profile,
      dailyTarget,
      consumed,
      intakeProgress: Math.min(100, Math.round(consumed.calories / Math.max(1, dailyTarget.calories) * 100)),
      intakeProgressScale: Math.min(1, consumed.calories / Math.max(1, dailyTarget.calories)),
      meals,
      completedCount,
      activeCount: active.length,
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

  openWeightModal() {
    const profile = getProfile()
    const records = getWeightRecords()
    const currentWeight = records.length ? records[records.length - 1].weightKg : profile.weightKg
    this.setData({ weightInput: currentWeight.toFixed(1), weightModalVisible: true })
  },

  closeWeightModal() {
    if (this.data.weightSaving) return
    this.setData({ weightModalVisible: false })
  },

  noop() {},

  onWeightInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ weightInput: event.detail.value })
  },

  async saveWeight() {
    if (this.data.weightSaving) return
    const weightKg = Number(this.data.weightInput)
    if (weightKg < 30 || weightKg > 300) {
      wx.showToast({ title: '请输入 30–300 kg', icon: 'none' })
      return
    }

    const profile = getProfile()
    const record: WeightRecord = { date: formatDate(), weightKg, createdAt: Date.now() }
    const shouldUpdateProfile = Math.abs(weightKg - profile.weightKg) >= 2
    const nextProfile: UserProfile = shouldUpdateProfile
      ? { ...profile, weightKg, updatedAt: Date.now() }
      : profile

    this.setData({ weightSaving: true })
    saveWeightRecord(record)
    if (shouldUpdateProfile) saveProfile(nextProfile)

    try {
      const tasks: Array<Promise<unknown>> = [callApi('weight.save', { record })]
      if (shouldUpdateProfile) tasks.push(callApi('profile.save', { profile: nextProfile }))
      await Promise.all(tasks)
    } finally {
      this.setData({ weightInput: '', weightModalVisible: false, weightSaving: false })
      this.refresh()
    }

    wx.showToast({ title: shouldUpdateProfile ? '方案体重已更新' : '体重已记录', icon: 'success' })
  },

  playCelebration(mealType: MealType) {
    const completed = this.data.completedCount >= this.data.activeCount
    this.setData({
      celebrationClass: 'show',
      celebrationText: completed ? '今天的餐食全部完成' : `${mealName(mealType)}已记录`,
    })
    setTimeout(() => this.setData({ celebrationClass: '', celebrationText: '' }), 1450)
  },
})
