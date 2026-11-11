import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const t = (await get('/json')).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
await send('Network.enable')
const c = await send('Network.getCookies', { urls: [t.url, 'http://127.0.0.1'] })
console.log(JSON.stringify(c.result, null, 1).slice(0, 3000))
const all = await send('Network.getAllCookies')
console.log('cookie count:', all.result?.cookies?.length)
for (const k of (all.result?.cookies || [])) console.log(k.domain, k.name, 'len=' + (k.value || '').length)
ws.close(); process.exit(0)
