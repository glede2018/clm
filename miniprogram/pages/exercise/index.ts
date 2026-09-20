import { productShareHandlers } from '../../utils/share'
import { resolveWorkoutMediaUrl, workoutMediaUrl } from '../../config/workout-media'
import { findExercise } from '../../data/exercises'
import { guardPageAccess } from '../../utils/storage'

Page({
  ...productShareHandlers,
  data: {
    exercise: null as ExerciseItem | null,
    gifUrl: '',
    equipmentText: '',
    muscleText: '',
  },

  onLoad(query: Record<string, string | undefined>) {
    if (!guardPageAccess()) return
    const exercise = findExercise(query.id || '')
    if (!exercise) {
      wx.showToast({ title: '没有找到这个动作', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
      return
    }
    this.setData({
      exercise,
      gifUrl: workoutMediaUrl(exercise.gifPath),
      equipmentText: exercise.equipment.join(' + '),
      muscleText: exercise.muscles.join(' · '),
    })
    void resolveWorkoutMediaUrl(exercise.gifPath).then(gifUrl => this.setData({ gifUrl }))
  },
})
