// Byte-level audit: compare a captured combo against the disk bundles it
// names, replaying the Host server's prepareSource/comboScript rules.
// Run: node audit2.mjs
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

const repo = 'C:/Users/user/Documents/smth-new/_upstream/dsh'
const boot = 'C:/Users/user/Documents/smth-new/deepr-tauri/boot'
const graph = JSON.parse(readFileSync(join(boot, 'graph.json'), 'utf8'))
const packages = JSON.parse(readFileSync(join(boot, 'packages.json'), 'utf8'))
const bodies = JSON.parse(readFileSync(join(boot, 'bodies.json'), 'utf8'))
const map = new Map(Object.entries(bodies).map(([u, b]) => [u, Buffer.from(b, 'base64')]))

const MAP_TRAILER = /(?:\r?\n)?\/\/# sourceMappingURL=[^\r\n]*(?:\r?\n)?$/
const URL_TRAILER = /(?:\r?\n)?\/\/# sourceURL=([^\r\n]+)(?:\r?\n)?$/
function prepare(bytes, id, fileName) {
  let source = bytes.toString('utf8')
  const sourceUrl = URL_TRAILER.exec(source)?.[1]
  source = source.replace(URL_TRAILER, '').replace(MAP_TRAILER, '')
  if (!source.endsWith('\n')) source += '\n'
  const fallback = sourceUrl === undefined
    ? `/plugins/${id}/${fileName}`
    : /^(?:[A-Za-z][A-Za-z\d+.-]*:|\/)/.test(sourceUrl) ? sourceUrl : `/${sourceUrl}`
  return { source, fallback }
}
const clientExport = (pkg) => {
  const c = pkg?.exports?.['./client']
  if (c === undefined) return undefined
  if (typeof c === 'string') return c
  if (typeof c === 'object' && c !== null && typeof c.default === 'string') return c.default
  return undefined
}
function bundlePath(id) {
  const dir = packages[id]
  if (dir === undefined) return undefined
  const manifestPath = join(repo, dir, 'package.json')
  if (!existsSync(manifestPath)) return undefined
  const rel = clientExport(JSON.parse(readFileSync(manifestPath, 'utf8')))
  if (rel === undefined) return undefined
  return join(repo, dir, rel)
}
const comboIds = (url) => {
  const decoded = decodeURIComponent(url)
  return decoded.slice(decoded.indexOf('??') + 2, decoded.indexOf('&rev=')).split(',').map(id => id.replace(/\/client\.js$/, ''))
}
const comboSearch = (ids, rev, withMap = false) => `??${ids.map(id => `${id}/client.js${withMap ? '.map' : ''}`).join(',')}&rev=${rev}`

let ok = 0, bad = 0, skipped = 0
for (const chunk of graph.batches) {
  const key = chunk.url.startsWith('plugins/') ? chunk.url : `plugins/${chunk.url}`
  const body = map.get(key)?.toString('utf8')
  if (body === undefined) { console.log('NOBODY', key); bad++; continue }
  const ids = comboIds(chunk.url)
  try {
    let source = ''
    for (const id of ids) {
      const file = bundlePath(id)
      if (file === undefined || !existsSync(file)) throw new Error(`no bundle file for ${id}`)
      source += `${prepare(readFileSync(file), id, 'client.js').source};\n`
    }
    const expected = `${source}//# sourceMappingURL=${comboSearch(ids, chunk.rev, true)}\n`
    if (body === expected) ok++
    else {
      bad++
      console.log('DIFFER batch', chunk.rev, 'len', body.length, expected.length)
      const n = Math.min(body.length, expected.length)
      for (let i = 0; i < n; i++) {
        if (body[i] !== expected[i]) {
          console.log('  first diff at', i)
          console.log('  body    ', JSON.stringify(body.slice(Math.max(0, i - 120), i + 120)))
          console.log('  expected', JSON.stringify(expected.slice(Math.max(0, i - 120), i + 120)))
          break
        }
      }
      if (body.length !== expected.length) console.log('  tail:', JSON.stringify(body.slice(-200)))
    }
  } catch (error) { console.log('ERR', error.message); skipped++ }
}
console.log(`batches ok ${ok}, bad ${bad}, skipped ${skipped}`)

const single = 'plugins/??@deepseek-ai/dsh-api-job-controller/client.js&rev=92466e818197'
const body = map.get(single)?.toString('utf8')
const expected = `${prepare(readFileSync(bundlePath('@deepseek-ai/dsh-api-job-controller')), '@deepseek-ai/dsh-api-job-controller', 'client.js').source};\n//# sourceMappingURL=${comboSearch(['@deepseek-ai/dsh-api-job-controller'], '92466e818197', true)}\n`
console.log('single equal:', body === expected, 'len', body.length, expected.length)
if (body !== expected) {
  const n = Math.min(body.length, expected.length)
  for (let i = 0; i < n; i++) {
    if (body[i] !== expected[i]) {
      console.log('  diff at', i, JSON.stringify(body.slice(Math.max(0, i - 100), i + 100)), 'VS', JSON.stringify(expected.slice(Math.max(0, i - 100), i + 100)))
      break
    }
  }
  console.log('  tail:', JSON.stringify(body.slice(-300)))
}
