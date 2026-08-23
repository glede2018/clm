interface ApiResponse<T> {
  ok: boolean
  data?: T
  message?: string
}

function cloudErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error) {
    const detail = error as { errMsg?: string; message?: string }
    return detail.errMsg || detail.message || '云端请求失败'
  }
  return String(error || '云端请求失败')
}

export async function callApiRequired<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const app = getApp<IAppOption>()
  if (!app.globalData.cloudReady) throw new Error('云开发尚未初始化')

  try {
    const result = await wx.cloud.callFunction({ name: 'api', data: { action, payload } })
    const response = result.result as ApiResponse<T>
    if (!response?.ok) throw new Error(response?.message || '云函数返回失败')
    if (response.data === undefined || response.data === null) throw new Error('云函数未返回数据')
    return response.data
  } catch (error) {
    throw new Error(cloudErrorMessage(error))
  }
}

export async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T | null> {
  const app = getApp<IAppOption>()
  if (!app.globalData.cloudReady) return null

  try {
    const result = await wx.cloud.callFunction({
      name: 'api',
      data: { action, payload },
    })
    const response = result.result as ApiResponse<T>
    if (!response?.ok) throw new Error(response?.message || '云端请求失败')
    return response.data ?? null
  } catch (error) {
    console.warn(`云函数 ${action} 调用失败，保留本地数据：${cloudErrorMessage(error)}`, error)
    return null
  }
}
