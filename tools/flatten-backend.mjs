// Flatten the pnpm virtual store into plain node_modules so NSIS does not hit
// MAX_PATH on .pnpm's long directory names, then verify the CLI still boots.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import process from 'node:process'

const dest = 'C:\\Users\\user\\Documents\\smth-new\\melatonin-backend'
const nm = path.join(dest, 'node_modules')
const pnpm = path.join(nm, '.pnpm')

function packageDirs() {
  const out = new Map()
  if (!fs.existsSync(pnpm)) return out
  for (const entry of fs.readdirSync(pnpm, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const inner = path.join(pnpm, entry.name, 'node_modules')
    if (!fs.existsSync(inner)) continue
    for (const top of fs.readdirSync(inner, { withFileTypes: true })) {
      const topPath = path.join(inner, top.name)
      if (top.name.startsWith('@') && top.isDirectory()) {
        for (const scoped of fs.readdirSync(topPath, { withFileTypes: true })) {
          const name = `${top.name}/${scoped.name}`
          if (!out.has(name)) out.set(name, path.join(topPath, scoped.name))
        }
      } else if (top.isDirectory()) {
        if (!out.has(top.name)) out.set(top.name, topPath)
      }
    }
  }
  return out
}

function isRealDir(p) {
  try {
    const st = fs.lstatSync(p)
    return st.isDirectory() && !st.isSymbolicLink()
  } catch { return false }
}

const packages = packageDirs()
console.log('store packages:', packages.size)
let copied = 0, kept = 0
for (const [name, src] of packages) {
  const out = path.join(nm, name)
  if (isRealDir(out)) { kept++; continue }
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.cpSync(src, out, { recursive: true, dereference: true })
  copied++
}
console.log('copied:', copied, 'already real:', kept)

// Drop the store only after every package it held exists at top level.
fs.rmSync(pnpm, { recursive: true, force: true })
console.log('store removed')

function boot() {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['lib/bin.js', 'web', '--no-open', '--port', '0'], {
      cwd: dest, env: { ...process.env, DSH_BUILD_CLIENT_PROFILE: 'official' }, stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = '', err = ''
    const done = (ok, why) => { try { child.kill() } catch {}; resolve({ ok, why, out, err }) }
    const timer = setTimeout(() => done(false, 'timeout'), 30000)
    child.stdout.on('data', d => { out += d; if (out.includes('dsh web: ')) { clearTimeout(timer); done(true, 'url') } })
    child.stderr.on('data', d => { err += d })
    child.on('exit', c => { clearTimeout(timer); done(false, 'exit ' + c) })
  })
}

const r = await boot()
console.log(r.ok ? 'BOOT OK\n' + r.out.trim() : 'BOOT FAILED\n' + r.err.slice(0, 1500))
process.exit(r.ok ? 0 : 1)
