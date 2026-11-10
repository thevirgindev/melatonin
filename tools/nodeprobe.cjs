const fs = require('fs')
const os = require('os')
const out = []
function t(label, fn) {
  try { fn(); out.push(label + ': ok') } catch (e) { out.push(label + ': ' + e.code) }
}
t('mkdir localappdata', () => fs.mkdirSync(process.env.LOCALAPPDATA + '\\Melatonyne\\probe1', { recursive: true }))
t('write dsh', () => fs.writeFileSync(process.env.USERPROFILE + '\\.dsh\\probe.txt', 'x'))
t('write temp', () => fs.writeFileSync(os.tmpdir() + '\\melprobe-tmp.txt', 'x'))
t('write workspace', () => fs.writeFileSync('C:\\Users\\user\\Documents\\smth-new\\deepr-tauri\\probe-ws.txt', 'x'))
const info = {
  out,
  cwd: process.cwd(),
  userprofile: process.env.USERPROFILE,
  localappdata: process.env.LOCALAPPDATA,
  dsh_home: process.env.DSH_HOME || null,
  pid: process.pid
}
try { fs.writeFileSync(os.tmpdir() + '\\melprobe.json', JSON.stringify(info, null, 1)) } catch (e) {}
