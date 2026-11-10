import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http://127.0.0.1'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
// dismiss leftover welcome if present + expand sidebar
await ev(`(() => { const t = document.querySelector('[data-sidebar-toggle]') || document.querySelector('[data-sidebar-opener]'); if (t && /open/i.test(t.getAttribute('aria-label') || '')) t.click(); return 1 })()`)
await sleep(600)
// find the mode chip (Workspace Write next to + in the composer) and open the menu
const found = await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /Workspace Write/i.test(b.textContent || '') && b.querySelector('svg'))
  if (!btn) return 'no chip'
  const r = btn.getBoundingClientRect()
  btn.click()
  return { x: Math.round(r.x), y: Math.round(r.y), text: (btn.textContent || '').trim().slice(0, 40) }
})()`)
console.log('chip:', JSON.stringify(found))
await sleep(700)
const menu = await ev(`(() => {
  const items = [...document.querySelectorAll('[role=menuitem]')]
  const read = items.map(i => { const r = i.getBoundingClientRect(); const cs = getComputedStyle(i); return { text: (i.textContent || '').trim().slice(0, 30), x: Math.round(r.x), y: Math.round(r.top), h: Math.round(r.height), color: cs.color } })
  const full = items.find(i => /Full access/i.test(i.textContent || ''))
  let colorInfo = null
  if (full) { const cs = getComputedStyle(full); colorInfo = { text: cs.color, icons: [...full.querySelectorAll('svg')].map(s => getComputedStyle(s).color) } }
  return { items: read.length, read, colorInfo }
})()`)
console.log('menu:', JSON.stringify(menu, null, 1))
// composer rect for placement check
const comp = await ev(`(() => { const el = [...document.querySelectorAll('*')].find(e => /Describe what you want to build/.test(e.textContent || '') && e.childElementCount === 0); if (!el) return null; const r = el.closest('div[class*=dock],div[class*=composer],form') || el; const rc = el.getBoundingClientRect(); return { inputY: Math.round(rc.top), inputB: Math.round(rc.bottom) } })()`)
console.log('composer:', JSON.stringify(comp))
ws.close(); process.exit(0)
