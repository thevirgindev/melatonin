const fs = require('fs')
const os = require('os')
for (const [n, p] of [
  ['temp', os.tmpdir() + '\\ct3.txt'],
  ['dsh', process.env.USERPROFILE + '\\.dsh\\ct3.txt'],
  ['workspace', 'C:\\Users\\user\\Documents\\smth-new\\deepr-tauri\\tools\\ct3.txt']
]) {
  try { fs.writeFileSync(p, 'x'); console.log(n, 'ok') } catch (e) { console.log(n, e.code) }
}
