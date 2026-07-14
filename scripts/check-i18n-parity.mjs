import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, '..', 'src', 'locales')
const base = 'pt'
const locales = ['en', 'en-GB', 'es']

const leaves = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${p}${k}.`) : [`${p}${k}`],
  )

const refPath = path.join(dir, `${base}.json`)
const ref = new Set(leaves(JSON.parse(fs.readFileSync(refPath, 'utf8'))))
let ok = true

for (const loc of locales) {
  const cur = new Set(leaves(JSON.parse(fs.readFileSync(path.join(dir, `${loc}.json`), 'utf8'))))
  const missing = [...ref].filter((k) => !cur.has(k))
  const extra = [...cur].filter((k) => !ref.has(k))
  if (missing.length || extra.length) {
    ok = false
    console.log(`\n[${loc}] faltando: ${missing.length} | sobrando: ${extra.length}`)
    missing.slice(0, 30).forEach((k) => console.log('  - faltando', k))
    extra.slice(0, 30).forEach((k) => console.log('  + sobrando', k))
  }
}

console.log(ok ? '\n✅ paridade OK' : '\n❌ paridade quebrada')
process.exit(ok ? 0 : 1)
