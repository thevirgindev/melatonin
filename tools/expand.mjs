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
const st = await ev(`({ collapsed: document.documentElement.hasAttribute('data-sidebar-collapsed') || !!document.querySelector('[data-sidebar-collapsed=true]'), toggles: [...document.querySelectorAll('button')].filter(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('sidebar') || b.hasAttribute('data-sidebar-toggle') || b.hasAttribute('data-sidebar-opener')).map(b => ({ a: b.getAttribute('aria-label'), attrs: [...b.attributes].map(x => x.name).filter(n => n.startsWith('data-')).join(',') })) })`)
console.log(JSON.stringify(st, null, 1))
const res = await ev(`(() => {
  const t = document.querySelector('[data-sidebar-toggle]') || document.querySelector('[data-sidebar-opener]')
  if (t) { t.click(); return 'clicked ' + (t.getAttribute('aria-label') || '') }
  return 'none'
})()`)
console.log(res)
await new Promise(r => setTimeout(r, 600))
const st2 = await ev(`({ collapsed: !!document.querySelector('[data-sidebar-collapsed=true]'), brand: !!document.querySelector('.HBYDDG_brand'), sidebarW: Math.round((document.querySelector('.HBYDDG_root') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width) })`)
console.log(JSON.stringify(st2))
ws.close(); process.exit(0)
