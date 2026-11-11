import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params = {}) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) }) }
const shot = await send('Page.captureScreenshot', { format: 'png' })
console.log('shot:page-capture-ok', shot && shot.data ? shot.data.length : 'fail')
console.log('URL:', page.url)
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value
const html = await ev(`document.body ? document.body.innerHTML.slice(0, 500) : 'no body'`)
console.log('BODY:', html)
const errs = await ev('window.__deeprProbe || "none"')
console.log('console probe:', errs)
