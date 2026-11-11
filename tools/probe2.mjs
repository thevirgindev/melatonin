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
const ex = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value

const out = await ex(`(() => {
  const all = [...document.querySelectorAll('*')]
  const h = []
  const v = []
  for (const el of all) {
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      h.push({ tag: el.tagName, cls: (el.className + '').slice(0, 60), sw: el.scrollWidth, cw: el.clientWidth, ch: el.clientHeight, oy: getComputedStyle(el).overflowY, ox: getComputedStyle(el).overflowX })
    }
    if (el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0 && el.clientHeight < 900 && el.clientWidth > 200) {
      v.push({ tag: el.tagName, cls: (el.className + '').slice(0, 60), sh: el.scrollHeight, ch: el.clientHeight })
    }
  }
  // find the element whose visual rect touches the bottom with a horizontal scroll look
  return { h: h.slice(0, 12), v: v.slice(0, 8) }
})()`)
console.log(JSON.stringify(out, null, 1))
ws.close()
process.exit(0)
