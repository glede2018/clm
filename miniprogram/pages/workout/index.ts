import { resolveWorkoutMediaUrls, workoutMediaUrl } from '../../config/workout-media'
import { callApi } from '../../services/cloud'
import { formatDate } from '../../utils/date'
import { clearCurrentWorkout, ensureUserAccess, getCurrentWorkout, saveCurrentWorkout, saveWorkoutLog } from '../../utils/storage'

interface DisplayWorkoutItem extends WorkoutPlanItem {
  thumbnailUrl: string
  equipmentText: string
  muscleText: string
  matchLabel: string
}

interface WorkoutGroup {
  key: string
  title: string
  caption: string
  items: DisplayWorkoutItem[]
}

let workoutTimer: ReturnType<typeof setInterval> | null = null
let mediaRequestVersion = 0

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function resolveMatch(item: WorkoutPlanItem, equipment: WorkoutEquipment[]): 'exact' | 'combined' | 'single' {
  if (item.equipmentMatch) return item.equipmentMatch
  const exact = item.equipment.length === equipment.length
    && equipment.every(selected => item.equipment.includes(selected))
  if (exact) return 'exact'
  const matchedEquipmentCount = item.equipment.filter(required => equipment.includes(required)).length
  return matchedEquipmentCount > 1 ? 'combined' : 'single'
}

function buildGroups(items: DisplayWorkoutItem[], selectedEquipmentCount: number): WorkoutGroup[] {
  if (selectedEquipmentCount <= 1) {
    return [{ key: 'matched', title: '匹配动作', caption: `共 ${items.length} 个`, items }]
  }
  const priority = items.filter(item => item.equipmentMatch !== 'single')
  const single = items.filter(item => item.equipmentMatch === 'single')
  return [
    priority.length ? { key: 'priority', title: '优先匹配', caption: '多个所选器械', items: priority } : null,
    single.length ? { key: 'single', title: '单器械匹配', caption: `共 ${single.length} 个`, items: single } : null,
  ].filter((group): group is WorkoutGroup => group !== null)
}

Page({
  onReady() { wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }) },
  onShareAppMessage() {
    return { title: '食克有数｜食材配餐、训练计划，让每一天更有数', path: '/pages/home/index', imageUrl: '/assets/share-logo.png' }
  },
  onShareTimeline() {
    return { title: '食克有数｜选食材、算克重、记饮食和训练', query: 'from=timeline', imageUrl: '/assets/share-logo.png' }
  },
  data: {
    plan: null as WorkoutPlan | null,
    groups: [] as WorkoutGroup[],
    completedCount: 0,
    totalCount: 0,
    progress: 0,
    planMuscleText: '',
    elapsedSeconds: 0,
    elapsedText: '00:00',
    remainingText: '00:00',
    durationReady: false,
    canFinish: false,
    finishLabel: '先完成一个动作',
  },

  onShow() {
    const plan = getCurrentWorkout()
    if (!plan) {
      wx.showToast({ title: '训练方案已失效，请重新生成', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
      return
    }
    this.refresh(plan)
    this.startTimer()
  },

  onHide() { this.stopTimer() },
  onUnload() {
    this.stopTimer()
    mediaRequestVersion += 1
  },

  refresh(plan: WorkoutPlan) {
    const normalizedPlan: WorkoutPlan = {
      ...plan,
      items: plan.items.map(item => ({ ...item, equipmentMatch: resolveMatch(item, plan.equipment) })),
    }
    const completedCount = normalizedPlan.items.filter(item => item.completed).length
    const items: DisplayWorkoutItem[] = normalizedPlan.items.map(item => ({
      ...item,
      thumbnailUrl: workoutMediaUrl(item.thumbnailPath),
      equipmentText: item.equipment.join(' + '),
      muscleText: item.muscles.join(' · '),
      matchLabel: item.equipmentMatch === 'exact'
        ? '全部器械匹配'
        : item.equipmentMatch === 'combined' ? '多项器械匹配' : '单项器械匹配',
    }))
    const groups = buildGroups(items, normalizedPlan.equipment.length)
    this.setData({
      plan: normalizedPlan,
      groups,
      completedCount,
      totalCount: items.length,
      planMuscleText: normalizedPlan.muscles.join('、'),
    })
    saveCurrentWorkout(normalizedPlan)
    this.updateTimer()
    const requestVersion = ++mediaRequestVersion
    void resolveWorkoutMediaUrls(items.map(item => item.thumbnailPath)).then(urls => {
      if (requestVersion !== mediaRequestVersion) return
      const urlById = new Map(items.map((item, index) => [item.id, urls[index]]))
      this.setData({
        groups: groups.map(group => ({
          ...group,
          items: group.items.map(item => ({ ...item, thumbnailUrl: urlById.get(item.id) || item.thumbnailUrl })),
        })),
      })
    })
  },

  startTimer() {
    this.stopTimer()
    this.updateTimer()
    workoutTimer = setInterval(() => this.updateTimer(), 1000)
  },

  stopTimer() {
    if (workoutTimer) clearInterval(workoutTimer)
    workoutTimer = null
  },

  updateTimer() {
    const plan = this.data.plan
    if (!plan) return
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - plan.createdAt) / 1000))
    const targetSeconds = plan.durationMinutes * 60
    const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds)
    const durationReady = elapsedSeconds >= targetSeconds
    const canFinish = this.data.completedCount > 0
    const finishLabel = this.data.completedCount === 0
      ? '先完成一个动作'
      : '完成本次训练'
    this.setData({
      elapsedSeconds,
      elapsedText: formatDuration(elapsedSeconds),
      remainingText: formatDuration(remainingSeconds),
      durationReady,
      canFinish,
      finishLabel,
      progress: Math.min(100, Math.round(elapsedSeconds / Math.max(1, targetSeconds) * 100)),
    })
  },

  openExercise(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/exercise/index?id=${event.currentTarget.dataset.id}` })
  },

  toggleComplete(event: WechatMiniprogram.TouchEvent) {
    if (!ensureUserAccess('/pages/workout/index', '建立个人方案后，可记录动作完成状态和保存训练记录。')) return
    if (!this.data.plan) return
    const id = event.currentTarget.dataset.id as string
    const plan: WorkoutPlan = {
      ...this.data.plan,
      items: this.data.plan.items.map(item => item.id === id ? { ...item, completed: !item.completed } : item),
    }
    saveCurrentWorkout(plan)
    this.refresh(plan)
    wx.showToast({ title: plan.items.find(item => item.id === id)?.completed ? '动作已打卡' : '已取消打卡', icon: 'none' })
  },

  async finishWorkout() {
    if (!ensureUserAccess('/pages/workout/index', '建立个人方案后，可完成打卡并保存本次训练。')) return
    const plan = this.data.plan
    if (!plan) return
    this.updateTimer()
    if (!this.data.completedCount) {
      wx.showToast({ title: '请至少完成一个动作', icon: 'none' })
      return
    }
    const completedItems = plan.items.filter(item => item.completed)
    const log: WorkoutLog = {
      id: plan.id,
      date: formatDate(),
      completedAt: Date.now(),
      durationMinutes: Math.max(1, Math.round(this.data.elapsedSeconds / 60)),
      muscles: plan.muscles,
      exerciseNames: completedItems.map(item => item.name),
    }
    this.stopTimer()
    saveWorkoutLog(log)
    await callApi('workout.save', { log })
    clearCurrentWorkout()
    wx.showToast({ title: '训练完成！', icon: 'success' })
    setTimeout(() => wx.reLaunch({ url: '/pages/training/index' }), 650)
  },
})
