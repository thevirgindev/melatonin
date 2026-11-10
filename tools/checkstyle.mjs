import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http://127.0.0.1') && !t.url.includes('__dsh-welcome'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value
const res = await ev(`(() => {
  const all = [...document.head.querySelectorAll('style')].map(s => s.textContent)
  const own = all.filter(s => s.includes('deepr') || s.includes('1100px') || s.includes('HBYDDG'))
  return own.map(s => s.slice(0, 2000))
})()`)
console.log(JSON.stringify(res, null, 1))
ws.close(); process.exit(0)
