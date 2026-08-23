import { callApi } from '../../services/cloud'
import { formatShortDate } from '../../utils/date'
import { mealName } from '../../utils/nutrition'
import { guardPageAccess } from '../../utils/storage'

interface PartnerDetail {
  profile: {
    nickname: string
    gender: Gender
    mealsPerDay: 2 | 3
  }
  date: string
  meals: MealPlan[]
  weights: WeightRecord[]
}

Page({
  data: {
    loading: true,
    error: '',
    detail: null as PartnerDetail | null,
    meals: [] as Array<MealPlan & { name: string }>,
    weights: [] as Array<WeightRecord & { label: string; barHeight: number }>,
  },

  async onLoad(query: Record<string, string | undefined>) {
    if (!guardPageAccess()) return
    const partnerId = decodeURIComponent(query.id || '')
    if (!partnerId) {
      this.setData({ loading: false, error: '缺少用户信息' })
      return
    }
    const detail = await callApi<PartnerDetail>('binding.partnerDetail', { partnerId })
    if (!detail) {
      this.setData({ loading: false, error: '无法读取该用户数据，请检查绑定状态或云环境' })
      return
    }
    const values = detail.weights.map(item => item.weightKg)
    const min = values.length ? Math.min(...values) : 0
    const max = values.length ? Math.max(...values) : 0
    const weights = detail.weights.slice(-10).map(item => ({
      ...item,
      label: formatShortDate(item.date).replace('月', '/').replace('日', ''),
      barHeight: max === min ? 60 : 24 + (item.weightKg - min) / (max - min) * 76,
    }))
    const meals = detail.meals.map(item => ({ ...item, name: mealName(item.mealType) }))
    this.setData({ loading: false, detail, meals, weights })
  },
})
