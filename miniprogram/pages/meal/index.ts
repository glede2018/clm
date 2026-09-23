import { allFoods } from '../../data/foods'
import { callApi } from '../../services/cloud'
import { formatDate } from '../../utils/date'
import { createMealPlan, mealName, portionsForDisplay } from '../../utils/nutrition'
import { getMealGuideStep, getProfile, guardPageAccess, saveMealGuideStep, saveMealRecord } from '../../utils/storage'

interface FoodChoice extends FoodItem { selected: boolean }
interface FoodSection { category: FoodCategory; label: string; hint: string; foods: FoodChoice[] }

const CATEGORY_META: Partial<Record<FoodCategory, { label: string; hint: string }>> = {
  staple: { label: '主食', hint: '选择 1 种' },
  protein: { label: '肉类 / 蛋白质', hint: '选择 1 种' },
  vegetable: { label: '蔬菜', hint: '可选 1–3 种' },
  fat: { label: '烹调油 / 坚果 / 种子', hint: '建议选 1 种' },
  fruit: { label: '水果', hint: '可选 1 种' },
}

const MEAL_GUIDE_CONTENT: Record<number, { title: string; description: string }> = {
  2: { title: '选择主食', description: '选择这顿饭现有的一种主食，已选中的食材会显示勾选标记。' },
  3: { title: '选择肉类或蛋白质', description: '选择一种肉类、鱼虾、蛋类或其他蛋白质食材。' },
  4: { title: '选择蔬菜', description: '蔬菜可以多选，每餐最多选择 3 种，方案会给出蔬菜合计克重。' },
  5: { title: '选择食用油或坚果', description: '选择烹调油、坚果或种子，用来补足这顿饭需要的脂肪。' },
  6: { title: '确认你的选择', description: '食材确认无误后，点击高亮按钮生成这顿饭的克重方案。' },
}

function mealGuideSelector(step: number): string {
  if (step === 2) return '.food-section-staple'
  if (step === 3) return '.food-section-protein'
  if (step === 4) return '.food-section-vegetable'
  if (step === 5) return '.food-section-fat'
  return '.generate-button'
}

Page({
  onReady() { wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }) },
  onShareAppMessage() {
    return { title: '食克有数｜食材配餐、训练计划，让每一天更有数', path: '/pages/home/index', imageUrl: '/assets/share-logo.png' }
  },
  onShareTimeline() {
    return { title: '食克有数｜选食材、算克重、记饮食和训练', query: 'from=timeline', imageUrl: '/assets/share-logo.png' }
  },
  data: {
    mealType: 'lunch' as MealType,
    mealTitle: '中餐',
    sections: [] as FoodSection[],
    foodCount: allFoods().length,
    selectedIds: [] as string[],
    plan: null as MealPlan | null,
    displayPortions: [] as DisplayPortion[],
    resultVisible: false,
    mealGuideStep: 0,
    mealGuideReady: false,
    mealGuideTargetStyle: '',
    mealGuideTooltipStyle: '',
    mealGuidePlacement: 'below',
    mealGuideTitle: '',
    mealGuideDescription: '',
  },

  onLoad(query: Record<string, string | undefined>) {
    if (!guardPageAccess()) return
    const requested = query.type as MealType
    const mealType: MealType = ['breakfast', 'lunch', 'dinner'].includes(requested) ? requested : 'lunch'
    const foods = allFoods()
    const selectedIds = this.defaultSelection(mealType)
    const storedGuideStep = getMealGuideStep()
    const mealGuideStep = storedGuideStep > 0 ? Math.max(2, storedGuideStep) : 0
    if (mealGuideStep > 0) saveMealGuideStep(mealGuideStep)
    const guideContent = MEAL_GUIDE_CONTENT[mealGuideStep]
    this.setData({
      mealType,
      mealTitle: mealName(mealType),
      selectedIds,
      mealGuideStep,
      mealGuideTitle: guideContent?.title || '',
      mealGuideDescription: guideContent?.description || '',
    })
    this.rebuildSections(foods, selectedIds)
  },

  onShow() {
    if (!this.data.mealTitle) return
    this.rebuildSections(allFoods(), this.data.selectedIds)
    this.setData({ foodCount: allFoods().length })
  },

  onHide() {
    this.setData({ mealGuideReady: false })
  },

  defaultSelection(mealType: MealType): string[] {
    if (mealType === 'breakfast') return ['oats', 'egg', 'pumpkin-seed', 'blueberry']
    if (mealType === 'lunch') return ['rice', 'cooking-oil', 'chicken-breast', 'broccoli']
    return ['sweet-potato', 'beef', 'nuts']
  },

  rebuildSections(foods?: FoodItem[], selectedIds?: string[]) {
    const mealFoods = foods || allFoods()
    const activeIds = selectedIds || this.data.selectedIds
    const categoryOrder: FoodCategory[] = ['staple', 'protein', 'vegetable', 'fat', 'fruit']
    const sections = categoryOrder
      .map(category => {
        const categoryFoods = mealFoods.filter(food => food.category === category)
        const meta = CATEGORY_META[category]
        const selectedCount = categoryFoods.filter(food => activeIds.includes(food.id)).length
        return meta && categoryFoods.length ? {
          category,
          label: meta.label,
          hint: category === 'vegetable' ? `${meta.hint} · 已选 ${selectedCount}/3` : meta.hint,
          foods: categoryFoods.map(food => ({ ...food, selected: activeIds.includes(food.id) })),
        } : null
      })
      .filter((section): section is FoodSection => section !== null)
    this.setData({ sections, selectedIds: activeIds, resultVisible: false, plan: null, displayPortions: [] }, () => {
      if (this.data.mealGuideStep > 0) this.positionMealGuide(mealGuideSelector(this.data.mealGuideStep))
    })
  },

  toggleFood(event: WechatMiniprogram.TouchEvent) {
    const foodId = event.currentTarget.dataset.id as string
    const category = event.currentTarget.dataset.category as FoodCategory
    const food = allFoods().find(item => item.id === foodId)
    if (!food) return

    const alreadySelected = this.data.selectedIds.includes(foodId)
    if (category === 'vegetable') {
      const selectedVegetableIds = this.data.selectedIds.filter(id => allFoods().find(item => item.id === id)?.category === 'vegetable')
      if (!alreadySelected && selectedVegetableIds.length >= 3) {
        wx.showToast({ title: '每餐最多选择 3 种蔬菜', icon: 'none' })
        return
      }
      const selectedIds = alreadySelected
        ? this.data.selectedIds.filter(id => id !== foodId)
        : [...this.data.selectedIds, foodId]
      this.rebuildSections(undefined, selectedIds)
      return
    }

    const sameCategoryIds = allFoods().filter(item => item.category === category).map(item => item.id)
    let selectedIds = this.data.selectedIds.filter(id => !sameCategoryIds.includes(id))
    const canClear = !['staple', 'protein'].includes(category)
    if (!(alreadySelected && canClear)) selectedIds.push(foodId)
    this.rebuildSections(undefined, selectedIds)
  },

  generatePlan() {
    const selectedFoods = allFoods().filter(food => this.data.selectedIds.includes(food.id))
    const categories = selectedFoods.map(food => food.category)
    const required: FoodCategory[] = ['staple', 'protein']
    if (required.some(category => !categories.includes(category))) {
      wx.showToast({ title: '请选齐本餐所需食材', icon: 'none' })
      return
    }

    try {
      const plan = createMealPlan(getProfile(), this.data.mealType, this.data.selectedIds, formatDate())
      this.setData({ plan, displayPortions: portionsForDisplay(plan.portions), resultVisible: true })
      if (this.data.mealGuideStep > 0) {
        saveMealGuideStep(0)
        this.setData({ mealGuideStep: 0, mealGuideReady: false })
      }
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '暂时无法生成方案', icon: 'none' })
    }
  },

  closeResult() { this.setData({ resultVisible: false }) },
  noop() {},

  positionMealGuide(selector: string) {
    wx.nextTick(() => {
      wx.createSelectorQuery().in(this).select(selector).boundingClientRect(rect => {
        if (!rect || this.data.mealGuideStep === 0) return
        const padding = 7
        const extraHeight = this.data.mealGuideStep === 2 ? 40 : 0
        const windowHeight = wx.getSystemInfoSync().windowHeight
        const isFoodStep = this.data.mealGuideStep >= 2 && this.data.mealGuideStep <= 5
        const targetHeight = isFoodStep
          ? Math.min(rect.height + padding * 2 + extraHeight, Math.round(windowHeight * .42))
          : rect.height + padding * 2
        const targetTop = Math.max(6, rect.top - padding)
        const target = {
          top: targetTop,
          left: Math.max(6, rect.left - padding),
          bottom: targetTop + targetHeight,
          width: rect.width + padding * 2,
          height: targetHeight,
        }
        const placement = target.bottom + 205 < windowHeight ? 'below' : 'above'
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

  nextMealGuide() {
    const currentStep = this.data.mealGuideStep
    if (currentStep < 2 || currentStep >= 6) return
    const nextStep = currentStep + 1
    const selector = mealGuideSelector(nextStep)
    const guideContent = MEAL_GUIDE_CONTENT[nextStep]
    saveMealGuideStep(nextStep)
    this.setData({
      mealGuideStep: nextStep,
      mealGuideReady: false,
      mealGuideTitle: guideContent.title,
      mealGuideDescription: guideContent.description,
    }, () => {
      wx.pageScrollTo({
        selector,
        offsetTop: -190,
        duration: 320,
        complete: () => setTimeout(() => this.positionMealGuide(selector), 80),
      })
    })
  },

  dismissMealGuide() {
    saveMealGuideStep(0)
    this.setData({ mealGuideStep: 0, mealGuideReady: false })
  },

  async confirmPlan() {
    if (!this.data.plan) return
    const plan: MealPlan = { ...this.data.plan, completedAt: Date.now() }
    saveMealRecord(plan)
    await callApi('meal.save', { plan })
    wx.showToast({ title: `${this.data.mealTitle}已完成`, icon: 'success' })
    setTimeout(() => wx.navigateBack(), 450)
  },
})
