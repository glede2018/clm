const PROFILE_KEY = 'fat_tug_profile'
const AUTH_KEY = 'fat_tug_auth'
const MEAL_RECORDS_KEY = 'fat_tug_meal_records'
const WEIGHT_RECORDS_KEY = 'fat_tug_weight_records'
const CELEBRATION_KEY = 'fat_tug_celebration'

export function createProfileDraft(session?: Partial<AuthSession>): UserProfile {
  return {
    nickname: session?.nickname || '微信用户',
    avatarUrl: session?.avatarUrl,
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
  return wx.getStorageSync<UserProfile>(PROFILE_KEY) || createProfileDraft(getAuthSession() || undefined)
}
export function saveProfile(profile: UserProfile): void { wx.setStorageSync(PROFILE_KEY, profile) }

export function getAuthSession(): AuthSession | null {
  return wx.getStorageSync<AuthSession>(AUTH_KEY) || null
}

export function saveAuthSession(session: AuthSession): void {
  wx.setStorageSync(AUTH_KEY, session)
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthSession()?.loggedIn)
}

export function isInitialized(): boolean {
  return Boolean(getAuthSession()?.initialized && wx.getStorageSync<UserProfile>(PROFILE_KEY))
}

export function markInitialized(): void {
  const session = getAuthSession()
  if (session) saveAuthSession({ ...session, initialized: true })
}

export function clearUserData(): void {
  wx.removeStorageSync(AUTH_KEY)
  wx.removeStorageSync(PROFILE_KEY)
  wx.removeStorageSync(MEAL_RECORDS_KEY)
  wx.removeStorageSync(WEIGHT_RECORDS_KEY)
  wx.removeStorageSync(CELEBRATION_KEY)
}

export function guardPageAccess(): boolean {
  if (!isAuthenticated()) {
    wx.reLaunch({ url: '/pages/login/index' })
    return false
  }
  if (!isInitialized()) {
    wx.reLaunch({ url: '/pages/onboarding/index' })
    return false
  }
  return true
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
