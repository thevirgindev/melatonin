import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http://127.0.0.1') && !t.url.includes('__dsh-welcome'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value }
const out = await ev(`(() => {
  const root = document.querySelector('div[class*="_root_14mp3_6"]')
  const btns = Array.from(document.querySelectorAll('button')).map(b => ({ t: (b.textContent||'').trim().slice(0,40), cls: (b.className||'').slice(0,40) }))
  return JSON.stringify({ root: !!root, rootHtml: root ? root.outerHTML.slice(0, 1200) : null, buttons: btns.slice(0, 20) }, null, 1)
})()`)
console.log(out)
ws.close(); process.exit(0)
