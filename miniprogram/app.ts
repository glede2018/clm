import { getAuthSession, replaceMealRecords, replaceWeightRecords, saveAuthSession, saveProfile } from './utils/storage'

async function fetchCloudData<T>(action: string): Promise<T | null> {
  try {
    const result = await wx.cloud.callFunction({ name: 'api', data: { action, payload: {} } })
    const response = result.result as { ok?: boolean; data?: T }
    return response?.ok ? response.data || null : null
  } catch (error) {
    console.warn(`启动同步 ${action} 失败`, error)
    return null
  }
}

App<IAppOption>({
  globalData: {
    cloudReady: false,
    authReady: false,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.warn('当前基础库不支持云开发，无法使用微信登录。')
      return
    }

    try {
      wx.cloud.init({
        env: 'cloud1-d1gpmlqv6da1fe64b', 
        traceUser: true 
      })
      this.globalData.cloudReady = true
      const session = getAuthSession()
      if (session?.loggedIn) {
        void Promise.all([
          fetchCloudData<UserProfile>('profile.get'),
          fetchCloudData<MealPlan[]>('meal.list'),
          fetchCloudData<WeightRecord[]>('weight.list'),
        ]).then(([profile, meals, weights]) => {
          if (profile?.initialized) {
            saveProfile(profile)
            saveAuthSession({ ...session, nickname: profile.nickname, avatarUrl: profile.avatarUrl, initialized: true })
          }
          if (meals) replaceMealRecords(meals)
          if (weights) replaceWeightRecords(weights)
          this.globalData.authReady = true
        })
      } else {
        this.globalData.authReady = true
      }
    } catch (error) {
      console.warn('云开发初始化失败，微信登录暂不可用。', error)
    }
  },
})
