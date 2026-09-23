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

interface AccountState {
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

type WorkoutEquipment = '自重' | '哑铃' | '杠铃' | '壶铃' | '弹力带' | '配重片' | '引体向上杆' | '长凳'
type WorkoutMuscle = '肩部' | '胸部' | '肱二头肌' | '前臂' | '腹部' | '腹斜肌' | '斜方肌' | '肱三头肌' | '背部' | '臀部' | '大腿前侧' | '大腿后侧' | '小腿'
type WorkoutLevel = '入门' | '基础' | '进阶'

interface ExerciseItem {
  id: string
  name: string
  muscles: WorkoutMuscle[]
  equipment: WorkoutEquipment[]
  level: WorkoutLevel
  instructions: string[]
  thumbnailPath: string
  gifPath: string
  attribution: string
}

interface WorkoutPlanItem extends ExerciseItem {
  sets: number
  reps: number
  restSeconds: number
  completed: boolean
  equipmentMatch: 'exact' | 'combined' | 'single'
}

interface WorkoutPlan {
  id: string
  createdAt: number
  durationMinutes: number
  muscles: WorkoutMuscle[]
  equipment: WorkoutEquipment[]
  items: WorkoutPlanItem[]
}

interface WorkoutLog {
  id: string
  date: string
  completedAt: number
  durationMinutes: number
  muscles: WorkoutMuscle[]
  exerciseNames: string[]
}

interface IAppOption {
  globalData: {
    cloudReady: boolean
    accountReady: boolean
  }
}
