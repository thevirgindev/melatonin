import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http://127.0.0.1') && !t.url.includes('__dsh-welcome'))
if (!page) { console.log('no main page target'); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const ev = async expr => { try { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value ?? r.result?.value } catch { return undefined } }
const t0 = Date.now()
send('Page.enable')
send('Page.reload', { ignoreCache: false })
const rows = []
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 50))
  const s = await ev(`({ ready: document.readyState, winsys: !!document.getElementById('deepr-winsys'), tb: document.documentElement.hasAttribute('data-windows-titlebar'), polish: !!document.getElementById('deepr-polish') })`)
  rows.push({ ms: Date.now() - t0, ...(s || { err: true }) })
  if (s && s.winsys && s.tb && s.polish && s.ready === 'complete') break
}
for (const r of rows) console.log(r.ms, r.ready, 'tb=' + r.tb, 'winsys=' + r.winsys, 'polish=' + r.polish)
ws.close(); process.exit(0)
