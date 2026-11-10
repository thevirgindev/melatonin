import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const page = (await get('/json')).find(t => t.url.startsWith('http://127.0.0.1'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
const ev = async (expr, awaitPromise) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: !!awaitPromise, returnByValue: true }); return r.result?.result?.value ?? JSON.stringify(r.result?.exceptionDetails) }
console.log('winsys present:', await ev("!!document.getElementById('deepr-winsys')"))
console.log('drag present:', await ev("!!document.getElementById('deepr-dragband')"))
console.log('maximize via button:', await ev("(async () => { const W = window.__TAURI__.window.getCurrentWindow(); const btn = document.getElementById('deepr-winsys').children[1]; btn.click(); await new Promise(r=>setTimeout(r,600)); return 'max=' + await W.isMaximized() })()", true))
console.log('restore via button:', await ev("(async () => { const W = window.__TAURI__.window.getCurrentWindow(); const btn = document.getElementById('deepr-winsys').children[1]; btn.click(); await new Promise(r=>setTimeout(r,600)); return 'max=' + await W.isMaximized() })()", true))
console.log('titlebar attr:', await ev("document.documentElement.getAttribute('data-windows-titlebar') === ''"))
console.log('polish style:', await ev("!!document.getElementById('deepr-polish')"))
ws.close(); process.exit(0)
