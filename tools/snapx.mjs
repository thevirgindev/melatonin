import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
console.log('targets:', targets.filter(t => t.type == 'page').map(t => t.url.slice(0, 60)))
const page = targets.find(t => t.type === 'page' && t.url.startsWith('http://127.0.0.1') && !t.url.includes('__dsh-welcome'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r && r.result ? r.result.value : 'NO-RES' }
console.log('ready:', await ev(`1+1`))
const snap = await ev(`(() => {
  const col = document.querySelector('[class*="sidebarCol"]')
  const root = document.querySelector('.HBYDDG_root')
  const cs = (e) => e ? { w: Math.round(e.getBoundingClientRect().width) } : null
  return { col: cs(col), root: cs(root) }
})()`)
console.log('snap:', JSON.stringify(snap))
ws.close(); process.exit(0)
