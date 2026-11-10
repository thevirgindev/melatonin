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
// settings should still be open
const res = await ev(`(() => {
  const dlg = document.querySelector('.umZDoW_panel') || [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && e.textContent.trim() === 'Settings')
  if (!dlg) return 'closed'
  const root = document.querySelector('.umZDoW_panel')
  const all = [...root.querySelectorAll('*'), root]
  const thin = all.filter(e => { const r = e.getBoundingClientRect(); return r.height > 60 && r.width > 0 && r.width <= 3 })
    .map(e => ({ tag: e.tagName, cls: (e.className + '').slice(0, 60), w: Math.round(e.getBoundingClientRect().width), x: Math.round(e.getBoundingClientRect().x), h: Math.round(e.getBoundingClientRect().height), bg: getComputedStyle(e).backgroundColor, sh: getComputedStyle(e).boxShadow.slice(0, 60) }))
  const ps = all.filter(e => { const cs = getComputedStyle(e, '::before'); const c = getComputedStyle(e, '::after'); return (cs.content !== 'none' && cs.position === 'absolute' && parseInt(cs.width) <= 3 && cs.width !== 'auto') || (c.content !== 'none' && c.position === 'absolute' && parseInt(c.width) <= 3 && c.width !== 'auto') }).map(e => ({ cls: (e.className + '').slice(0, 60), b: getComputedStyle(e, '::before').width, a: getComputedStyle(e, '::after').width }))
  // nav column separators: check children of panel divs with divide/border via outline
  const nav = root.querySelector('.umZDoW_nav')
  const navinfo = nav ? { cls: nav.className, br: getComputedStyle(nav).borderRightWidth, bg: getComputedStyle(nav).backgroundColor, kids: [...nav.children].map(k => ({ cls: (k.className + '').slice(0, 50), br: getComputedStyle(k).borderRightWidth })) } : null
  return { thin, ps, navinfo }
})()`)
console.log(JSON.stringify(res, null, 1))
ws.close(); process.exit(0)
