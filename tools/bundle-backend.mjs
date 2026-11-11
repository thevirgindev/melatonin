// Assemble a self-contained backend for the installer.
//
// 1. `pnpm deploy` for third-party production deps.
// 2. Copy every workspace package flat into node_modules/@<scope>/<name> so
//    Node resolution finds them from any depth (compiled lib only; sources,
//    tests and docs are skipped).
// 3. Boot the CLI; on a missing package, copy it and retry until it prints its URL.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repo = 'C:\\Users\\user\\Documents\\smth-new\\harness'
const dest = 'C:\\Users\\user\\Documents\\smth-new\\melatonin-backend'
const SKIP = ['node_modules', '.git', '.github', 'src', 'tests', 'test', '__tests__', 'docs', 'website', 'benchmarks', 'snapshots', '.agents', '.claude']

function log(...a) { console.log(...a) }

// name -> source dir
const workspace = new Map()
function scan(dir, depth) {
  if (depth > 4) return
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  if (entries.some(e => e.isFile() && e.name === 'package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
      if (pkg.name) workspace.set(pkg.name, dir)
    } catch {}
  }
  for (const e of entries) {
    if (!e.isDirectory() || SKIP.includes(e.name) || e.name.startsWith('.')) continue
    scan(path.join(dir, e.name), depth + 1)
  }
}
scan(repo, 0)
log('workspace packages:', workspace.size)

function robocopy(src, out) {
  fs.mkdirSync(out, { recursive: true })
  const args = [src, out, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1', '/XD', ...SKIP]
  const r = spawnSync('robocopy', args, { stdio: 'ignore' })
  return r.status
}

if (!fs.existsSync(path.join(dest, 'lib', 'bin.js'))) {
  log('pnpm deploy...')
  const r = spawnSync('pnpm', ['--filter', '@deepseek-ai/dsh', '--prod', 'deploy', dest], {
    cwd: repo, stdio: 'inherit', shell: true, env: { ...process.env }
  })
  log('deploy exit', r.status)
}

const SKIP_PKGS = new Set(['@deepseek-ai/dsh-root', '@deepseek-ai/dsh-desktop'])
const copied = new Set()
function ensurePackage(name) {
  if (!name || name.includes('/index.js') || copied.has(name)) {
    // absolute-path specifiers are the same package with a subpath
    name = name.replace(/\\[^\\]*$/, '')
  }
  if (!name) return false
  const out = path.join(dest, 'node_modules', name)
  const src = workspace.get(name)
  if (src) { robocopy(src, out); copied.add(name); log('  + workspace', name, 'from', path.basename(src)); return true }
  const link = path.join(repo, 'node_modules', name)
  if (fs.existsSync(link)) {
    let real = link
    try { real = fs.realpathSync(link) } catch {}
    robocopy(real, out); copied.add(name); log('  + external', name); return true
  }
  return false
}

// Pre-copy every workspace package. Cheap enough and removes most rounds.
log('copying workspace packages...')
for (const [name, src] of workspace) {
  if (SKIP_PKGS.has(name)) continue
  robocopy(src, path.join(dest, 'node_modules', name))
  copied.add(name)
}
log('workspace copy done')

function boot() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['lib/bin.js', 'web', '--no-open', '--port', '0'], {
      cwd: dest, env: { ...process.env, DSH_BUILD_CLIENT_PROFILE: 'official' }, stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = '', err = ''
    const done = (ok, reason) => { try { child.kill() } catch {}; resolve({ ok, reason, out, err }) }
    const timer = setTimeout(() => done(false, 'timeout'), 30000)
    child.stdout.on('data', d => {
      out += d
      if (out.includes('dsh web: ')) { clearTimeout(timer); done(true, 'url') }
    })
    child.stderr.on('data', d => { err += d })
    child.on('exit', code => { clearTimeout(timer); done(false, 'exit ' + code) })
  })
}

for (let round = 1; round <= 200; round++) {
  const r = await boot()
  if (r.ok) { log('BOOT OK (round', round + ')'); log(r.out.trim()); process.exit(0) }
  const m = /Cannot find package '([^']+)'/.exec(r.err)
  if (m) {
    log('round', round, 'missing', m[1])
    if (ensurePackage(m[1])) continue
    log('cannot source', m[1]); log(r.err.slice(0, 700)); process.exit(1)
  }
  log('round', round, 'stopped:', r.reason)
  log(r.err.slice(0, 1200))
  process.exit(1)
}
process.exit(1)
