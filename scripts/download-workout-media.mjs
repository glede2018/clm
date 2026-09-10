import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve('design-assets/workout-media')
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'))
const remoteRoot = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main'

let downloaded = 0
for (const file of manifest.files) {
  const destination = resolve(root, file)
  if (existsSync(destination)) continue
  mkdirSync(dirname(destination), { recursive: true })
  const response = await fetch(`${remoteRoot}/${file}`)
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`)
  writeFileSync(destination, Buffer.from(await response.arrayBuffer()))
  downloaded += 1
  if (downloaded % 10 === 0) console.log(`已下载 ${downloaded} 个文件`)
}

console.log(`完成：新下载 ${downloaded} 个文件，共 ${manifest.files.length} 个`)
