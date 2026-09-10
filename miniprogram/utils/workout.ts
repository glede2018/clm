import { exercises } from '../data/exercises'

function isAvailable(item: ExerciseItem, equipment: WorkoutEquipment[]): boolean {
  // 器械选择用于检索相关动作：命中任意一种所选器械即可展示。
  // 动作需要的其他辅助器械仍会在结果卡片中完整标注。
  return item.equipment.some(required => equipment.includes(required))
}

function equipmentMatch(item: ExerciseItem, equipment: WorkoutEquipment[]): 'exact' | 'combined' | 'single' {
  const exact = item.equipment.length === equipment.length
    && equipment.every(selected => item.equipment.includes(selected))
  if (exact) return 'exact'
  const matchedEquipmentCount = item.equipment.filter(required => equipment.includes(required)).length
  return matchedEquipmentCount > 1 ? 'combined' : 'single'
}

function matchRank(item: ExerciseItem, equipment: WorkoutEquipment[]): number {
  const match = equipmentMatch(item, equipment)
  return match === 'exact' ? 3 : match === 'combined' ? 2 : 1
}

export function matchingExercises(
  muscles: WorkoutMuscle[],
  equipment: WorkoutEquipment[],
): ExerciseItem[] {
  return exercises
    .filter(item => isAvailable(item, equipment) && item.muscles.some(muscle => muscles.includes(muscle)))
    .sort((a, b) => {
      const equipmentDifference = matchRank(b, equipment) - matchRank(a, equipment)
      if (equipmentDifference) return equipmentDifference
      const muscleDifference = b.muscles.filter(muscle => muscles.includes(muscle)).length
        - a.muscles.filter(muscle => muscles.includes(muscle)).length
      if (muscleDifference) return muscleDifference
      return a.name.localeCompare(b.name)
    })
}

export function createWorkoutPlan(
  muscles: WorkoutMuscle[],
  equipment: WorkoutEquipment[],
  durationMinutes: number,
): WorkoutPlan {
  const candidates = matchingExercises(muscles, equipment)

  if (!candidates.length) throw new Error('当前肌肉和器械组合没有可用动作，请增加器械或更换部位')

  const items: WorkoutPlanItem[] = candidates.map(item => ({
    ...item,
    sets: durationMinutes <= 15 ? 2 : item.level === '进阶' ? 3 : 3,
    reps: item.muscles.includes('腹部') ? 15 : 12,
    restSeconds: item.level === '进阶' ? 75 : 45,
    completed: false,
    equipmentMatch: equipmentMatch(item, equipment),
  }))

  return {
    id: `workout_${Date.now()}`,
    createdAt: Date.now(),
    durationMinutes,
    muscles,
    equipment,
    items,
  }
}
