import { readdirSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dir = join(__dirname, '..', 'dist', 'electron-main')

let count = 0
for (const file of readdirSync(dir)) {
  if (file.endsWith('.js')) {
    const from = join(dir, file)
    const to = join(dir, file.replace(/\.js$/, '.cjs'))
    renameSync(from, to)
    count++
  }
}
console.log(`Renamed ${count} .js -> .cjs`)
