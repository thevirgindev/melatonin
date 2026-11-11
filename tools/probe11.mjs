import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.includes('__dsh-welcome'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params = {}) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) }) }
const f = async (u) => (await send('Runtime.evaluate', { expression: `fetch('${u}').then(r => r.status + ':' + r.headers.get('content-type')).catch(e => 'ERR ' + e)`, returnByValue: true, awaitPromise: true })).result?.value
console.log('renderer/index.html:', await f('/__dsh-welcome/renderer/index.html'))
console.log('brand-font.css:', await f('/__dsh-welcome/lib/welcome/brand-font.css'))
console.log('shell-theme.js:', await f('/__dsh-welcome/renderer/shell-theme.js'))
ws.close(); process.exit(0)
