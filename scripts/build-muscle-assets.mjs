import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const referenceArg = process.argv[2]
if (!referenceArg) throw new Error('用法：npm run workout:muscles -- /path/to/workout-cool')
const referenceRoot = resolve(referenceArg)
const sourceRoot = resolve(referenceRoot, 'src/features/workout-builder/ui')
const outputRoot = resolve('miniprogram/assets/muscles')
const muscleNames = [
  'abdominals', 'back', 'biceps', 'calves', 'chest', 'forearms', 'glutes',
  'hamstrings', 'obliques', 'quadriceps', 'shoulders', 'traps', 'triceps',
]

function jsxToSvg(source, fill) {
  return source
    .replace(/<path([\s\S]*?)className=\{getMuscleClasses\([^)]*\)\}([\s\S]*?)\/>/g, (_match, before, after) => {
      const attributes = `${before}${after}`.replace(/\sfill="[^"]*"/g, '')
      return `<path${attributes} fill="${fill}" />`
    })
    .replace(/<g[^>]*onClick=\{[^}]+\}[^>]*>/g, '<g>')
    .replace(/className=\{getMuscleClasses\([^)]*\)\}/g, `fill="${fill}"`)
    .replace(/className="fill-transparent"/g, 'fill="transparent"')
    .replace(/\sdata-elem=\{[^}]+\}/g, '')
    .replace(/\sclassName="[^"]*"/g, '')
    .replace(/strokeWidth=/g, 'stroke-width=')
    .replace(/strokeLinejoin=/g, 'stroke-linejoin=')
    .replace(/strokeLinecap=/g, 'stroke-linecap=')
    .replace(/fillRule=/g, 'fill-rule=')
    .replace(/clipRule=/g, 'clip-rule=')
}

const groups = new Map()
for (const name of muscleNames) {
  const source = readFileSync(resolve(sourceRoot, `muscles/${name}-group.tsx`), 'utf8')
  const start = source.indexOf('<g')
  const end = source.lastIndexOf('</g>') + 4
  if (start < 0 || end < 4) throw new Error(`无法解析 ${name}`)
  groups.set(name, source.slice(start, end))
}

const componentNames = {
  Biceps: 'biceps', Forearms: 'forearms', Chest: 'chest', Triceps: 'triceps',
  Abdominals: 'abdominals', Obliques: 'obliques', Quadriceps: 'quadriceps',
  Shoulders: 'shoulders', Calves: 'calves', Traps: 'traps', Back: 'back',
  Hamstrings: 'hamstrings', Glutes: 'glutes',
}

const selectionSource = readFileSync(resolve(sourceRoot, 'muscle-selection.tsx'), 'utf8')
const svgStart = selectionSource.indexOf('<svg')
const svgOpenEnd = selectionSource.indexOf('>', svgStart) + 1
const svgEnd = selectionSource.indexOf('</svg>', svgOpenEnd)
let body = selectionSource.slice(svgOpenEnd, svgEnd)
for (const [component, name] of Object.entries(componentNames)) {
  const pattern = new RegExp(`<${component}Group[^>]*/>`)
  body = body.replace(pattern, jsxToSvg(groups.get(name), '#bdbdbd'))
}
body = jsxToSvg(body, '#bdbdbd')

mkdirSync(outputRoot, { recursive: true })
const wrapper = content => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 535 462" width="1070" height="924">${content}</svg>\n`
writeFileSync(resolve(outputRoot, 'body-base.svg'), wrapper(body))
for (const name of muscleNames) {
  writeFileSync(resolve(outputRoot, `${name}.svg`), wrapper(jsxToSvg(groups.get(name), '#e86f51')))
}

console.log(`已生成 1 张人体底图和 ${muscleNames.length} 个肌肉高亮层`)
