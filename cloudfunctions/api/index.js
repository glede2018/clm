const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = {
  users: 'users',
  meals: 'meal_records',
  weights: 'weight_records',
  bindings: 'coach_bindings',
  invites: 'coach_invites',
}

const WORKOUT_MEDIA_ROOT = 'cloud://cloud1-d1gpmlqv6da1fe64b.636c-cloud1-d1gpmlqv6da1fe64b-1417851962/workout-media'
const WORKOUT_MEDIA_PATH = /^(images|videos|muscles|equipment)\/[A-Za-z0-9._-]+\.(jpg|gif|svg|png)$/

function success(data = null) { return { ok: true, data } }
function failure(message) { return { ok: false, message } }
function isDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') }
function round(value, digits = 1) {
  const factor = 10 ** digits
  return Math.round(Number(value) * factor) / factor
}

function randomNickname() {
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

function safeProfile(profile) {
  const gender = profile.gender === 'male' ? 'male' : 'female'
  return {
    nickname: String(profile.nickname || '微信用户').slice(0, 20),
    avatarUrl: String(profile.avatarUrl || '').slice(0, 500),
    gender,
    age: Math.max(18, Math.min(100, Number(profile.age))),
    heightCm: Math.max(130, Math.min(230, Number(profile.heightCm))),
    weightKg: Math.max(30, Math.min(300, Number(profile.weightKg))),
    weeklyExerciseHours: Math.max(0, Math.min(20, Number(profile.weeklyExerciseHours))),
    weeklyExerciseTimes: Math.max(0, Math.min(14, Number(profile.weeklyExerciseTimes))),
    exerciseTier: Math.max(1, Math.min(4, Number(profile.exerciseTier))),
    mealsPerDay: Number(profile.mealsPerDay) === 2 ? 2 : 3,
    initialized: true,
    updatedAt: db.serverDate(),
  }
}

async function login(openId, userInfo = {}) {
  const ref = db.collection(COLLECTIONS.users).doc(openId)
  const existing = await getProfile(openId)
  const existingNickname = String(existing?.nickname || '').trim()
  const nickname = String(
    userInfo.nickname || (existingNickname && existingNickname !== '微信用户' && !/^\d{8}$/.test(existingNickname) ? existingNickname : randomNickname()),
  ).trim().slice(0, 20)
  const avatarUrl = String(userInfo.avatarUrl || existing?.avatarUrl || '').slice(0, 500)

  const authData = {
    ownerId: openId,
    nickname: nickname || '微信用户',
    avatarUrl,
    authorizedAt: db.serverDate(),
    updatedAt: db.serverDate(),
  }
  if (existing) await ref.update({ data: authData })
  else await ref.set({ data: { ...authData, initialized: false, createdAt: db.serverDate() } })

  const profile = await getProfile(openId)
  return {
    initialized: profile?.initialized === true,
    nickname: profile?.nickname || nickname,
    profile: profile?.initialized ? profile : null,
  }
}

function safeMacro(macro = {}) {
  return {
    carbs: round(Math.max(0, Number(macro.carbs))),
    protein: round(Math.max(0, Number(macro.protein))),
    fat: round(Math.max(0, Number(macro.fat))),
    calories: Math.round(Math.max(0, Number(macro.calories))),
  }
}

function safeMealPlan(plan, openId) {
  if (!isDate(plan?.date)) throw new Error('餐食日期无效')
  if (!['breakfast', 'lunch', 'dinner'].includes(plan.mealType)) throw new Error('餐次无效')
  if (!Array.isArray(plan.portions) || !plan.portions.length || plan.portions.length > 8) throw new Error('食材数据无效')
  return {
    ownerId: openId,
    date: plan.date,
    mealType: plan.mealType,
    target: safeMacro(plan.target),
    actual: safeMacro(plan.actual),
    accuracy: Math.max(0, Math.min(100, Math.round(Number(plan.accuracy)))),
    portions: plan.portions.map(portion => ({
      id: String(portion.id).slice(0, 40),
      name: String(portion.name).slice(0, 30),
      category: String(portion.category).slice(0, 30),
      grams: Math.max(1, Math.min(1000, Math.round(Number(portion.grams)))),
    })),
    completedAt: Number(plan.completedAt) || Date.now(),
    updatedAt: db.serverDate(),
  }
}

async function saveProfile(openId, profile) {
  const ref = db.collection(COLLECTIONS.users).doc(openId)
  const safe = safeProfile(profile || {})
  try {
    await ref.update({ data: safe })
  } catch (error) {
    await ref.set({ data: { ...safe, ownerId: openId, createdAt: db.serverDate() } })
  }
  return safe
}

async function getProfile(openId) {
  try {
    const result = await db.collection(COLLECTIONS.users).doc(openId).get()
    return result.data
  } catch (error) {
    return null
  }
}

async function saveMeal(openId, plan) {
  const safe = safeMealPlan(plan, openId)
  const id = `${openId}_${safe.date}_${safe.mealType}`
  await db.collection(COLLECTIONS.meals).doc(id).set({ data: safe })
  return safe
}

async function listMeals(openId, payload) {
  const condition = { ownerId: openId }
  if (isDate(payload?.date)) condition.date = payload.date
  const query = db.collection(COLLECTIONS.meals).where(condition)
  const result = await query.orderBy('date', 'desc').limit(100).get()
  return result.data
}

async function saveWeight(openId, record) {
  if (!isDate(record?.date)) throw new Error('体重日期无效')
  const weightKg = round(record.weightKg)
  if (weightKg < 30 || weightKg > 300) throw new Error('体重数值无效')
  const safe = { ownerId: openId, date: record.date, weightKg, createdAt: db.serverDate() }
  await db.collection(COLLECTIONS.weights).doc(`${openId}_${record.date}`).set({ data: safe })
  return safe
}

async function listWeights(openId) {
  const result = await db.collection(COLLECTIONS.weights).where({ ownerId: openId }).orderBy('date', 'desc').limit(100).get()
  return result.data
}

function randomInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 6; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

async function ensureCollection(collectionName) {
  try {
    await db.createCollection(collectionName)
  } catch (error) {
    const message = String(error?.message || error?.errMsg || error || '')
    if (!/exist|already|存在/i.test(message)) throw error
  }
}

async function ensureBindingCollections() {
  await ensureCollection(COLLECTIONS.invites)
  await ensureCollection(COLLECTIONS.bindings)
}

async function createInvite(openId) {
  await ensureBindingCollections()
  const code = randomInviteCode()
  await db.collection(COLLECTIONS.invites).doc(code).set({
    data: { code, inviterId: openId, used: false, createdAt: db.serverDate() },
  })
  return { code }
}

function bindingId(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join('_')
}

async function bindUser(openId, codeValue) {
  await ensureBindingCollections()
  const code = String(codeValue || '').toUpperCase().trim()
  if (!/^[A-Z2-9]{6}$/.test(code)) throw new Error('邀请码格式错误')
  let partnerId = ''
  await db.runTransaction(async transaction => {
    const inviteRef = transaction.collection(COLLECTIONS.invites).doc(code)
    const invite = await inviteRef.get()
    if (!invite.data || invite.data.used) throw new Error('邀请码不存在或已使用')
    partnerId = invite.data.inviterId || invite.data.coachId
    if (!partnerId) throw new Error('邀请码数据无效')
    if (partnerId === openId) throw new Error('不能绑定自己')
    const [userA, userB] = [openId, partnerId].sort()
    await inviteRef.update({ data: { used: true, usedBy: openId, usedAt: db.serverDate() } })
    await transaction.collection(COLLECTIONS.bindings).doc(bindingId(userA, userB)).set({
      data: { userA, userB, active: true, createdAt: db.serverDate() },
    })
  })
  return { partnerId }
}

async function unbindUser(openId, partnerIdValue) {
  const partnerId = String(partnerIdValue || '')
  if (!partnerId || partnerId === openId) throw new Error('绑定用户无效')
  const ref = db.collection(COLLECTIONS.bindings).doc(bindingId(openId, partnerId))
  const binding = await ref.get()
  if (![binding.data?.userA, binding.data?.userB].includes(openId)) throw new Error('没有解除该绑定的权限')
  await ref.update({ data: { active: false, endedAt: db.serverDate(), endedBy: openId } })
  return { unbound: true }
}

async function listPartners(openId) {
  const [asA, asB] = await Promise.all([
    db.collection(COLLECTIONS.bindings).where({ userA: openId }).limit(100).get(),
    db.collection(COLLECTIONS.bindings).where({ userB: openId }).limit(100).get(),
  ])
  const bindings = [...asA.data, ...asB.data].filter(item => item.active)
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  return Promise.all(bindings.map(async binding => {
    const partnerId = binding.userA === openId ? binding.userB : binding.userA
    const [profileResult, mealResult, weightResult] = await Promise.all([
      db.collection(COLLECTIONS.users).doc(partnerId).get(),
      db.collection(COLLECTIONS.meals).where({ ownerId: partnerId, date: today }).count(),
      db.collection(COLLECTIONS.weights).where({ ownerId: partnerId }).orderBy('date', 'desc').limit(1).get(),
    ])
    const profile = profileResult.data || {}
    return {
      openId: partnerId,
      nickname: profile.nickname || '用户',
      initial: (profile.nickname || '用').slice(0, 1),
      todayMeals: mealResult.total,
      targetMeals: profile.mealsPerDay || 3,
      latestWeight: weightResult.data[0]?.weightKg,
    }
  }))
}

async function getPartnerDetail(openId, partnerIdValue) {
  const partnerId = String(partnerIdValue || '')
  const binding = await db.collection(COLLECTIONS.bindings).doc(bindingId(openId, partnerId)).get()
  const members = [binding.data?.userA, binding.data?.userB]
  if (!binding.data?.active || !members.includes(openId) || !members.includes(partnerId)) throw new Error('没有查看该用户的权限')
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  const [profileResult, mealsResult, weightsResult] = await Promise.all([
    db.collection(COLLECTIONS.users).doc(partnerId).get(),
    db.collection(COLLECTIONS.meals).where({ ownerId: partnerId, date: today }).orderBy('completedAt', 'asc').get(),
    db.collection(COLLECTIONS.weights).where({ ownerId: partnerId }).orderBy('date', 'desc').limit(30).get(),
  ])
  const profile = profileResult.data
  return {
    profile: {
      nickname: profile.nickname,
      gender: profile.gender,
      mealsPerDay: profile.mealsPerDay,
    },
    date: today,
    meals: mealsResult.data,
    weights: weightsResult.data.reverse(),
  }
}

async function getWorkoutMediaUrls(pathsValue) {
  if (!Array.isArray(pathsValue) || !pathsValue.length || pathsValue.length > 20) throw new Error('媒体路径数量无效')
  const paths = pathsValue.map(value => String(value || '').replace(/^\/+/, ''))
  if (paths.some(path => !WORKOUT_MEDIA_PATH.test(path))) throw new Error('媒体路径无效')
  const result = await cloud.getTempFileURL({ fileList: paths.map(path => `${WORKOUT_MEDIA_ROOT}/${path}`) })
  return {
    urls: paths.map((path, index) => ({
      path,
      url: result.fileList[index]?.status === 0 ? result.fileList[index].tempFileURL : '',
    })),
  }
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const action = event?.action
  const payload = event?.payload || {}

  try {
    if (action !== 'auth.login') {
      const account = await getProfile(OPENID)
      if (!account?.authorizedAt) return failure('请先完成微信登录')
    }
    switch (action) {
      case 'auth.login': return success(await login(OPENID, payload.userInfo))
      case 'profile.save': return success(await saveProfile(OPENID, payload.profile))
      case 'profile.get': return success(await getProfile(OPENID))
      case 'meal.save': return success(await saveMeal(OPENID, payload.plan))
      case 'meal.list': return success(await listMeals(OPENID, payload))
      case 'weight.save': return success(await saveWeight(OPENID, payload.record))
      case 'weight.list': return success(await listWeights(OPENID))
      case 'binding.createInvite': return success(await createInvite(OPENID))
      case 'binding.bind': return success(await bindUser(OPENID, payload.code))
      case 'binding.unbind': return success(await unbindUser(OPENID, payload.partnerId))
      case 'binding.partners': return success(await listPartners(OPENID))
      case 'binding.partnerDetail': return success(await getPartnerDetail(OPENID, payload.partnerId))
      case 'media.urls': return success(await getWorkoutMediaUrls(payload.paths))
      default: return failure('未知操作')
    }
  } catch (error) {
    console.error(action, error)
    return failure(error.message || '服务暂时不可用')
  }
}
