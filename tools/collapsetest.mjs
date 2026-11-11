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
const snap = () => ev(`(() => {
  const col = document.querySelector('[class*="sidebarCol"]')
  const root = document.querySelector('.HBYDDG_root')
  const list = document.querySelector('[class*="panelList"]')
  const cs = (e) => e ? { w: Math.round(e.getBoundingClientRect().width), disp: getComputedStyle(e).display, st: (e.getAttribute('style') || '') } : null
  return { col: cs(col), root: cs(root), list: cs(list) }
})()`)
const sleep = ms => new Promise(r => setTimeout(r, ms))
// ensure fully expanded first
let st0 = await snap()
if ((st0.root || {}).w < 100) { await ev(`(() => { const t = document.querySelector('[data-sidebar-toggle]'); if (t) t.click(); return 1 })()`); await sleep(1200) }
await ev(`(() => { const t = document.querySelector('[data-sidebar-toggle]'); if (t) t.click(); return 1 })()`)
for (const ms of [50, 170, 300, 700, 1500]) {
  await sleep(ms === 50 ? 50 : ms - [50,170,300,700].filter(x => x < ms).slice(-1)[0])
  console.log(`t+${ms}ms`, JSON.stringify(await snap()))
}
ws.close(); process.exit(0)
