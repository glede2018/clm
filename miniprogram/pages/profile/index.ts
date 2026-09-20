import { productShareHandlers } from '../../utils/share'
import { calculateDailyTarget, resolveExerciseTier } from '../../utils/nutrition'
import { getProfile, guardPageAccess, saveProfile } from '../../utils/storage'
import { callApi, callApiRequired } from '../../services/cloud'

let nicknameSaveTimer: number | undefined

Page({
  ...productShareHandlers,
  data: {
    profile: getProfile(),
    dailyTarget: calculateDailyTarget(getProfile()),
    nicknameDraft: getProfile().nickname,
    savingNickname: false,
    exerciseOptions: [
      { tier: 1, label: '2–3 小时', caption: '约 2 次' },
      { tier: 2, label: '4–5 小时', caption: '约 3 次' },
      { tier: 3, label: '6–7 小时', caption: '约 4 次' },
      { tier: 4, label: '8–10 小时', caption: '约 5 次' },
    ],
  },

  onShow() {
    if (!guardPageAccess()) return
    const profile = getProfile()
    this.setData({ profile, nicknameDraft: profile.nickname, dailyTarget: calculateDailyTarget(profile) })
  },

  setGender(event: WechatMiniprogram.TouchEvent) {
    const gender = event.currentTarget.dataset.gender as Gender
    this.updateProfile({ gender })
  },

  onNicknameInput(event: WechatMiniprogram.Input) {
    this.setData({ nicknameDraft: event.detail.value })
    if (nicknameSaveTimer !== undefined) clearTimeout(nicknameSaveTimer)
    nicknameSaveTimer = setTimeout(() => {
      nicknameSaveTimer = undefined
      void this.finishNicknameEdit()
    }, 500)
  },

  async finishNicknameEdit() {
    if (this.data.savingNickname) return
    if (nicknameSaveTimer !== undefined) {
      clearTimeout(nicknameSaveTimer)
      nicknameSaveTimer = undefined
    }
    const nickname = this.data.nicknameDraft.trim()
    if (!nickname) {
      wx.showToast({ title: '请选择或输入微信昵称', icon: 'none' })
      this.setData({ nicknameDraft: this.data.profile.nickname })
      return
    }
    if (nickname === this.data.profile.nickname) {
      this.setData({ nicknameDraft: this.data.profile.nickname })
      return
    }
    const profile: UserProfile = { ...this.data.profile, nickname, updatedAt: Date.now() }
    this.setData({ savingNickname: true })
    try {
      await callApiRequired<UserProfile>('profile.save', { profile })
      saveProfile(profile)
      this.setData({ profile, nicknameDraft: nickname })
      wx.showToast({ title: '用户名已更新', icon: 'success' })
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败'
      wx.showToast({ title: message, icon: 'none' })
      this.setData({ nicknameDraft: this.data.profile.nickname })
    } finally {
      this.setData({ savingNickname: false })
    }
  },

  onUnload() {
    if (nicknameSaveTimer !== undefined) clearTimeout(nicknameSaveTimer)
    nicknameSaveTimer = undefined
  },

  setMealCount(event: WechatMiniprogram.TouchEvent) {
    const mealsPerDay = Number(event.currentTarget.dataset.count) as 2 | 3
    this.updateProfile({ mealsPerDay })
  },

  setExerciseTier(event: WechatMiniprogram.TouchEvent) {
    const exerciseTier = Number(event.currentTarget.dataset.tier) as 1 | 2 | 3 | 4
    const defaults = {
      1: { weeklyExerciseHours: 2.5, weeklyExerciseTimes: 2 },
      2: { weeklyExerciseHours: 4.5, weeklyExerciseTimes: 3 },
      3: { weeklyExerciseHours: 6.5, weeklyExerciseTimes: 4 },
      4: { weeklyExerciseHours: 9, weeklyExerciseTimes: 5 },
    }[exerciseTier]
    this.updateProfile({ exerciseTier, ...defaults })
  },

  onFieldInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field as keyof UserProfile
    const numericFields = ['age', 'heightCm', 'weightKg', 'weeklyExerciseHours', 'weeklyExerciseTimes']
    const value = numericFields.includes(field) ? Number(event.detail.value) : event.detail.value
    this.updateProfile({ [field]: value } as Partial<UserProfile>)
  },

  updateProfile(patch: Partial<UserProfile>) {
    const profile = { ...this.data.profile, ...patch } as UserProfile
    if ('weeklyExerciseHours' in patch || 'weeklyExerciseTimes' in patch) {
      profile.exerciseTier = resolveExerciseTier(profile.weeklyExerciseHours, profile.weeklyExerciseTimes)
    }
    this.setData({ profile, dailyTarget: calculateDailyTarget(profile) })
  },

  async save() {
    const profile = { ...this.data.profile, updatedAt: Date.now() } as UserProfile
    if (profile.age < 18) {
      wx.showModal({ title: '暂不支持未成年人', content: '当前版本仅用于 18 岁及以上成年人，请在专业人士指导下制定未成年人营养方案。', showCancel: false })
      return
    }
    if (profile.heightCm < 130 || profile.weightKg < 35) {
      wx.showToast({ title: '请检查身高和体重', icon: 'none' })
      return
    }
    saveProfile(profile)
    await callApi('profile.save', { profile })
    wx.showToast({ title: '方案已保存', icon: 'success' })
  },
})
