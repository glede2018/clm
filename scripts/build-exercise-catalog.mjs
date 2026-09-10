import { readFileSync, writeFileSync } from 'node:fs'

const sourcePath = process.argv[2] || '/private/tmp/exercises-dataset.json'
const outputPath = new URL('../miniprogram/data/exercises.ts', import.meta.url)
const manifestPath = new URL('../design-assets/workout-media/manifest.json', import.meta.url)

const selections = [
  ['0662', ['胸部'], ['自重'], '入门'],
  ['0659', ['胸部'], ['自重'], '入门'],
  ['0283', ['肱三头肌', '胸部'], ['自重'], '基础'],
  ['0274', ['腹部'], ['自重'], '入门'],
  ['3013', ['臀部', '大腿后侧'], ['自重'], '入门'],
  ['3470', ['臀部', '大腿前侧'], ['自重'], '入门'],
  ['1373', ['小腿'], ['自重'], '入门'],
  ['0664', ['腹部', '腹斜肌', '胸部'], ['自重'], '基础'],
  ['1421', ['前臂', '肱三头肌'], ['自重'], '基础'],
  ['1352', ['背部', '臀部'], ['自重'], '入门'],
  ['0129', ['肱三头肌'], ['自重', '长凳'], '基础'],
  ['3523', ['臀部', '大腿后侧'], ['自重', '长凳'], '基础'],
  ['0652', ['背部', '肱二头肌'], ['自重', '引体向上杆'], '基础'],
  ['1326', ['背部', '肱二头肌'], ['自重', '引体向上杆'], '基础'],
  ['0688', ['斜方肌', '背部'], ['自重', '引体向上杆'], '基础'],
  ['0289', ['胸部', '肱三头肌'], ['哑铃', '长凳'], '基础'],
  ['0293', ['背部', '肱二头肌'], ['哑铃'], '基础'],
  ['0294', ['肱二头肌'], ['哑铃'], '入门'],
  ['0334', ['肩部'], ['哑铃'], '入门'],
  ['1760', ['大腿前侧', '臀部'], ['哑铃'], '入门'],
  ['0430', ['肱三头肌'], ['哑铃'], '入门'],
  ['1459', ['臀部', '大腿后侧'], ['哑铃'], '基础'],
  ['0417', ['小腿'], ['哑铃'], '入门'],
  ['0383', ['肩部', '背部'], ['哑铃'], '基础'],
  ['0364', ['前臂'], ['哑铃'], '入门'],
  ['0025', ['胸部', '肱三头肌'], ['杠铃', '长凳'], '基础'],
  ['0027', ['背部', '肱二头肌'], ['杠铃'], '基础'],
  ['0032', ['臀部', '大腿后侧', '背部'], ['杠铃'], '进阶'],
  ['0043', ['臀部', '大腿前侧'], ['杠铃'], '进阶'],
  ['0091', ['肩部', '肱三头肌'], ['杠铃', '长凳'], '基础'],
  ['0031', ['肱二头肌'], ['杠铃'], '入门'],
  ['0109', ['肱三头肌'], ['杠铃'], '基础'],
  ['1372', ['小腿'], ['杠铃'], '基础'],
  ['0126', ['前臂'], ['杠铃', '长凳'], '入门'],
  ['0534', ['臀部', '大腿前侧'], ['壶铃'], '入门'],
  ['0549', ['臀部', '大腿后侧'], ['壶铃'], '基础'],
  ['0520', ['肩部', '肱三头肌'], ['壶铃'], '基础'],
  ['0522', ['背部', '肱二头肌'], ['壶铃'], '基础'],
  ['1298', ['胸部', '肱三头肌'], ['壶铃'], '基础'],
  ['0541', ['背部', '肱二头肌'], ['壶铃'], '入门'],
  ['0554', ['腹部', '腹斜肌', '肩部'], ['壶铃'], '进阶'],
  ['0536', ['臀部', '大腿前侧'], ['壶铃'], '基础'],
  ['0518', ['前臂', '肩部'], ['壶铃'], '基础'],
  ['0968', ['肱二头肌'], ['弹力带'], '入门'],
  ['0997', ['肩部', '肱三头肌'], ['弹力带'], '入门'],
  ['1009', ['臀部', '大腿后侧'], ['弹力带'], '基础'],
  ['1004', ['臀部', '大腿前侧'], ['弹力带'], '入门'],
  ['0998', ['肱三头肌'], ['弹力带'], '入门'],
  ['0993', ['肩部', '背部'], ['弹力带'], '基础'],
  ['1005', ['腹部'], ['弹力带'], '入门'],
  ['1013', ['背部', '肱二头肌'], ['弹力带'], '基础'],
  ['1016', ['前臂'], ['弹力带'], '入门'],
  ['0832', ['腹部'], ['配重片'], '入门'],
  ['0846', ['腹部', '腹斜肌'], ['配重片'], '基础'],
  ['0856', ['胸部'], ['配重片'], '入门'],
  ['0852', ['臀部', '大腿前侧'], ['配重片'], '基础'],
]

const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
const byId = new Map()
for (const item of source) if (!byId.has(item.id)) byId.set(item.id, item)

const exercises = selections.map(([id, muscles, equipment, level]) => {
  const item = byId.get(id)
  if (!item) throw new Error(`找不到动作 ${id}`)
  const instructions = item.instruction_steps?.zh || (item.instructions?.zh ? [item.instructions.zh] : [])
  if (!instructions.length) throw new Error(`动作 ${id} 没有中文说明`)
  return {
    id,
    name: item.name,
    muscles,
    equipment,
    level,
    instructions,
    thumbnailPath: item.image,
    gifPath: item.gif_url,
    attribution: '© Gym visual — https://gymvisual.com/',
  }
})

const output = `// 由 scripts/build-exercise-catalog.mjs 从上游数据生成。\n// 仅保留精选动作、中文说明及本项目 8 类器械。\nexport const exercises: ExerciseItem[] = ${JSON.stringify(exercises, null, 2)}\n\nexport function findExercise(id: string): ExerciseItem | undefined {\n  return exercises.find(item => item.id === id)\n}\n`
writeFileSync(outputPath, output)
writeFileSync(manifestPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  attribution: '© Gym visual — https://gymvisual.com/',
  files: exercises.flatMap(item => [item.thumbnailPath, item.gifPath]),
}, null, 2))

console.log(`已生成 ${exercises.length} 个动作，${exercises.length * 2} 个媒体文件清单`)
