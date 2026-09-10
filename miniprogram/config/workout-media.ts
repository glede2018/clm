/**
 * 训练媒体统一配置。
 *
 * design-assets/workout-media 是训练媒体的本地上传源与备份。
 * 云存储保持相同目录结构，页面只通过本配置生成 FileID。
 * 例如：cloud://cloud1-xxx.workout-media-xxx/workout-media
 */
export const workoutMediaConfig = {
  mode: 'cloud' as 'remote' | 'cloud',
  cloudRoot: 'cloud://cloud1-d1gpmlqv6da1fe64b.636c-cloud1-d1gpmlqv6da1fe64b-1417851962/workout-media',
  remoteRoot: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main',
}

export function workoutMediaUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '')
  const root = workoutMediaConfig.mode === 'cloud' && workoutMediaConfig.cloudRoot
    ? workoutMediaConfig.cloudRoot
    : workoutMediaConfig.remoteRoot
  return `${root.replace(/\/$/, '')}/${cleanPath}`
}

const resolvedMediaCache = new Map<string, { url: string; expiresAt: number }>()

async function resolveMediaChunk(paths: string[]): Promise<Map<string, string>> {
  const result = await wx.cloud.callFunction({
    name: 'api',
    data: { action: 'media.urls', payload: { paths } },
  })
  const response = result.result as {
    ok?: boolean
    data?: { urls?: Array<{ path: string; url: string }> }
    message?: string
  }
  if (!response?.ok) throw new Error(response?.message || '训练媒体地址获取失败')
  return new Map((response.data?.urls || []).filter(item => item.url).map(item => [item.path, item.url]))
}

export async function resolveWorkoutMediaUrls(paths: string[]): Promise<string[]> {
  const cleanPaths = paths.map(path => path.replace(/^\/+/, ''))
  if (workoutMediaConfig.mode !== 'cloud' || !wx.cloud) return cleanPaths.map(workoutMediaUrl)

  const now = Date.now()
  const unresolved = [...new Set(cleanPaths.filter(path => {
    const cached = resolvedMediaCache.get(path)
    return !cached || cached.expiresAt <= now
  }))]
  try {
    for (let index = 0; index < unresolved.length; index += 20) {
      const urls = await resolveMediaChunk(unresolved.slice(index, index + 20))
      urls.forEach((url, path) => resolvedMediaCache.set(path, { url, expiresAt: now + 50 * 60 * 1000 }))
    }
  } catch (error) {
    console.warn('解析训练媒体云存储地址失败', error)
  }
  return cleanPaths.map(path => resolvedMediaCache.get(path)?.url || workoutMediaUrl(path))
}

export async function resolveWorkoutMediaUrl(path: string): Promise<string> {
  const [url] = await resolveWorkoutMediaUrls([path])
  return url
}
