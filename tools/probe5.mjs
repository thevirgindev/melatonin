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
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))

const clicked = await ev(`(() => {
  const btns = [...document.querySelectorAll('button')]
  const more = btns.find(b => b.textContent.trim() === 'More' || b.getAttribute('aria-label') === 'More')
  if (!more) return 'no More'
  more.click()
  return 'clicked'
})()`)
await sleep(500)
const openSettings = await ev(`(() => {
  const items = [...document.querySelectorAll('[role=menuitem],button,li,a')]
  const s = items.find(i => i.textContent.trim() === 'Settings')
  if (!s) { return 'no Settings item: ' + [...document.querySelectorAll('[role=menu] *')].slice(0, 20).map(e => e.textContent.trim()).filter(Boolean).slice(0, 10).join(' | ') }
  s.click()
  return 'clicked'
})()`)
await sleep(900)
const out = await ev(`(() => {
  const dlg = [...document.querySelectorAll('div,section,dialog')].find(d => d.querySelector && [...d.children].some(c => c.textContent.trim() === 'Settings') && d.getBoundingClientRect().width > 500)
  if (!dlg) return { err: 'no dialog' }
  const r = dlg.getBoundingClientRect()
  const cs = getComputedStyle(dlg)
  return {
    cls: (dlg.className + '').slice(0, 80),
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    maxw: cs.maxWidth, w: cs.width, pos: cs.position, bg: cs.backgroundColor,
    scrollW: dlg.scrollWidth, clientW: dlg.clientWidth,
    inner: [...dlg.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).map(e => ({ tag: e.tagName, cls: (e.className + '').slice(0, 60), sw: e.scrollWidth, cw: e.clientWidth, ox: getComputedStyle(e).overflowX, y: Math.round(e.getBoundingClientRect().top) })),
    sidebarBg: (() => { const c = document.querySelector('div'); return null })(),
    frame: (() => { const f = document.body.firstElementChild; return getComputedStyle(f).backgroundColor })(),
  }
})()`)
console.log(JSON.stringify({ clicked, openSettings, out }, null, 1))
ws.close(); process.exit(0)
