const PROFILE_KEY = 'fat_tug_profile'
const ACCOUNT_KEY = 'fat_tug_auth'
const MEAL_RECORDS_KEY = 'fat_tug_meal_records'
const WEIGHT_RECORDS_KEY = 'fat_tug_weight_records'
const CELEBRATION_KEY = 'fat_tug_celebration'
const WORKOUT_EQUIPMENT_KEY = 'fat_tug_workout_equipment'
const CURRENT_WORKOUT_KEY = 'fat_tug_current_workout'
const WORKOUT_LOGS_KEY = 'fat_tug_workout_logs'
const MEAL_GUIDE_KEY = 'fat_tug_meal_intro_v3_step'
const PLAN_RETURN_KEY = 'fat_tug_login_return'
let onboardingNavigationPending = false

function randomNickname(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lowercase = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const all = uppercase + lowercase + digits
  const chars = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ]
  while (chars.length < 8) chars.push(all[Math.floor(Math.random() * all.length)])
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    const value = chars[index]
    chars[index] = chars[target]
    chars[target] = value
  }
  return chars.join('')
}

export function createProfileDraft(account?: Partial<AccountState>): UserProfile {
  return {
    nickname: account?.nickname || getAccountState().nickname,
    avatarUrl: account?.avatarUrl,
    gender: 'female',
    age: 30,
    heightCm: 165,
    weightKg: 60,
    weeklyExerciseHours: 2.5,
    weeklyExerciseTimes: 2,
    exerciseTier: 1,
    mealsPerDay: 3,
    updatedAt: Date.now(),
  }
}

export function getProfile(): UserProfile {
  const account = getAccountState()
  const profile = wx.getStorageSync<UserProfile>(PROFILE_KEY)
  if (!profile) return createProfileDraft(account)
  if (!profile.nickname || profile.nickname === '微信用户') {
    const migrated = { ...profile, nickname: account.nickname, updatedAt: Date.now() }
    wx.setStorageSync(PROFILE_KEY, migrated)
    return migrated
  }
  return profile
}
export function saveProfile(profile: UserProfile): void {
  wx.setStorageSync(PROFILE_KEY, profile)
  const account = getAccountState()
  if (profile.nickname && profile.nickname !== account.nickname) {
    saveAccountState({ ...account, nickname: profile.nickname })
  }
}

export function getAccountState(): AccountState {
  const stored = wx.getStorageSync<AccountState>(ACCOUNT_KEY)
  if (stored?.nickname && stored.nickname !== '微信用户') return stored
  const account: AccountState = {
    nickname: randomNickname(),
    avatarUrl: stored?.avatarUrl,
    initialized: stored?.initialized === true,
  }
  wx.setStorageSync(ACCOUNT_KEY, account)
  return account
}

export function saveAccountState(account: AccountState): void {
  wx.setStorageSync(ACCOUNT_KEY, account)
}

export function isInitialized(): boolean {
  return Boolean(getAccountState()?.initialized && wx.getStorageSync<UserProfile>(PROFILE_KEY))
}

export function markInitialized(): void {
  const account = getAccountState()
  const profile = getProfile()
  saveAccountState({
    nickname: account?.nickname || profile.nickname,
    avatarUrl: account?.avatarUrl || profile.avatarUrl,
    initialized: true,
  })
}

export function getPlanReturnPath(): string {
  const path = wx.getStorageSync<string>(PLAN_RETURN_KEY)
  return typeof path === 'string' && path.startsWith('/pages/') ? path : ''
}

export function savePlanReturnPath(path: string): void {
  if (path.startsWith('/pages/')) wx.setStorageSync(PLAN_RETURN_KEY, path)
}

export function clearPlanReturnPath(): void {
  wx.removeStorageSync(PLAN_RETURN_KEY)
}

export function clearUserData(): void {
  wx.removeStorageSync(ACCOUNT_KEY)
  wx.removeStorageSync(PROFILE_KEY)
  wx.removeStorageSync(MEAL_RECORDS_KEY)
  wx.removeStorageSync(WEIGHT_RECORDS_KEY)
  wx.removeStorageSync(CELEBRATION_KEY)
  wx.removeStorageSync(WORKOUT_EQUIPMENT_KEY)
  wx.removeStorageSync(CURRENT_WORKOUT_KEY)
  wx.removeStorageSync(WORKOUT_LOGS_KEY)
  wx.removeStorageSync(MEAL_GUIDE_KEY)
  wx.removeStorageSync(PLAN_RETURN_KEY)
}

export function getMealGuideStep(): number {
  const stored = wx.getStorageSync<number>(MEAL_GUIDE_KEY)
  return [0, 1, 2, 3, 4, 5, 6].includes(stored) ? stored : 1
}

export function saveMealGuideStep(step: number): void {
  wx.setStorageSync(MEAL_GUIDE_KEY, Math.max(0, Math.min(6, step)))
}

export function ensureUserAccess(
  returnPath: string,
  _content = '建立个人方案后，才能使用这项功能。',
  _leaveOnCancel = false,
): boolean {
  if (isInitialized()) return true
  const app = getApp<IAppOption>()
  if (app.globalData.cloudReady && !app.globalData.accountReady) {
    wx.showToast({ title: '正在加载个人数据', icon: 'none' })
    return false
  }
  savePlanReturnPath(returnPath)
  if (onboardingNavigationPending) return false
  onboardingNavigationPending = true
  wx.navigateTo({
    url: '/pages/onboarding/index',
    complete: () => { onboardingNavigationPending = false },
    fail: () => wx.reLaunch({ url: '/pages/onboarding/index' }),
  })
  return false
}

export function guardPageAccess(): boolean {
  if (isInitialized()) return true
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as unknown as { route?: string; options?: Record<string, string> }
  const query = Object.entries(current?.options || {})
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  const returnPath = current?.route ? `/${current.route}${query ? `?${query}` : ''}` : '/pages/home/index'
  return ensureUserAccess(returnPath, '这个页面需要先建立个人方案。', true)
}

export function getMealRecords(): MealPlan[] {
  return wx.getStorageSync<MealPlan[]>(MEAL_RECORDS_KEY) || []
}

export function saveMealRecord(plan: MealPlan): void {
  const records = getMealRecords()
  const next = records.filter(item => !(item.date === plan.date && item.mealType === plan.mealType))
  next.push(plan)
  wx.setStorageSync(MEAL_RECORDS_KEY, next)
  wx.setStorageSync(CELEBRATION_KEY, plan.mealType)
}

export function getMealsByDate(date: string): MealPlan[] {
  return getMealRecords().filter(item => item.date === date)
}

export function replaceMealRecords(records: MealPlan[]): void {
  wx.setStorageSync(MEAL_RECORDS_KEY, records)
}

export function consumeCelebration(): MealType | '' {
  const mealType = wx.getStorageSync<MealType>(CELEBRATION_KEY) || ''
  if (mealType) wx.removeStorageSync(CELEBRATION_KEY)
  return mealType
}

export function getWeightRecords(): WeightRecord[] {
  return wx.getStorageSync<WeightRecord[]>(WEIGHT_RECORDS_KEY) || []
}

export function saveWeightRecord(record: WeightRecord): void {
  const records = getWeightRecords().filter(item => item.date !== record.date)
  records.push(record)
  records.sort((a, b) => a.date.localeCompare(b.date))
  wx.setStorageSync(WEIGHT_RECORDS_KEY, records)
}

export function replaceWeightRecords(records: WeightRecord[]): void {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  wx.setStorageSync(WEIGHT_RECORDS_KEY, sorted)
}

export function getWorkoutEquipment(): WorkoutEquipment[] {
  return wx.getStorageSync<WorkoutEquipment[]>(WORKOUT_EQUIPMENT_KEY) || ['自重']
}

export function saveWorkoutEquipment(equipment: WorkoutEquipment[]): void {
  wx.setStorageSync(WORKOUT_EQUIPMENT_KEY, equipment)
}

export function getCurrentWorkout(): WorkoutPlan | null {
  return wx.getStorageSync<WorkoutPlan>(CURRENT_WORKOUT_KEY) || null
}

export function saveCurrentWorkout(plan: WorkoutPlan): void {
  wx.setStorageSync(CURRENT_WORKOUT_KEY, plan)
}

export function clearCurrentWorkout(): void {
  wx.removeStorageSync(CURRENT_WORKOUT_KEY)
}

export function getWorkoutLogs(): WorkoutLog[] {
  return wx.getStorageSync<WorkoutLog[]>(WORKOUT_LOGS_KEY) || []
}

export function saveWorkoutLog(log: WorkoutLog): void {
  const logs = getWorkoutLogs()
  logs.push(log)
  wx.setStorageSync(WORKOUT_LOGS_KEY, logs)
}

export function replaceWorkoutLogs(logs: WorkoutLog[]): void {
  const sorted = [...logs].sort((a, b) => a.completedAt - b.completedAt)
  wx.setStorageSync(WORKOUT_LOGS_KEY, sorted)
}
