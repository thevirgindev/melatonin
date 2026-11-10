import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.includes('127.0.0.1'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))

// open right sidebar, verify Start chip got fish swap
await ev(`(() => { const b = document.querySelector('button[aria-label="Open right sidebar"]'); if (b) b.click(); return !!b })()`)
await sleep(1000)
const chip = await ev(`(() => {
  const chips = [...document.querySelectorAll('div,span')].filter(e => e.childElementCount === 1 && e.children[0].tagName === 'svg' && e.textContent.trim() === 'Start')
  const c = chips[0]
  if (!c) return 'no chip'
  const svg = c.children[0]
  return { fish: !!svg.dataset.deeprFish, vb: svg.getAttribute('viewBox') }
})()`)
// open settings, verify rows have no hairline
const acc = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Account menu'); if (b) b.click(); return !!b })()`)
await sleep(400)
const ok = await ev(`(() => { const s = [...document.querySelectorAll('[role=menuitem]')].find(i => i.textContent.trim().startsWith('Settings')); if (s) { s.click(); return 'ok' } return 'nope' })()`)
await sleep(1100)
const rows = await ev(`(() => {
  const heads = [...document.querySelectorAll('*')].filter(e => e.childElementCount === 0 && e.textContent.trim() === 'Settings')
  if (!heads.length) return 'no settings'
  let dlg = heads[0]
  for (let i = 0; i < 12 && dlg.parentElement; i++) { if (dlg.getBoundingClientRect().width > 500) break; dlg = dlg.parentElement }
  const all = [...dlg.querySelectorAll('*')]
  const hair = all.filter(e => { const cs = getComputedStyle(e); return (cs.borderBottomWidth === '1px' || cs.borderTopWidth === '1px') && e.getBoundingClientRect().width > 200 && !(e.className + '').includes('themeCube') })
  const floating = [...dlg.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').length
  return { w: Math.round(dlg.getBoundingClientRect().width), hairCount: hair.length, hscroll: floating }
})()`)
console.log(JSON.stringify({ chip, acc, ok, rows }, null, 1))
ws.close(); process.exit(0)
