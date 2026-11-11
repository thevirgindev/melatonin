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
const r = await send('Runtime.evaluate', { expression: `fetch('/__dsh-welcome/renderer/index.html').then(r => r.text()).then(t => t.slice(0, 700))`, returnByValue: true, awaitPromise: true })
console.log(r.result?.value)
const r2 = await send('Runtime.evaluate', { expression: `document.head.innerHTML.slice(0, 700)`, returnByValue: true })
console.log('--- HEAD ---')
console.log(r2.result?.value)
ws.close(); process.exit(0)
