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
  const panel = document.querySelector('.umZDoW_panel')
  if (!panel) return 'closed'
  const set = panel.querySelector('[class*="SUYdwq_setting"]')
  const sib = []
  let s = set.previousElementSibling
  while (s) { const r = s.getBoundingClientRect(); sib.push({ cls: (s.className + '').split(' ').slice(-1)[0], h: Math.round(r.height), y: Math.round(r.top) }); s = s.previousElementSibling }
  let n = set.nextElementSibling
  const n2 = []
  while (n && n2.length < 3) { const r = n.getBoundingClientRect(); n2.push({ cls: (n.className + '').split(' ').slice(-1)[0], h: Math.round(r.height), y: Math.round(r.top), gapBelow: Math.round(r.top - set.getBoundingClientRect().bottom) }); n = n.nextElementSibling }
  const setr = set.getBoundingClientRect()
  return { setY: Math.round(setr.top), setB: Math.round(setr.bottom), prevSibs: sib.slice(0, 4), next: n2, gapAbove: 'see prevSibs-bottom' }
})()`)
console.log(JSON.stringify(res, null, 1))
ws.close(); process.exit(0)
