import assert from 'node:assert/strict'
import { createMealPlan, calculateDailyTarget, calculateMealTarget, resolveExerciseTier } from '../miniprogram/utils/nutrition'

const profile: UserProfile = {
  nickname: '测试用户',
  gender: 'female',
  age: 28,
  heightCm: 165,
  weightKg: 62,
  weeklyExerciseHours: 4.5,
  weeklyExerciseTimes: 3,
  exerciseTier: 2,
  mealsPerDay: 3,
  updatedAt: 0,
}

assert.equal(resolveExerciseTier(4.5, 3), 2)
assert.equal(resolveExerciseTier(5, 2), 1, '运动时长和次数跨档时应采用较低档')

const daily = calculateDailyTarget(profile)
assert.deepEqual(daily, { carbs: 136.4, protein: 99.2, fat: 68.2, calories: 1556 })

const lunch = calculateMealTarget(profile, 'lunch')
assert.equal(lunch.carbs, 54.6)
assert.equal(lunch.protein, 39.7)
assert.equal(lunch.fat, 27.3)

const twoMealProfile: UserProfile = { ...profile, mealsPerDay: 2 }
assert.equal(calculateMealTarget(twoMealProfile, 'breakfast').calories, 0)
assert.equal(calculateMealTarget(twoMealProfile, 'lunch').carbs, 75)
assert.equal(calculateMealTarget(twoMealProfile, 'dinner').carbs, 61.4)

const cases: Array<[MealType, string[]]> = [
  ['breakfast', ['oats', 'egg', 'pumpkin-seed', 'blueberry']],
  ['lunch', ['rice', 'cooking-oil', 'chicken-breast', 'broccoli', 'tomato']],
  ['dinner', ['sweet-potato', 'beef', 'nuts']],
]

const crossMeal = createMealPlan(profile, 'breakfast', ['rice', 'chicken-breast', 'cooking-oil', 'broccoli'], '2026-08-18')
assert.ok(crossMeal.portions.length === 4, '任意食材都应可用于任意餐次')

cases.forEach(([mealType, foods]) => {
  const plan = createMealPlan(profile, mealType, foods, '2026-08-18')
  assert.ok(plan.accuracy >= 85, `${mealType} 的营养匹配度不应低于 85%`)
  plan.portions.forEach(portion => {
    assert.ok(portion.grams >= portion.minGrams && portion.grams <= portion.maxGrams, `${portion.name} 克数应在合理范围内`)
  })
})

console.log('营养计算测试通过')
