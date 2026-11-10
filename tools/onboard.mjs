import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http://127.0.0.1') && !t.url.includes('__dsh-welcome'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
const ev = async (expr, awaitPromise) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: !!awaitPromise, returnByValue: true }); return r.result?.result?.value ?? JSON.stringify(r.result?.exceptionDetails) }
const script = process.argv[2] || '(function(){ var o = document.querySelector(\'div[class*="_root_14mp3_6"]\'); if (!o) return \'none\'; var scope = o.querySelector(\'[role=dialog]\') || o; var btns = Array.prototype.slice.call(scope.querySelectorAll(\'button\')); var sign = btns.filter(function(b){ return /sign\\s*in/i.test(b.textContent || \'\'); })[0]; if (sign) { sign.click(); return \'signin\' } if (btns[0]) { btns[0].click(); return \'dismissed\' } return \'no x\' })()'
console.log('click result:', await ev(script))
await new Promise(r => setTimeout(r, 1500))
console.log('after:', await ev(`(() => {
  const o = document.querySelector('div[class*="_root_14mp3_6"]')
  return JSON.stringify({ overlay: !!o, url: location.href, texts: Array.from(document.querySelectorAll('[role=dialog] button')).map(b=>b.textContent.trim()) })
})()`))
ws.close(); process.exit(0)
