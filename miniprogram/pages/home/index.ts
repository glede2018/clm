import { productShareHandlers } from '../../utils/share'
import { formatDate } from '../../utils/date'
import { activeMealTypes, calculateDailyTarget, calculateMealTarget, mealName, portionsForDisplay } from '../../utils/nutrition'
import { consumeCelebration, getMealGuideStep, getMealsByDate, getProfile, guardPageAccess, saveMealGuideStep } from '../../utils/storage'

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

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']

function mealTypeForHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 17) return 'lunch'
  return 'dinner'
}

function currentTimeState() {
  const type = mealTypeForHour(new Date().getHours())
  return {
    type,
    index: MEAL_TYPES.indexOf(type),
  }
}

const INITIAL_TIME_STATE = currentTimeState()

Page({
  ...productShareHandlers,
  data: {
    profile: getProfile(),
    dailyTarget: calculateDailyTarget(getProfile()),
    consumed: { carbs: 0, protein: 0, fat: 0, calories: 0 } as MacroTarget,
    intakeProgress: 0,
    intakeProgressScale: 0,
    meals: [] as MealCard[],
    currentMealIndex: INITIAL_TIME_STATE.index,
    activeMealType: INITIAL_TIME_STATE.type,
    completedCount: 0,
    activeCount: 3,
    celebrationClass: '',
    celebrationText: '',
    mealGuideStep: getMealGuideStep(),
    mealGuideReady: false,
    mealGuideTargetStyle: '',
    mealGuideTooltipStyle: '',
    mealGuidePlacement: 'below',
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
    const meals = MEAL_TYPES.map(type => {
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
    const timeState = currentTimeState()
    const storedMealGuideStep = getMealGuideStep()
    const mealGuideStep = storedMealGuideStep > 0 ? 1 : 0
    const fallbackGuideIndex = meals.findIndex(meal => !meal.disabled)
    const focusIndex = mealGuideStep === 1 && meals[timeState.index]?.disabled && fallbackGuideIndex >= 0
      ? fallbackGuideIndex
      : timeState.index
    const focusType = meals[focusIndex]?.type || timeState.type
    if (storedMealGuideStep > 1) saveMealGuideStep(1)
    this.setData({
      profile,
      dailyTarget,
      consumed,
      intakeProgress: Math.min(100, Math.round(consumed.calories / Math.max(1, dailyTarget.calories) * 100)),
      intakeProgressScale: Math.min(1, consumed.calories / Math.max(1, dailyTarget.calories)),
      meals,
      currentMealIndex: focusIndex,
      activeMealType: focusType,
      completedCount,
      activeCount: active.length,
      mealGuideStep,
      mealGuideReady: false,
    }, () => {
      if (mealGuideStep === 1) this.positionMealGuide('.meal-cta')
    })

    const celebration = consumeCelebration()
    if (celebration) this.playCelebration(celebration)
  },

  onMealSlideChange(event: WechatMiniprogram.CustomEvent<{ current: number }>) {
    const currentMealIndex = event.detail.current
    const meal = this.data.meals[currentMealIndex]
    if (!meal) return
    this.setData({ currentMealIndex, activeMealType: meal.type })
  },

  selectMealCard(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const meal = this.data.meals[index]
    if (!meal) return
    if (index !== this.data.currentMealIndex) {
      this.setData({ currentMealIndex: index, activeMealType: meal.type })
      return
    }
    this.openMeal(event)
  },

  selectMealAction(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const meal = this.data.meals[index]
    if (!meal) return
    if (index !== this.data.currentMealIndex) {
      this.setData({ currentMealIndex: index, activeMealType: meal.type })
      return
    }
    this.openMeal(event)
  },

  openMeal(event: WechatMiniprogram.TouchEvent) {
    const type = event.currentTarget.dataset.type as MealType
    const meal = this.data.meals.find(item => item.type === type)
    if (!meal || meal.disabled) {
      wx.showToast({ title: '当前为两餐模式', icon: 'none' })
      return
    }
    if (this.data.mealGuideStep > 0) {
      saveMealGuideStep(2)
      this.setData({ mealGuideReady: false })
    }
    wx.navigateTo({ url: `/pages/meal/index?type=${type}` })
  },

  positionMealGuide(selector: string, adjusted = false) {
    wx.nextTick(() => {
      wx.createSelectorQuery().in(this).select(selector).boundingClientRect(rect => {
        if (!rect || this.data.mealGuideStep !== 1) return
        const windowHeight = wx.getSystemInfoSync().windowHeight
        if (!adjusted && (rect.top < 12 || rect.bottom > windowHeight - 12)) {
          wx.pageScrollTo({
            selector,
            offsetTop: -Math.min(220, Math.round(windowHeight * .28)),
            duration: 280,
            complete: () => setTimeout(() => this.positionMealGuide(selector, true), 70),
          })
          return
        }
        const padding = 7
        const verticalOffset = -10
        const target = {
          top: Math.max(6, rect.top - padding + verticalOffset),
          left: Math.max(6, rect.left - padding),
          right: rect.right + padding,
          bottom: rect.bottom + padding + verticalOffset,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }
        const placement = target.bottom + 190 < windowHeight ? 'below' : 'above'
        const tooltipStyle = placement === 'below'
          ? `top:${target.bottom + 12}px;`
          : `bottom:${windowHeight - target.top + 12}px;`
        this.setData({
          mealGuideReady: true,
          mealGuidePlacement: placement,
          mealGuideTargetStyle: `top:${target.top}px;left:${target.left}px;width:${target.width}px;height:${target.height}px;`,
          mealGuideTooltipStyle: tooltipStyle,
        })
      }).exec()
    })
  },

  dismissMealGuide() {
    saveMealGuideStep(0)
    this.setData({ mealGuideStep: 0, mealGuideReady: false })
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
