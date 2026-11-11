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

const out = await ev(`(() => {
  const frame = [...document.querySelectorAll('div')].find(d => d.className && (d.className + '').match(/frame/) && d.querySelectorAll('*').length > 10)
  const strip = document.querySelector('#deepr-dragband') || null
  const sidebar = [...document.querySelectorAll('div')].find(d => (d.className + '').includes('sidebarCol'))
  const center = [...document.querySelectorAll('div')].find(d => (d.className + '').includes('centerCol'))
  const bg = e => e ? getComputedStyle(e).backgroundColor : null
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;visibility:hidden'
  document.body.appendChild(probe)
  const tokens = {}
  for (const t of ['--dsw-specific-sidebar-fill', '--dsw-alias-bg-base', '--dsw-alias-label-primary']) tokens[t] = getComputedStyle(document.documentElement).getPropertyValue(t)
  probe.remove()
  return { frameBg: bg(frame), sidebarBg: bg(sidebar), centerBg: bg(center), tokens, frameCls: frame ? (frame.className + '') : null }
})()`)
console.log(JSON.stringify(out, null, 1))
ws.close(); process.exit(0)
