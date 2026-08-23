import { allFoods } from '../../data/foods'
import { callApi } from '../../services/cloud'
import { formatDate } from '../../utils/date'
import { createMealPlan, mealName } from '../../utils/nutrition'
import { getProfile, guardPageAccess, saveMealRecord } from '../../utils/storage'

interface FoodChoice extends FoodItem { selected: boolean }
interface FoodSection { category: FoodCategory; label: string; hint: string; foods: FoodChoice[] }

const CATEGORY_META: Partial<Record<FoodCategory, { label: string; hint: string }>> = {
  staple: { label: '主食', hint: '选择 1 种' },
  protein: { label: '肉类 / 蛋白质', hint: '选择 1 种' },
  vegetable: { label: '熟蔬菜', hint: '可选 1 种' },
  rawVegetable: { label: '生蔬菜', hint: '可选 1 种' },
  fat: { label: '烹调油 / 坚果 / 种子', hint: '建议选 1 种' },
  fruit: { label: '水果', hint: '可选 1 种' },
}

Page({
  data: {
    mealType: 'lunch' as MealType,
    mealTitle: '中餐',
    sections: [] as FoodSection[],
    foodCount: allFoods().length,
    selectedIds: [] as string[],
    plan: null as MealPlan | null,
    resultVisible: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    if (!guardPageAccess()) return
    const requested = query.type as MealType
    const mealType: MealType = ['breakfast', 'lunch', 'dinner'].includes(requested) ? requested : 'lunch'
    const foods = allFoods()
    const selectedIds = this.defaultSelection(mealType)
    this.setData({ mealType, mealTitle: mealName(mealType), selectedIds })
    this.rebuildSections(foods, selectedIds)
  },

  onShow() {
    if (!this.data.mealTitle) return
    this.rebuildSections(allFoods(), this.data.selectedIds)
    this.setData({ foodCount: allFoods().length })
  },

  defaultSelection(mealType: MealType): string[] {
    if (mealType === 'breakfast') return ['oats', 'egg', 'pumpkin-seed', 'blueberry']
    if (mealType === 'lunch') return ['rice', 'cooking-oil', 'chicken-breast', 'broccoli']
    return ['sweet-potato', 'beef', 'nuts']
  },

  rebuildSections(foods?: FoodItem[], selectedIds?: string[]) {
    const mealFoods = foods || allFoods()
    const activeIds = selectedIds || this.data.selectedIds
    const categoryOrder: FoodCategory[] = ['staple', 'protein', 'vegetable', 'rawVegetable', 'fat', 'fruit']
    const sections = categoryOrder
      .map(category => {
        const categoryFoods = mealFoods.filter(food => food.category === category)
        const meta = CATEGORY_META[category]
        return meta && categoryFoods.length ? {
          category,
          label: meta.label,
          hint: meta.hint,
          foods: categoryFoods.map(food => ({ ...food, selected: activeIds.includes(food.id) })),
        } : null
      })
      .filter((section): section is FoodSection => section !== null)
    this.setData({ sections, selectedIds: activeIds, resultVisible: false, plan: null })
  },

  toggleFood(event: WechatMiniprogram.TouchEvent) {
    const foodId = event.currentTarget.dataset.id as string
    const category = event.currentTarget.dataset.category as FoodCategory
    const food = allFoods().find(item => item.id === foodId)
    if (!food) return

    const sameCategoryIds = allFoods().filter(item => item.category === category).map(item => item.id)
    const alreadySelected = this.data.selectedIds.includes(foodId)
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
      this.setData({ plan, resultVisible: true })
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '暂时无法生成方案', icon: 'none' })
    }
  },

  closeResult() { this.setData({ resultVisible: false }) },
  noop() {},

  async confirmPlan() {
    if (!this.data.plan) return
    const plan: MealPlan = { ...this.data.plan, completedAt: Date.now() }
    saveMealRecord(plan)
    await callApi('meal.save', { plan })
    wx.showToast({ title: `${this.data.mealTitle}已完成`, icon: 'success' })
    setTimeout(() => wx.navigateBack(), 450)
  },
})
