import { getFood } from '../data/foods'

const COEFFICIENTS = {
  1: { male: { carbs: 2.2, fat: 0.8 }, female: { carbs: 2.0, fat: 1.0 }, protein: 1.4 },
  2: { male: { carbs: 2.5, fat: 0.9 }, female: { carbs: 2.2, fat: 1.1 }, protein: 1.6 },
  3: { male: { carbs: 3.0, fat: 1.0 }, female: { carbs: 2.5, fat: 1.1 }, protein: 1.7 },
  4: { male: { carbs: 3.5, fat: 1.0 }, female: { carbs: 3.0, fat: 1.2 }, protein: 1.8 },
} as const

const MEAL_SHARE: Record<2 | 3, Record<MealType, number>> = {
  2: { breakfast: 0, lunch: 0.55, dinner: 0.45 },
  3: { breakfast: 0.25, lunch: 0.4, dinner: 0.35 },
}

export function resolveExerciseTier(hours: number, times: number): 1 | 2 | 3 | 4 {
  const hourTier = hours <= 3 ? 1 : hours <= 5 ? 2 : hours <= 7 ? 3 : 4
  const timeTier = times <= 2 ? 1 : times === 3 ? 2 : times === 4 ? 3 : 4
  return Math.min(hourTier, timeTier) as 1 | 2 | 3 | 4
}

function withCalories(carbs: number, protein: number, fat: number): MacroTarget {
  const roundedCarbs = Math.round(carbs * 10) / 10
  const roundedProtein = Math.round(protein * 10) / 10
  const roundedFat = Math.round(fat * 10) / 10
  return {
    carbs: roundedCarbs,
    protein: roundedProtein,
    fat: roundedFat,
    calories: Math.round(roundedCarbs * 4 + roundedProtein * 4 + roundedFat * 9),
  }
}

export function calculateDailyTarget(profile: UserProfile): MacroTarget {
  const tier = COEFFICIENTS[profile.exerciseTier]
  const genderRule = tier[profile.gender]
  return withCalories(
    profile.weightKg * genderRule.carbs,
    profile.weightKg * tier.protein,
    profile.weightKg * genderRule.fat,
  )
}

export function calculateMealTarget(profile: UserProfile, mealType: MealType): MacroTarget {
  const daily = calculateDailyTarget(profile)
  const share = MEAL_SHARE[profile.mealsPerDay][mealType]
  return withCalories(daily.carbs * share, daily.protein * share, daily.fat * share)
}

export function calculatePortionMacros(portions: FoodPortion[]): MacroTarget {
  const macro = portions.reduce((result, portion) => {
    const factor = portion.grams / 100
    result.carbs += portion.carbs * factor
    result.protein += portion.protein * factor
    result.fat += portion.fat * factor
    return result
  }, { carbs: 0, protein: 0, fat: 0 })
  return withCalories(macro.carbs, macro.protein, macro.fat)
}

function isVegetableCategory(category: string): boolean {
  return category === 'vegetable' || category === 'rawVegetable'
}

export function portionsForDisplay(portions: FoodPortion[]): DisplayPortion[] {
  const vegetables = portions.filter(portion => isVegetableCategory(portion.category))
  let vegetablesAdded = false

  return portions.reduce<DisplayPortion[]>((result, portion) => {
    if (!isVegetableCategory(portion.category)) {
      result.push({ id: portion.id, name: portion.name, detail: '', grams: portion.grams })
      return result
    }
    if (!vegetablesAdded) {
      result.push({
        id: 'vegetables-total',
        name: vegetables.length > 1 ? '蔬菜合计' : portion.name,
        detail: vegetables.length > 1 ? `${vegetables.map(item => item.name).join('、')}自由搭配` : '',
        grams: vegetables.reduce((sum, item) => sum + item.grams, 0),
      })
      vegetablesAdded = true
    }
    return result
  }, [])
}

function scorePortions(portions: FoodPortion[], target: MacroTarget): number {
  const actual = calculatePortionMacros(portions)
  const macroError = (
    Math.pow((actual.carbs - target.carbs) / Math.max(target.carbs, 15), 2) +
    Math.pow((actual.protein - target.protein) / Math.max(target.protein, 15), 2) +
    Math.pow((actual.fat - target.fat) / Math.max(target.fat, 8), 2) * 1.15
  )

  const producePenalty = portions.reduce((penalty, portion) => {
    if (portion.category !== 'vegetable' && portion.category !== 'fruit') return penalty
    return penalty + Math.pow((portion.grams - portion.preferredGrams) / Math.max(portion.preferredGrams, 50), 2) * 0.12
  }, 0)
  return macroError + producePenalty
}

export function createMealPlan(profile: UserProfile, mealType: MealType, foodIds: string[], date: string): MealPlan {
  const target = calculateMealTarget(profile, mealType)
  if (target.calories === 0) throw new Error('当前餐次不在用户选择的用餐方案中')

  const portions = foodIds.map(foodId => {
    const food = getFood(foodId)
    if (!food) throw new Error('包含不存在的食材')
    return { ...food, grams: food.preferredGrams }
  })

  if (!portions.length) throw new Error('请至少选择一种食材')

  const vegetablePortions = portions.filter(portion => portion.category === 'vegetable')
  if (vegetablePortions.length) {
    const totalGrams = mealType === 'breakfast' ? 150 : 200
    const baseGrams = Math.floor(totalGrams / vegetablePortions.length)
    let remainder = totalGrams - baseGrams * vegetablePortions.length
    vegetablePortions.forEach(portion => {
      const grams = baseGrams + (remainder > 0 ? 1 : 0)
      remainder = Math.max(0, remainder - 1)
      portion.grams = grams
      portion.minGrams = grams
      portion.maxGrams = grams
    })
  }

  const steps = [40, 20, 10, 5, 1]
  steps.forEach(step => {
    for (let pass = 0; pass < 10; pass += 1) {
      portions.forEach(portion => {
        const original = portion.grams
        const candidates = [original - step, original, original + step]
          .map(value => Math.max(portion.minGrams, Math.min(portion.maxGrams, value)))
        let best = original
        let bestScore = Number.POSITIVE_INFINITY
        candidates.forEach(candidate => {
          portion.grams = candidate
          const score = scorePortions(portions, target)
          if (score < bestScore) {
            bestScore = score
            best = candidate
          }
        })
        portion.grams = best
      })
    }
  })

  portions.forEach(portion => { portion.grams = Math.round(portion.grams) })
  const actual = calculatePortionMacros(portions)
  const errors = [
    Math.abs(actual.carbs - target.carbs) / Math.max(target.carbs, 1),
    Math.abs(actual.protein - target.protein) / Math.max(target.protein, 1),
    Math.abs(actual.fat - target.fat) / Math.max(target.fat, 1),
  ]
  const accuracy = Math.max(0, Math.round(100 - errors.reduce((sum, error) => sum + error, 0) / 3 * 100))

  return { date, mealType, target, actual, portions, accuracy }
}

export function mealName(mealType: MealType): string {
  return { breakfast: '早餐', lunch: '中餐', dinner: '晚餐' }[mealType]
}

export function activeMealTypes(mealsPerDay: 2 | 3): MealType[] {
  return mealsPerDay === 2 ? ['lunch', 'dinner'] : ['breakfast', 'lunch', 'dinner']
}
