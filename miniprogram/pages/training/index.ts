import { exercises } from '../../data/exercises'
import { resolveWorkoutMediaUrls, workoutMediaUrl } from '../../config/workout-media'
import { getWorkoutEquipment, getWorkoutLogs, saveCurrentWorkout, saveWorkoutEquipment } from '../../utils/storage'
import { createWorkoutPlan, matchingExercises } from '../../utils/workout'

interface MuscleSpot {
  id: string
  muscle: WorkoutMuscle
  top: number
  left: number
  width: number
  height: number
}

interface MuscleLayer { muscle: WorkoutMuscle; mediaPath: string; src: string }

interface EquipmentChoice {
  name: WorkoutEquipment
  mediaPath: string
  image: string
  selected: boolean
}

const EQUIPMENT: Array<{ name: WorkoutEquipment; mediaPath: string; image: string }> = [
  { name: '自重', mediaPath: 'equipment/bodyweight.png', image: workoutMediaUrl('equipment/bodyweight.png') },
  { name: '哑铃', mediaPath: 'equipment/dumbbell.png', image: workoutMediaUrl('equipment/dumbbell.png') },
  { name: '杠铃', mediaPath: 'equipment/barbell.png', image: workoutMediaUrl('equipment/barbell.png') },
  { name: '壶铃', mediaPath: 'equipment/kettlebell.png', image: workoutMediaUrl('equipment/kettlebell.png') },
  { name: '弹力带', mediaPath: 'equipment/band.png', image: workoutMediaUrl('equipment/band.png') },
  { name: '配重片', mediaPath: 'equipment/plate.png', image: workoutMediaUrl('equipment/plate.png') },
  { name: '引体向上杆', mediaPath: 'equipment/pull-up-bar.png', image: workoutMediaUrl('equipment/pull-up-bar.png') },
  { name: '长凳', mediaPath: 'equipment/bench.png', image: workoutMediaUrl('equipment/bench.png') },
]
const MUSCLE_LAYERS: MuscleLayer[] = [
  { muscle: '肩部', mediaPath: 'muscles/shoulders.svg', src: workoutMediaUrl('muscles/shoulders.svg') },
  { muscle: '胸部', mediaPath: 'muscles/chest.svg', src: workoutMediaUrl('muscles/chest.svg') },
  { muscle: '肱二头肌', mediaPath: 'muscles/biceps.svg', src: workoutMediaUrl('muscles/biceps.svg') },
  { muscle: '前臂', mediaPath: 'muscles/forearms.svg', src: workoutMediaUrl('muscles/forearms.svg') },
  { muscle: '腹部', mediaPath: 'muscles/abdominals.svg', src: workoutMediaUrl('muscles/abdominals.svg') },
  { muscle: '腹斜肌', mediaPath: 'muscles/obliques.svg', src: workoutMediaUrl('muscles/obliques.svg') },
  { muscle: '斜方肌', mediaPath: 'muscles/traps.svg', src: workoutMediaUrl('muscles/traps.svg') },
  { muscle: '肱三头肌', mediaPath: 'muscles/triceps.svg', src: workoutMediaUrl('muscles/triceps.svg') },
  { muscle: '背部', mediaPath: 'muscles/back.svg', src: workoutMediaUrl('muscles/back.svg') },
  { muscle: '臀部', mediaPath: 'muscles/glutes.svg', src: workoutMediaUrl('muscles/glutes.svg') },
  { muscle: '大腿前侧', mediaPath: 'muscles/quadriceps.svg', src: workoutMediaUrl('muscles/quadriceps.svg') },
  { muscle: '大腿后侧', mediaPath: 'muscles/hamstrings.svg', src: workoutMediaUrl('muscles/hamstrings.svg') },
  { muscle: '小腿', mediaPath: 'muscles/calves.svg', src: workoutMediaUrl('muscles/calves.svg') },
]
let resolvedMuscleLayers = MUSCLE_LAYERS
let mediaRequestVersion = 0
const MUSCLE_SPOTS: MuscleSpot[] = [
  { id: 'front-shoulders', muscle: '肩部', top: 15, left: 8, width: 35, height: 10 },
  { id: 'front-chest', muscle: '胸部', top: 20, left: 13, width: 18, height: 10 },
  { id: 'front-biceps-left', muscle: '肱二头肌', top: 24, left: 8, width: 7, height: 13 },
  { id: 'front-biceps-right', muscle: '肱二头肌', top: 24, left: 31, width: 7, height: 13 },
  { id: 'front-forearms-left', muscle: '前臂', top: 35, left: 2, width: 9, height: 17 },
  { id: 'front-forearms-right', muscle: '前臂', top: 35, left: 36, width: 9, height: 17 },
  { id: 'front-abs', muscle: '腹部', top: 29, left: 18, width: 9, height: 19 },
  { id: 'front-obliques-left', muscle: '腹斜肌', top: 29, left: 13, width: 5, height: 19 },
  { id: 'front-obliques-right', muscle: '腹斜肌', top: 29, left: 27, width: 5, height: 19 },
  { id: 'front-quads', muscle: '大腿前侧', top: 49, left: 13, width: 19, height: 23 },
  { id: 'front-calves', muscle: '小腿', top: 72, left: 12, width: 21, height: 20 },
  { id: 'back-shoulders', muscle: '肩部', top: 17, left: 65, width: 27, height: 10 },
  { id: 'back-traps', muscle: '斜方肌', top: 16, left: 73, width: 10, height: 13 },
  { id: 'back-triceps-left', muscle: '肱三头肌', top: 25, left: 64, width: 7, height: 14 },
  { id: 'back-triceps-right', muscle: '肱三头肌', top: 25, left: 88, width: 7, height: 14 },
  { id: 'back-back', muscle: '背部', top: 25, left: 71, width: 15, height: 19 },
  { id: 'back-glutes', muscle: '臀部', top: 41, left: 70, width: 17, height: 13 },
  { id: 'back-hamstrings', muscle: '大腿后侧', top: 53, left: 70, width: 17, height: 20 },
  { id: 'back-calves', muscle: '小腿', top: 72, left: 69, width: 19, height: 20 },
]

Page({
  onReady() { wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }) },
  onShareAppMessage() {
    return { title: '食克有数｜食材配餐、训练计划，让每一天更有数', path: '/pages/home/index', imageUrl: '/assets/share-logo.png' }
  },
  onShareTimeline() {
    return { title: '食克有数｜选食材、算克重、记饮食和训练', query: 'from=timeline', imageUrl: '/assets/share-logo.png' }
  },
  data: {
    step: 1 as 1 | 2,
    bodyBaseImage: workoutMediaUrl('muscles/body-base.svg'),
    muscleSpots: MUSCLE_SPOTS,
    selectedLayers: MUSCLE_LAYERS.filter(item => item.muscle === '胸部'),
    selectedMuscles: ['胸部'] as WorkoutMuscle[],
    equipment: [] as EquipmentChoice[],
    durations: [15, 30, 45, 60],
    durationMinutes: 30,
    exerciseCount: exercises.length,
    matchingCount: 0,
    completedCount: 0,
  },

  onShow() {
    const requestVersion = ++mediaRequestVersion
    const selected = getWorkoutEquipment()
    this.setData({
      equipment: EQUIPMENT.map(item => ({ ...item, selected: selected.includes(item.name) })),
      matchingCount: matchingExercises(this.data.selectedMuscles, selected).length,
      completedCount: getWorkoutLogs().length,
    })
    const musclePaths = ['muscles/body-base.svg', ...MUSCLE_LAYERS.map(item => item.mediaPath)]
    void Promise.all([
      resolveWorkoutMediaUrls(musclePaths),
      resolveWorkoutMediaUrls(EQUIPMENT.map(item => item.mediaPath)),
    ]).then(([muscleUrls, equipmentUrls]) => {
      if (requestVersion !== mediaRequestVersion) return
      const selectedEquipment = this.data.equipment.filter(item => item.selected).map(item => item.name)
      resolvedMuscleLayers = MUSCLE_LAYERS.map((item, index) => ({ ...item, src: muscleUrls[index + 1] }))
      this.setData({
        bodyBaseImage: muscleUrls[0],
        selectedLayers: resolvedMuscleLayers.filter(item => this.data.selectedMuscles.includes(item.muscle)),
        equipment: EQUIPMENT.map((item, index) => ({
          ...item,
          image: equipmentUrls[index],
          selected: selectedEquipment.includes(item.name),
        })),
      })
    })
  },

  onUnload() { mediaRequestVersion += 1 },

  toggleMuscle(event: WechatMiniprogram.TouchEvent) {
    const muscle = event.currentTarget.dataset.muscle as WorkoutMuscle
    const isSelected = this.data.selectedMuscles.includes(muscle)
    const selectedMuscles = isSelected
      ? this.data.selectedMuscles.filter(item => item !== muscle)
      : [...this.data.selectedMuscles, muscle]
    this.updateMuscles(selectedMuscles)
  },

  removeMuscle(event: WechatMiniprogram.TouchEvent) {
    const muscle = event.currentTarget.dataset.muscle as WorkoutMuscle
    this.updateMuscles(this.data.selectedMuscles.filter(item => item !== muscle))
  },

  nextStep() {
    if (!this.data.selectedMuscles.length) {
      wx.showToast({ title: '请先选择至少一个肌肉部位', icon: 'none' })
      return
    }
    const equipment = this.data.equipment.filter(item => item.selected).map(item => item.name)
    this.setData({ step: 2, matchingCount: matchingExercises(this.data.selectedMuscles, equipment).length })
  },

  previousStep() {
    this.setData({ step: 1 })
  },

  updateMuscles(selectedMuscles: WorkoutMuscle[]) {
    this.setData({
      selectedMuscles,
      selectedLayers: resolvedMuscleLayers.filter(item => selectedMuscles.includes(item.muscle)),
    })
  },

  toggleEquipment(event: WechatMiniprogram.TouchEvent) {
    const name = event.currentTarget.dataset.name as WorkoutEquipment
    const equipment = this.data.equipment.map(item => item.name === name ? { ...item, selected: !item.selected } : item)
    const selected = equipment.filter(item => item.selected).map(item => item.name)
    this.setData({ equipment, matchingCount: matchingExercises(this.data.selectedMuscles, selected).length })
    saveWorkoutEquipment(selected)
  },

  selectDuration(event: WechatMiniprogram.TouchEvent) {
    this.setData({ durationMinutes: Number(event.currentTarget.dataset.value) })
  },

  generateWorkout() {
    if (!this.data.selectedMuscles.length) {
      wx.showToast({ title: '请先在肌肉图上选择部位', icon: 'none' })
      return
    }
    const equipment = this.data.equipment.filter(item => item.selected).map(item => item.name)
    if (!equipment.length) {
      wx.showToast({ title: '请至少选择一种器械', icon: 'none' })
      return
    }
    try {
      const plan = createWorkoutPlan(this.data.selectedMuscles, equipment, this.data.durationMinutes)
      saveCurrentWorkout(plan)
      wx.navigateTo({ url: '/pages/workout/index' })
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : '暂时无法生成训练', icon: 'none', duration: 2600 })
    }
  },
})
