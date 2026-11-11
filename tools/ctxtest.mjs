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
console.log('polish:', await ev(`!!document.getElementById('deepr-polish')`))
// simulate right click in the middle of the screen
const menu = await ev(`(() => {
  const before = document.body.querySelectorAll('div').length
  const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300, button: 2 })
  document.elementFromPoint(300, 300).dispatchEvent(evt)
  return { prevented: evt.defaultPrevented }
})()`)
console.log('dispatch:', JSON.stringify(menu))
const after = await ev(`(() => {
  const els = [...document.body.querySelectorAll('div')].filter(d => /Back|Forward|Reload/.test(d.textContent || '') && (d.textContent || '').length < 60)
  const m = els[els.length - 1]
  return m ? { found: true, text: m.textContent.slice(0, 80), rect: (() => { const r = m.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] })() } : { found: false }
})()`)
console.log('menu:', JSON.stringify(after))
ws.close(); process.exit(0)
