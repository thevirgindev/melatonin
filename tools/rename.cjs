const fs = require('fs')
const path = require('path')

const root = 'C:\\Users\\user\\Documents\\smth-new\\Melatonin'
const SKIP = new Set(['target', '.git', '.tmpbuild', 'node_modules', 'dist', 'boot'])
const EXT = new Set(['.rs', '.json', '.toml', '.md', '.js', '.mjs', '.cjs', '.ps1', '.py', '.html', '.css', '.svg', '.txt', '.yml', '.yaml'])
const MAP = [
  ['Melatonin', 'Melatonin'],
  ['melatonin', 'melatonin'],
  ['MELATONIN', 'MELATONIN'],
]
let changed = 0
const touched = []

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP.has(e.name) || e.name.startsWith('.') && e.name !== '.gitignore') continue
      if (p.includes('melatonin-backend') || p.includes('harness')) continue
      walk(p)
      continue
    }
    if (!EXT.has(path.extname(e.name).toLowerCase())) continue
    let s
    try { s = fs.readFileSync(p, 'utf8') } catch { continue }
    const before = s
    for (const [a, b] of MAP) s = s.split(a).join(b)
    if (s !== before) { fs.writeFileSync(p, s); changed++; touched.push(path.relative(root, p)) }
  }
}

walk(root)
console.log('changed files:', changed)
for (const t of touched) console.log(' ', t)
