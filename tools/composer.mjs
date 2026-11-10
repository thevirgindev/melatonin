import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const page = (await get('/json')).find(t => t.url.startsWith('http://127.0.0.1'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value }
console.log(await ev(`(() => {
  const ta = document.querySelectorAll('textarea')
  const ce = document.querySelectorAll('[contenteditable="true"]')
  const ph = []
  document.querySelectorAll('[class*="placeholder"], [data-placeholder]').forEach(function(e) {
    const t = (e.textContent || '').trim() || e.getAttribute('data-placeholder')
    if (t) ph.push(t.slice(0, 60))
  })
  return JSON.stringify({
    textareas: Array.from(ta).map(t => ({ placeholder: t.placeholder, ph: t.getAttribute('placeholder'), visible: t.offsetParent !== null })),
    editables: Array.from(ce).map(t => t.getAttribute('aria-placeholder') || t.getAttribute('data-placeholder') || ''),
    placeholders: ph.slice(0, 12),
    chatbar: (document.querySelector('[class*="camCca"], [class*="composer"], [class*="chatbar"]') || {}).innerText?.slice(0, 200)
  }, null, 1)
})()`))
ws.close(); process.exit(0)
