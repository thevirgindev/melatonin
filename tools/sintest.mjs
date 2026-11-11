import http from 'node:http'
function get(path, port) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json', 9223)
const page = targets.find(t => t.url.includes('127.0.0.1'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
const acc = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Account menu'); if (b) b.click(); return !!b })()`)
await sleep(400)
const ok = await ev(`(() => { const s = [...document.querySelectorAll('[role=menuitem]')].find(i => i.textContent.trim().startsWith('Settings')); if (s) { s.click(); return 'ok' } return 'nope' })()`)
await sleep(1000)
const dlg = await ev(`(() => {
  const btn = [...document.querySelectorAll('button,高举')].find(e => e.childElementCount === 0 && e.textContent.trim() === 'Sign in')
  if (!btn) return 'no btn'
  btn.click(); return 'clicked Sign in'
})()`)
await sleep(900)
const url = await ev('location.href')
const text = await ev(`(() => [...document.querySelectorAll('h1,h2,p')].slice(0,6).map(e => e.textContent.trim()).filter(Boolean).join(' | '))()`)
console.log(JSON.stringify({ acc, ok, dlg, url, text }, null, 1))
ws.close(); process.exit(0)
