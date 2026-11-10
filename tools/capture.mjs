// Capture the upstream Host's composed boot page and package map.
// Run against a live `dsh web` server: node capture.mjs <port> <token>
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const fs = require('node:fs')
const path = require('node:path')
const { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } = fs
const { dirname, join, relative } = path
const { gunzipSync } = require('node:zlib')

const port = process.argv[2] ?? '3087'
const token = process.argv[3] ?? ''
const repo = 'C:/Users/user/Documents/smth-new/_upstream/dsh'
const out = 'C:/Users/user/Documents/smth-new/deepr-tauri/boot'
mkdirSync(out, { recursive: true })

const base = `http://127.0.0.1:${port}`
const grant = await fetch(`${base}/?token=${encodeURIComponent(token)}`, { redirect: 'manual' })
const cookie = grant.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
if (grant.status !== 303 || cookie === '') throw new Error(`token exchange ${grant.status}`)
const rootRes = await fetch(`${base}/`, { headers: { cookie } })
if (!rootRes.ok) throw new Error(`index ${rootRes.status}`)
const html = await rootRes.text()
writeFileSync(join(out, 'index.html'), html)
console.log('index bytes', html.length, 'cookie', cookie.length > 0)

const match = /globalThis\["__DSH_BOOT__"\] = (.*?)<\/script>/s.exec(html)
if (match === null) throw new Error('no __DSH_BOOT__ global in served index')
const graph = JSON.parse(match[1])
writeFileSync(join(out, 'graph.json'), JSON.stringify(graph, null, 2))
const assetFiles = []
const assetBodies = new Map()
const decompress = (bytes) => {
  const path = bytes[0] === 0x78 && (bytes[0] * 256 + bytes[1]) % 31 === 0 ? 'deflate' : bytes[0] === 0x1f && bytes[1] === 0x8b ? 'gzip' : null
  try { return path === null ? bytes : gunzipSync(bytes, { finishFlush: path === 'deflate' ? 0 : 1 }) } catch { return bytes }
}
const decodeBody = async (parts, decoder) => {
  const chunks = []
  for await (const part of parts) chunks.push(part)
  return decoder ? decompress(Buffer.concat(chunks)) : Buffer.concat(chunks)
}
const assetUrl = (url) => url.startsWith('plugins/') ? new URL(url, base) : new URL(url, `${base}/`)
for (const chunk of graph.batches) assetFiles.push(chunk.url)
for (const entry of graph.entries) assetFiles.push(entry.url)
for (const url of new Set(assetFiles)) {
  const res = await fetch(assetUrl(url), { headers: { cookie } })
  if (!res.ok) continue
  const decoder = res.headers.get('content-encoding') === 'gzip' ? true : false
  const body = await decodeBody(res.body, decoder)
  assetBodies.set(url, body)
}
writeFileSync(join(out, 'bodies.json'), JSON.stringify(Object.fromEntries(
  [...assetBodies.entries()].map(([url, body]) => [url, body.toString('base64')])), null, 2))
console.log('captured bodies', assetBodies.size, 'bytes', [...assetBodies.values()].reduce((sum, body) => sum + body.length, 0))
console.log('graph rev', graph.rev, 'entries', graph.entries.length, 'batches', graph.batches.length,
  'bootstrap', graph.batches.filter(b => b.phase === 'bootstrap').length)

// name -> repo-relative package dir, for every package declaring dsh.client.
const packages = {}
const addManifest = (file) => {
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  if (manifest.name === undefined || manifest.name === '') return
  if (manifest['dsh']?.['client'] === undefined) return
  packages[manifest.name] = relative(repo, dirname(file))
}
for (const group of readdirSync(join(repo, 'packages'))) {
  const groupDir = join(repo, 'packages', group)
  if (statSync(groupDir).isDirectory() && !group.startsWith('.')) {
    for (const pkg of readdirSync(groupDir)) {
      const dir = join(groupDir, pkg)
      if (!statSync(dir).isDirectory()) continue
      const manifest = join(dir, 'package.json')
      try { addManifest(manifest) } catch {}
    }
  }
}
for (const app of readdirSync(join(repo, 'apps'))) {
  const dir = join(repo, 'apps', app)
  if (!statSync(dir).isDirectory()) continue
  try { addManifest(join(dir, 'package.json')) } catch {}
}
writeFileSync(join(out, 'packages.json'), JSON.stringify(packages, null, 2))

const missing = graph.entries.filter(e => packages[e.id] === undefined)
console.log('packages', Object.keys(packages).length, 'entries without package dir', missing.length)
for (const entry of missing) console.log('  MISSING', entry.id)
const noBundle = graph.entries.filter(e => {
  const dir = packages[e.id]
  if (dir === undefined) return true
  try { statSync(join(repo, dir, 'lib', 'client.js')); return false } catch { return true }
})
console.log('entries without lib/client.js', noBundle.length)
for (const entry of noBundle) console.log('  NOBUNDLE', entry.id)

const cliClient = (file) => {
  const c = JSON.parse(readFileSync(file, 'utf8'))?.exports?.['./client']
  if (c === undefined) return undefined
  if (typeof c === 'string') return c
  if (typeof c === 'object' && c !== null && typeof c.default === 'string') return c.default
  return undefined
}
for (const entry of graph.entries) {
  const dir = packages[entry.id]
  if (dir === undefined) continue
  const rel = cliClient(join(repo, dir, 'package.json'))
  if (rel === undefined) { console.log('  NOCLIENT', entry.id); continue }
  try { statSync(join(repo, dir, rel)) } catch { console.log('  MISSINGBUDLE', entry.id, rel) }
}
const libClient = Object.entries(packages).filter(([, dir]) => {
  try { statSync(join(repo, dir, 'lib', 'client.js')); return true } catch { return false }
})
console.log('declared packages with lib/client.js:', libClient.length)

// Re-fetch every batch and one-resource URL to confirm access.
