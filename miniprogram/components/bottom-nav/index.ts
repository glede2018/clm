import { callApi } from '../../services/cloud'
import { formatDate } from '../../utils/date'
import { getProfile, getWeightRecords, saveProfile, saveWeightRecord } from '../../utils/storage'

Component({
  properties: {
    current: { type: String, value: '' },
  },

  data: {
    items: [
      { key: 'home', label: '吃饭', icon: '⌂', url: '/pages/home/index' },
      { key: 'training', label: '训练', icon: '◇', url: '/pages/training/index' },
      { key: 'weight', label: '体重', icon: '+', url: '' },
      { key: 'report', label: '报告', icon: '▥', url: '/pages/report/index' },
      { key: 'partners', label: '伙伴', icon: '⇄', url: '/pages/coach/index' },
      { key: 'profile', label: '我的', icon: '◎', url: '/pages/profile/index' },
    ],
    weightInput: '',
    weightModalVisible: false,
    weightSaving: false,
  },

  methods: {
    navigate(event: WechatMiniprogram.TouchEvent) {
      const { key, url } = event.currentTarget.dataset as { key: string; url: string }
      if (key === 'weight') {
        this.openWeightModal()
        return
      }
      if (!url || key === this.data.current) return
      wx.reLaunch({ url })
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

    adjustWeight(event: WechatMiniprogram.TouchEvent) {
      if (this.data.weightSaving) return
      const delta = Number(event.currentTarget.dataset.delta)
      const fallbackWeight = getProfile().weightKg
      const currentWeight = Number(this.data.weightInput)
      const nextWeight = Math.max(30, Math.min(300, (Number.isFinite(currentWeight) ? currentWeight : fallbackWeight) + delta))
      this.setData({ weightInput: (Math.round(nextWeight * 10) / 10).toFixed(1) })
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
      } catch (_error) {
        // 本地记录已经保存，云端同步可在后续操作中重试。
      } finally {
        this.setData({ weightInput: '', weightModalVisible: false, weightSaving: false })
      }

      this.triggerEvent('weightsaved', { weightKg, profileUpdated: shouldUpdateProfile })
      wx.showToast({ title: shouldUpdateProfile ? '方案体重已更新' : '体重已记录', icon: 'success' })
    },
  },
})
