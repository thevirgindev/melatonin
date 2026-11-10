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
const res = await ev(`(() => {
  const out = []
  const walk = (el, depth) => {
    if (depth > 4) return
    for (const c of el.children) {
      const r = c.getBoundingClientRect()
      const cs = getComputedStyle(c)
      out.push(' '.repeat(depth) + c.tagName + '.' + (c.className + '').split(' ').slice(-1)[0] + ' [' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + '] pos=' + cs.position + cs.top ? '' : '')
      if (c.className.includes('toggle') || depth < 4) walk(c, depth + 1)
    }
  }
  const logo = document.querySelector('[class*="logoRow"]')
  const dump = (el, depth) => {
    if (!el || depth > 5) return
    for (const c of el.children) {
      const r = c.getBoundingClientRect(); const cs = getComputedStyle(c)
      out.push(('  '.repeat(depth)) + c.tagName + ' cls=' + (c.className + '').slice(0, 40) + ' [' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + '] pos=' + cs.position + ' t=' + cs.top + ' l=' + cs.left + ' disp=' + cs.display)
      dump(c, depth + 1)
    }
  }
  dump(logo, 0)
  return out
})()`)
console.log(res.join('\n'))
ws.close(); process.exit(0)
