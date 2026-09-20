import { productShareHandlers } from '../../utils/share'
import { callApi } from '../../services/cloud'
import { createProfileDraft, getAuthSession, markInitialized, saveProfile } from '../../utils/storage'

const STEP_TITLES = ['身体基础信息', '饮食与运动习惯']

Page({
  ...productShareHandlers,
  data: {
    step: 0,
    totalSteps: STEP_TITLES.length,
    title: STEP_TITLES[0],
    profile: createProfileDraft(getAuthSession() || undefined),
    genderChosen: true,
    exerciseChosen: true,
    mealsChosen: true,
    saving: false,
    exerciseOptions: [
      { tier: 1, label: '每周 2–3 小时', caption: '约 2 次', hours: 2.5, times: 2 },
      { tier: 2, label: '每周 4–5 小时', caption: '约 3 次', hours: 4.5, times: 3 },
      { tier: 3, label: '每周 6–7 小时', caption: '约 4 次', hours: 6.5, times: 4 },
      { tier: 4, label: '每周 8–10 小时', caption: '约 5 次', hours: 9, times: 5 },
    ],
  },

  onLoad() {
    if (!getAuthSession()?.loggedIn) wx.reLaunch({ url: '/pages/login/index' })
  },

  adjustNumber(event: WechatMiniprogram.TouchEvent) {
    const field = event.currentTarget.dataset.field as 'age' | 'heightCm' | 'weightKg'
    const direction = Number(event.currentTarget.dataset.direction)
    const rules = {
      age: { min: 18, max: 100, step: 1 },
      heightCm: { min: 130, max: 230, step: 1 },
      weightKg: { min: 30, max: 300, step: 0.5 },
    }
    const rule = rules[field]
    const current = Number(this.data.profile[field])
    const value = Math.max(rule.min, Math.min(rule.max, current + direction * rule.step))
    this.setData({ [`profile.${field}`]: Math.round(value * 10) / 10 })
  },

  onNumberBlur(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field as 'age' | 'heightCm' | 'weightKg'
    const rules = {
      age: { min: 18, max: 100, integer: true },
      heightCm: { min: 130, max: 230, integer: true },
      weightKg: { min: 30, max: 300, integer: false },
    }
    const rule = rules[field]
    const inputValue = Number(event.detail.value)
    const current = Number(this.data.profile[field])
    const rawValue = Number.isFinite(inputValue) && event.detail.value !== '' ? inputValue : current
    const bounded = Math.max(rule.min, Math.min(rule.max, rawValue))
    const value = rule.integer ? Math.round(bounded) : Math.round(bounded * 10) / 10
    this.setData({ [`profile.${field}`]: value })
  },

  chooseGender(event: WechatMiniprogram.TouchEvent) {
    this.setData({ 'profile.gender': event.currentTarget.dataset.value as Gender, genderChosen: true })
  },

  chooseExercise(event: WechatMiniprogram.TouchEvent) {
    const tier = Number(event.currentTarget.dataset.tier) as 1 | 2 | 3 | 4
    const option = this.data.exerciseOptions.find(item => item.tier === tier)
    if (!option) return
    this.setData({
      'profile.exerciseTier': tier,
      'profile.weeklyExerciseHours': option.hours,
      'profile.weeklyExerciseTimes': option.times,
      exerciseChosen: true,
    })
  },

  chooseMeals(event: WechatMiniprogram.TouchEvent) {
    this.setData({ 'profile.mealsPerDay': Number(event.currentTarget.dataset.value) as 2 | 3, mealsChosen: true })
  },

  previous() {
    if (this.data.step === 0) return
    const step = this.data.step - 1
    this.setData({ step, title: STEP_TITLES[step] })
  },

  next() {
    if (!this.validateStep()) return
    if (this.data.step === this.data.totalSteps - 1) {
      void this.finish()
      return
    }
    const step = this.data.step + 1
    this.setData({ step, title: STEP_TITLES[step] })
  },

  validateStep(): boolean {
    const { step, profile } = this.data
    let tip = ''
    if (step === 0) {
      if (profile.age < 18 || profile.age > 100) tip = '请输入 18–100 岁的年龄'
      else if (profile.heightCm < 130 || profile.heightCm > 230) tip = '请输入 130–230cm 的身高'
      else if (profile.weightKg < 30 || profile.weightKg > 300) tip = '请输入 30–300kg 的体重'
      else if (!this.data.genderChosen) tip = '请选择性别'
    } else if (!this.data.exerciseChosen) tip = '请选择日常运动量'
    else if (!this.data.mealsChosen) tip = '请选择每天用餐次数'

    if (tip) wx.showToast({ title: tip, icon: 'none' })
    return !tip
  },

  async finish() {
    const profile: UserProfile = {
      ...this.data.profile,
      updatedAt: Date.now(),
    }
    this.setData({ saving: true })
    const saved = await callApi<UserProfile>('profile.save', { profile })
    this.setData({ saving: false })
    if (!saved) {
      wx.showToast({ title: '保存失败，请检查云函数', icon: 'none' })
      return
    }
    saveProfile(profile)
    markInitialized()
    wx.reLaunch({ url: '/pages/home/index' })
  },
})
