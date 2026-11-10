// Audit captured boot artifacts against what the Host actually serves.
// Run after capture.mjs: node audit.mjs
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const repo = 'C:/Users/user/Documents/smth-new/_upstream/dsh'
const boot = 'C:/Users/user/Documents/smth-new/deepr-tauri/boot'
const graph = JSON.parse(readFileSync(join(boot, 'graph.json'), 'utf8'))
const packages = JSON.parse(readFileSync(join(boot, 'packages.json'), 'utf8'))
const bodies = JSON.parse(readFileSync(join(boot, 'bodies.json'), 'utf8'))

const bodiesMap = new Map(Object.entries(bodies).map(([url, b64]) => [url, Buffer.from(b64, 'base64')]))
const want = new Set([...graph.batches.map(b => b.url), ...graph.entries.map(e => e.url)])
console.log('graph entries', graph.entries.length, 'batches', graph.batches.length,
  'captured bodies', bodiesMap.size, 'wanted urls', want.size)
const missing = [...want].filter(url => !bodiesMap.has(url))
console.log('wanted urls missing from bodies.json:', missing.length)
for (const url of missing) console.log('  MISS', url)
const extra = [...bodiesMap.keys()].filter(url => !want.has(url))
console.log('bodies not wanted:', extra.length)
const collisions = new Map()
for (const url of bodiesMap.keys()) {
  const key = url.replace(/^plugins\//, '')
  if (collisions.has(key)) collisions.set(key, collisions.get(key) + 1)
}
console.log('path collisions outside the batches:', [...collisions.values()].filter(n => n > 1).length)

// Disk-bundle spot checks: body should equal the file bytes (minus the map trailer).
let checked = 0
let equal = 0
for (const entry of graph.entries) {
  const dir = packages[entry.id]
  if (dir === undefined) continue
  const file = join(repo, dir, 'lib', 'client.js')
  if (!existsSync(file)) { console.log('  NOBUNDLE', entry.id); continue }
  const key = `plugins/??${entry.id}/client.js&rev=${entry.rev}`
  const body = bodiesMap.get(key)
  if (body === undefined) { console.log('  NOBODY', entry.id, key); continue }
  checked++
  const disk = readFileSync(file)
  const strip = (buf) => buf.toString('utf8').replace(/(?:\r?\n)?\/\/# sourceMappingURL=[^\r\n]*(?:\r?\n)?$/, '')
  if (strip(body) === strip(disk)) equal++
  else console.log('  DIFFER', entry.id, body.length, disk.length)
}
console.log(`spot-checked ${checked}, identical to disk ${equal}`)
