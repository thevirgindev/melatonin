import http from 'node:http'

function get(path) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: 9223, path }, r => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => res(JSON.parse(d)))
    }).on('error', rej)
  })
}

const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
}
await new Promise(r => ws.onopen = r)
function send(method, params = {}) {
  return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
}
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value

await ev(`(() => { const b = document.querySelector('button[aria-label="Open right sidebar"]'); if (b) b.click(); return !!b; })()`)
await new Promise(r => setTimeout(r, 1200))
const out = await ev(`(() => {
  const all = [...document.querySelectorAll('*')]
  const h = []
  for (const el of all) {
    const cs = getComputedStyle(el)
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      const r = el.getBoundingClientRect()
      h.push({ tag: el.tagName, cls: (el.className + '').slice(0, 50), sw: el.scrollWidth, cw: el.clientWidth, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) })
    }
  }
  return h
})()`)
console.log(JSON.stringify(out, null, 1))
ws.close()
process.exit(0)
