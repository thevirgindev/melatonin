import http from 'node:http'
import fs from 'node:fs'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const page = (await get('/json')).find(t => t.url.startsWith('http://127.0.0.1'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
await send('Page.enable')
const r = await send('Page.captureScreenshot', { format: 'png' })
fs.writeFileSync(process.argv[2] || 'shot-verify.png', Buffer.from(r.result.data, 'base64'))
console.log('saved', process.argv[2] || 'shot-verify.png')
ws.close(); process.exit(0)
