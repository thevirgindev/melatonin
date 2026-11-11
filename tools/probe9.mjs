import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
console.log('targets:', targets.map(t => t.url))
const page = targets.find(t => t.url.includes('__dsh-welcome'))
if (!page) process.exit(0)
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params = {}) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) }) }
const r1 = await send('Runtime.evaluate', { expression: `(() => { try { return { kids: document.getElementById('root').children.length, title: document.title, has: !!window.dshWelcome, keys: window.dshWelcome ? Object.keys(window.dshWelcome).length : 0 } } catch (e) { return { throw: String(e) } } })()`, returnByValue: true })
console.log(JSON.stringify(r1.result && r1.result.value))
const r2 = await send('Runtime.evaluate', { expression: `(() => { const el = document.querySelector('script[src*="welcome.js"]'); return el ? el.getAttribute('src') : null })()`, returnByValue: true })
console.log('script tag:', r2.result && r2.result.value)
const r3 = await send('Runtime.evaluate', { expression: `performance.getEntriesByType('resource').map(e => e.name + ' ' + e.responseStatus).join('\\n')`, returnByValue: true })
console.log('resources:', r3.result && r3.result.value)
// fetch welcome.js and try to detect the error by running it with a trap
const r4 = await send('Runtime.evaluate', { expression: `fetch('/__dsh-welcome/lib/welcome/welcome.js').then(r => r.status)`, returnByValue: true, awaitPromise: true })
console.log('welcome.js status:', r4.result && r4.result.value)
ws.close(); process.exit(0)
