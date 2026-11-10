import http from 'node:http'
import fs from 'node:fs'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http://127.0.0.1') && !t.url.includes('__dsh-welcome'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } else { console.log('ev', m.method, JSON.stringify(m.result || m).slice(0,120)) } }
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const shot = await send('Page.captureScreenshot', { format: 'png' })
console.log('shot keys', Object.keys(shot || {}))
if (shot?.data) { fs.writeFileSync('C:/Users/user/Documents/smth-new/deepr-tauri/shot-main2.png', Buffer.from(shot.data, 'base64')); console.log('saved') }
ws.close(); process.exit(0)
