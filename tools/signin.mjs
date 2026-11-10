import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.includes('__dsh-welcome'))
if (!page) { console.log('welcome tab missing'); process.exit(0) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const logs = []
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + ((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text).slice(0, 300))
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
}
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const click = await send('Runtime.evaluate', { expression: `(() => { const b = document.getElementById('sign-in'); if (!b) return 'no button'; b.click(); return 'clicked' })()`, returnByValue: true })
console.log(click.result?.value)
await new Promise(r => setTimeout(r, 4500))
console.log('logs:', logs.join(' | ') || 'none')
const ev = await send('Runtime.evaluate', { expression: `(() => { const el = [...document.querySelectorAll('.actions *')].filter(e => e.hidden === false).map(e => e.id || e.className); const st = [...document.querySelectorAll('#auth-status')].map(e => e.textContent); return { visible: el.filter(x => x), st } })()`, returnByValue: true })
console.log(JSON.stringify(ev.result?.value))
ws.close(); process.exit(0)
