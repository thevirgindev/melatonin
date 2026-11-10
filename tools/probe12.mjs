import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.includes('__dsh-welcome'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const logs = []
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + (m.params.args || []).map(a => (a.value || a.description || '')).join(' ').slice(0, 400))
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.text || '') + ' | ' + ((m.params.exceptionDetails.exception || {}).description || '').slice(0, 500) + ' @ ' + (m.params.exceptionDetails.url || '') + ':' + m.params.exceptionDetails.lineNumber)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
}
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
await send('Runtime.enable')
const t = setTimeout(() => { console.log('TIMEOUT'); console.log(logs.join('\n')); process.exit(0) }, 4000)
await send('Page.reload')
setTimeout(() => { t.unref?.(); console.log('--- LOGS ---'); console.log(logs.join('\n') || 'no console output'); console.log('kids', 'после'); const done = setTimeout(() => { ws.close(); process.exit(0) }, 0) }, 3500)
