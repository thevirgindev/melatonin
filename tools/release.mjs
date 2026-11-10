// Build latest.json for the GitHub Releases updater from the bundled
// NSIS installer + its signature. Usage: node tools/release.mjs <tag>
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const conf = JSON.parse(fs.readFileSync(path.join(root, 'tauri.conf.json'), 'utf8'))
const version = conf.version
const tag = process.argv[2] || 'v' + version
const bundleDir = path.join(root, 'target', 'release', 'bundle', 'nsis')
if (!fs.existsSync(bundleDir)) {
  console.error('no bundle dir:', bundleDir)
  process.exit(1)
}
const files = fs.readdirSync(bundleDir)
const installer = files.find(f => f.endsWith('-setup.exe') && f.includes(version))
const sig = installer && files.find(f => f === installer + '.sig')
if (!installer || !sig) {
  console.error('missing installer or signature for version', version, 'in', bundleDir)
  process.exit(1)
}
const repo = 'thevirgindev/melatonyne'
const latest = {
  version,
  notes: process.argv[3] || 'Melatonyne ' + version,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: fs.readFileSync(path.join(bundleDir, sig), 'utf8').trim(),
      url: `https://github.com/${repo}/releases/download/${tag}/${installer}`
    }
  }
}
const out = path.join(root, 'target', 'release', 'bundle', 'latest.json')
fs.writeFileSync(out, JSON.stringify(latest, null, 2))
console.log(out)
console.log(installer)
