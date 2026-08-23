type Gender = 'male' | 'female'
type MealType = 'breakfast' | 'lunch' | 'dinner'
type FoodCategory = 'staple' | 'protein' | 'vegetable' | 'fat' | 'fruit'

interface MacroTarget {
  carbs: number
  protein: number
  fat: number
  calories: number
}

interface UserProfile {
  nickname: string
  avatarUrl?: string
  gender: Gender
  age: number
  heightCm: number
  weightKg: number
  weeklyExerciseHours: number
  weeklyExerciseTimes: number
  exerciseTier: 1 | 2 | 3 | 4
  mealsPerDay: 2 | 3
  initialized?: boolean
  updatedAt: number
}

interface AuthSession {
  loggedIn: boolean
  nickname: string
  avatarUrl?: string
  initialized: boolean
}

interface FoodItem {
  id: string
  name: string
  category: FoodCategory
  carbs: number
  protein: number
  fat: number
  calories: number
  minGrams: number
  maxGrams: number
  preferredGrams: number
}

interface FoodPortion extends FoodItem {
  grams: number
}

interface DisplayPortion {
  id: string
  name: string
  detail: string
  grams: number
}

interface MealPlan {
  date: string
  mealType: MealType
  target: MacroTarget
  actual: MacroTarget
  portions: FoodPortion[]
  accuracy: number
  completedAt?: number
}

interface WeightRecord {
  date: string
  weightKg: number
  createdAt: number
}

interface IAppOption {
  globalData: {
    cloudReady: boolean
    authReady: boolean
  }
}
