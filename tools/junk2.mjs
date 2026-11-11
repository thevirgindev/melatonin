import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
for (const t of targets.filter(x => x.type === 'page')) console.log(t.url.slice(0, 80))
const pages = targets.filter(t => t.type === 'page' && t.url.includes('127.0.0.1'))
for (const page of pages) {
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
  await new Promise(r => ws.onopen = r)
  const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value
  const info = await ev(`({ w: innerWidth, h: innerHeight, title: document.title, ready: !!document.getElementById('root') })`)
  // anything rendering outside the app frame at left edge (junk letters)?
  const junk = await ev(`(() => {
    const out = []
    const walk = el => {
      for (const c of el.children) {
        const r = c.getBoundingClientRect()
        if (r.width > 2 && r.height > 2 && (r.left < 40) && (r.top < 0 || r.bottom > innerHeight || r.left < 0)) {
          out.push({ tag: c.tagName, cls: (c.className + '').slice(0, 70), txt: (c.textContent || '').trim().slice(0, 40), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] })
        }
        walk(c)
      }
    }
    walk(document.body)
    // also fixed/absolute elements at left edge mid area
    const fixed = [...document.querySelectorAll('*')].filter(e => { const cs = getComputedStyle(e); return (cs.position === 'fixed' || cs.position === 'absolute') && e.getBoundingClientRect().left < 40 && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0 })
    const f = fixed.slice(0, 12).map(e => ({ cls: (e.className + '').slice(0, 60), txt: (e.textContent || '').trim().slice(0, 30), pos: getComputedStyle(e).position, left: Math.round(e.getBoundingClientRect().left), top: Math.round(e.getBoundingClientRect().top), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }))
    return { off: out.slice(0, 10), fixed: f }
  })()`)
  console.log(JSON.stringify({ url: page.url.slice(0, 60), info, junk }, null, 1))
  ws.close()
}
process.exit(0)
