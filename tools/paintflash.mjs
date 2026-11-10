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
const script = `(function(){
  window.__flash = { tbAt: null, start: performance.now() };
  function watch() {
    var el = document.documentElement;
    if (!el) { requestAnimationFrame(watch); return; }
    if (el.hasAttribute('data-windows-titlebar')) { window.__flash.tbAt = performance.now(); return; }
    var mo = new MutationObserver(function(){
      if (el.hasAttribute('data-windows-titlebar')) { window.__flash.tbAt = performance.now(); mo.disconnect(); }
    });
    mo.observe(el, { attributes: true, attributeFilter: ['data-windows-titlebar'] });
    window.__flash.mo = mo;
  }
  watch();
})()`
await send('Page.enable')
await send('Page.addScriptToEvaluateOnNewDocument', { source: script })
await send('Page.reload', { ignoreCache: false })
await new Promise(r => setTimeout(r, 2500))
const out = await ev(`(() => {
  const paints = performance.getEntriesByType('paint').map(p => ({ n: p.name, t: Math.round(p.startTime) }))
  const f = window.__flash || {}
  return JSON.stringify({ paints, tbAt: f.tbAt == null ? null : Math.round(f.tbAt), hadMo: !!f.mo })
})()`)
console.log(out)
await send('Page.removeScriptToEvaluateOnNewDocument', {})
ws.close(); process.exit(0)
