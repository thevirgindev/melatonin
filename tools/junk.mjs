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
const vh = await ev(`({ w: innerWidth, h: innerHeight })`)
// dump elements near bottom-left corner, inside 300px x bottom 120px
const junk = await ev(`(() => {
  const out = []
  const walk = el => {
    for (const c of el.children) {
      const r = c.getBoundingClientRect()
      if (r.width > 4 && r.height > 4 && r.left < 320 && r.bottom > innerHeight - 130) {
        out.push({ tag: c.tagName, cls: (c.className + '').slice(0, 80), id: c.id, txt: (c.textContent || '').trim().slice(0, 60), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], bg: getComputedStyle(c).position })
      }
      walk(c)
    }
  }
  walk(document.body)
  return out.slice(0, 30)
})()`)
console.log(JSON.stringify({ vh, junk }, null, 1))
ws.close(); process.exit(0)
