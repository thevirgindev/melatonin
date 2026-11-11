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
const acc = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Account menu'); if (b) b.click(); return !!b })()`)
await new Promise(r => setTimeout(r, 400))
const ok = await ev(`(() => { const s = [...document.querySelectorAll('[role=menuitem]')].find(i => i.textContent.trim().startsWith('Settings')); if (s) { s.click(); return 'ok' } return 'nope' })()`)
await new Promise(r => setTimeout(r, 1200))
const rows = await ev(`(() => {
  const heads = [...document.querySelectorAll('h1,h2,span,b,div')].filter(e => e.childElementCount === 0 && e.textContent.trim() === 'Settings')
  if (!heads.length) return 'no settings text'
  let dlg = heads[0]
  for (let i = 0; i < 12 && dlg.parentElement; i++) { if (dlg.getBoundingClientRect().width > 500) break; dlg = dlg.parentElement }
  const all = [...dlg.querySelectorAll('*')]
  const hair = all.filter(e => { const cs = getComputedStyle(e); return (cs.borderBottomWidth === '1px' || cs.borderTopWidth === '1px') && e.getBoundingClientRect().width > 200 })
  return { cls: (dlg.className + '').slice(0, 40), w: Math.round(dlg.getBoundingClientRect().width), hair: hair.slice(0, 10).map(e => ({ tag: e.tagName, cls: (e.className + '').slice(0, 70), bb: getComputedStyle(e).borderBottomWidth, bt: getComputedStyle(e).borderTopWidth, w: Math.round(e.getBoundingClientRect().width) })) }
})()`)
console.log(JSON.stringify({ acc, ok, rows }, null, 1))
ws.close(); process.exit(0)
