import { productShareHandlers } from '../../utils/share'
import { callApiRequired } from '../../services/cloud'
import { getAuthSession, isInitialized, saveAuthSession, saveProfile } from '../../utils/storage'

interface LoginResult {
  initialized: boolean
  nickname: string
  profile?: UserProfile | null
}

Page({
  ...productShareHandlers,
  data: {
    loading: false,
  },

  onShow() {
    const session = getAuthSession()
    if (session?.loggedIn && isInitialized()) wx.reLaunch({ url: '/pages/home/index' })
  },

  async login() {
    if (!getApp<IAppOption>().globalData.cloudReady) {
      wx.showToast({ title: '云开发尚未就绪', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const data = await callApiRequired<LoginResult>('auth.login')

      saveAuthSession({
        loggedIn: true,
        nickname: data.profile?.nickname || data.nickname,
        avatarUrl: data.profile?.avatarUrl,
        initialized: data.initialized,
      })
      if (data.profile) saveProfile(data.profile)
      if (data.initialized && data.profile) wx.reLaunch({ url: '/pages/home/index' })
      else wx.reLaunch({ url: '/pages/onboarding/index' })
    } catch (error) {
      console.warn('微信登录失败', error)
      const message = error instanceof Error ? error.message : '未知错误'
      wx.showModal({
        title: '微信登录失败',
        content: message,
        showCancel: false,
        confirmText: '知道了',
      })
    } finally {
      this.setData({ loading: false })
    }
  },
})
