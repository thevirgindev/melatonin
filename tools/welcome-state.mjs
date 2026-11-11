import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.includes('__dsh-welcome'))
if (!page) { console.log('no welcome target'); process.exit(0) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value ?? JSON.stringify(r.result?.exceptionDetails) }
console.log('root text:', JSON.stringify(await ev("document.querySelector('#root') && document.querySelector('#root').innerText")))
console.log('activation:', await ev("navigator.userActivation.isActive"))
console.log('visible buttons:', await ev("JSON.stringify(Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).map(b=>b.textContent.trim()))"))
ws.close(); process.exit(0)
