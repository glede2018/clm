import { replaceMealRecords, replaceWeightRecords, replaceWorkoutLogs, saveAccountState, saveProfile } from './utils/storage'

interface AccountBootstrap {
  initialized: boolean
  nickname: string
  profile?: UserProfile | null
}

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

function refreshCurrentPage(): void {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as unknown as { onShow?: () => void; refresh?: () => void }
  if (typeof current?.onShow === 'function') current.onShow()
  else if (typeof current?.refresh === 'function') current.refresh()
}

async function bootstrapAccount(app: WechatMiniprogram.App.Instance<IAppOption>): Promise<void> {
  try {
    const account = await fetchCloudData<AccountBootstrap>('account.bootstrap')
    if (!account) return

    saveAccountState({
      nickname: account.profile?.nickname || account.nickname,
      avatarUrl: account.profile?.avatarUrl,
      initialized: account.initialized,
    })
    if (account.profile?.initialized) saveProfile(account.profile)

    if (account.initialized) {
      const [meals, weights, workouts] = await Promise.all([
        fetchCloudData<MealPlan[]>('meal.list'),
        fetchCloudData<WeightRecord[]>('weight.list'),
        fetchCloudData<WorkoutLog[]>('workout.list'),
      ])
      if (meals) replaceMealRecords(meals)
      if (weights) replaceWeightRecords(weights)
      if (workouts) replaceWorkoutLogs(workouts)
    }
  } finally {
    app.globalData.accountReady = true
    refreshCurrentPage()
  }
}

App<IAppOption>({
  globalData: {
    cloudReady: false,
    accountReady: false,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.warn('当前基础库不支持云开发，无法同步个人数据。')
      this.globalData.accountReady = true
      return
    }

    try {
      wx.cloud.init({
        env: 'cloud1-d1gpmlqv6da1fe64b', 
        traceUser: true 
      })
      this.globalData.cloudReady = true
      void bootstrapAccount(this)
    } catch (error) {
      this.globalData.accountReady = true
      console.warn('云开发初始化失败，个人数据暂时无法同步。', error)
    }
  },
})
