import { productShareHandlers } from '../../utils/share'
import { callApi, callApiRequired } from '../../services/cloud'
import { guardPageAccess } from '../../utils/storage'

interface PartnerSnapshot {
  openId: string
  nickname: string
  initial: string
  todayMeals: number
  targetMeals: number
  latestWeight?: number
}

Page({
  ...productShareHandlers,
  data: {
    inviteCode: '',
    bindCode: '',
    partners: [] as PartnerSnapshot[],
    inviteLoading: false,
    bindLoading: false,
    partnersLoading: false,
    inviteVisible: false,
  },

  onShow() {
    if (!guardPageAccess()) return
    void this.loadPartners()
  },

  onCodeInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ bindCode: event.detail.value.toUpperCase().replace(/\s/g, '') })
  },

  async createInvite() {
    this.setData({ inviteLoading: true })
    try {
      const data = await callApiRequired<{ code: string }>('binding.createInvite')
      this.setData({ inviteCode: data.code, inviteVisible: true })
    } catch (error) {
      this.showCloudError('生成邀请码失败', error)
    } finally {
      this.setData({ inviteLoading: false })
    }
  },

  closeInvite() {
    this.setData({ inviteVisible: false })
  },

  noop() {},

  copyInvite() {
    if (!this.data.inviteCode) return
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => this.setData({ inviteVisible: false }),
    })
  },

  async bindPartner() {
    if (this.data.bindCode.length !== 6) {
      wx.showToast({ title: '请输入 6 位邀请码', icon: 'none' })
      return
    }
    this.setData({ bindLoading: true })
    try {
      await callApiRequired<{ partnerId: string }>('binding.bind', { code: this.data.bindCode })
      this.setData({ bindCode: '' })
      await this.loadPartners()
      wx.showToast({ title: '已成功绑定', icon: 'success' })
    } catch (error) {
      this.showCloudError('绑定失败', error)
    } finally {
      this.setData({ bindLoading: false })
    }
  },

  showCloudError(title: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '未知错误')
    wx.showModal({ title, content: message, showCancel: false, confirmText: '知道了' })
  },

  async unbindPartner(event: WechatMiniprogram.TouchEvent) {
    const partnerId = event.currentTarget.dataset.id as string
    const partner = this.data.partners.find(item => item.openId === partnerId)
    const confirmed = await new Promise<boolean>(resolve => {
      wx.showModal({
        title: '解除绑定',
        content: `确认与“${partner?.nickname || '该用户'}”解除绑定吗？解除后双方都不能继续查看对方数据。`,
        success: result => resolve(result.confirm),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return
    const result = await callApi<{ unbound: boolean }>('binding.unbind', { partnerId })
    if (!result?.unbound) {
      wx.showToast({ title: '解除失败，请稍后再试', icon: 'none' })
      return
    }
    await this.loadPartners()
    wx.showToast({ title: '已解除绑定', icon: 'success' })
  },

  async loadPartners() {
    this.setData({ partnersLoading: true })
    const partners = await callApi<PartnerSnapshot[]>('binding.partners')
    this.setData({ partnersLoading: false, partners: partners || [] })
  },

  openPartner(event: WechatMiniprogram.TouchEvent) {
    const partnerId = event.currentTarget.dataset.id as string
    wx.navigateTo({ url: `/pages/student/index?id=${encodeURIComponent(partnerId)}` })
  },
})
