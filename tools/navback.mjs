import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const t = (await get('/json')).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value }
const url = t.url
console.log('navigate to', url)
await send('Page.enable')
await send('Page.navigate', { url })
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 500))
  console.log(await ev('location.href'), '|', await ev('document.body ? document.body.innerText.slice(0,60) : null'))
}
ws.close(); process.exit(0)
