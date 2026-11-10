import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http://127.0.0.1') && !t.url.includes('__dsh-welcome'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) }) }
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result
const r = await ev(`(function() {
  try {
    var W = window.__TAURI__.window.getCurrentWindow();
    var host = document.createElement('div');
    host.id = 'deepr-winsys-test';
    return { ok: true, id: W.id }
  } catch (e) { return { err: e.message, stack: (e.stack || '').slice(0, 500) } }
})()`)
console.log(JSON.stringify(r, null, 1))
// then actually run the same builder steps without appends
const r2 = await ev(`(function() {
  try {
    var host = document.createElement('div');
    host.id = 'probe2';
    var W = window.__TAURI__.window.getCurrentWindow();
    var drag = document.createElement('div');
    drag.style.cssText = 'position:fixed;top:0;left:0;right:0;height:42px;z-index:2147483646;';
    return { ok: true }
  } catch (e) { return { err: e.message } }
})()`)
console.log(JSON.stringify(r2))
ws.close(); process.exit(0)
