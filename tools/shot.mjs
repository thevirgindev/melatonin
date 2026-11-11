import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.includes('__dsh-welcome'))
if (!page) { console.log('welcome tab missing'); process.exit(0) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
let shotRes = null
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
}
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const p = new Promise(res => {
  const t = setTimeout(() => res(null), 3000)
  let done = false
  const id2 = ++id
  pending.set(id2, m => { clearTimeout(t); done = true; res(m) })
  ws.send(JSON.stringify({ id: id2, method: 'Page.captureScreenshot', params: { format: 'png' } }))
})
const m = await p
if (m && m.result && m.result.data) {
  const fs = await import('node:fs')
  fs.writeFileSync('C:/Users/user/Documents/smth-new/deepr-tauri/welcome-shot.png', Buffer.from(m.result.data, 'base64'))
  console.log('saved,', m.result.data.length)
} else {
  console.log('capture failed', JSON.stringify(m).slice(0, 200))
}
ws.close(); process.exit(0)
