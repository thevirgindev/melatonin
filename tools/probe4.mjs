import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
function send(method, params = {}) { return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) }) }
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value

const out = await ev(`(() => {
  // brand row
  const fish = document.querySelector('path[d^="M22.9168"]')
  const brandRow = fish ? fish.closest('svg').parentElement : null
  const brandRow2 = brandRow ? brandRow.parentElement : null
  // strip pseudo color
  const frame = document.querySelector('.frame') || [...document.querySelectorAll('div')].find(d => getComputedStyle(d, '::before').position === 'absolute' && d.querySelectorAll('*').length > 10)
  const before = frame ? getComputedStyle(frame, '::before') : null
  // panelIcon svgs
  const panel = [...document.querySelectorAll('[data-icon^="dsw-icon-panel"]')].map(n => { const r = n.getBoundingClientRect(); return { cls: n.className + '', top: Math.round(r.top), left: Math.round(r.left) } })
  // start chip
  const start = [...document.querySelectorAll('span,div')].find(e => e.childElementCount === 0 && e.textContent.trim() === 'Start')
  const chipSvg = start ? (start.parentElement.querySelector('svg') || start.closest('div')?.querySelector('svg')) : null
  return {
    brandHTML: brandRow2 ? brandRow2.outerHTML.slice(0, 700) : (brandRow ? brandRow.outerHTML.slice(0, 400) : null),
    stripBG: before ? before.backgroundColor : null,
    panelIcons: panel,
    startHTML: chipSvg ? chipSvg.outerHTML.slice(0, 300) : null,
    newSession: (() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('New Session')); if (!b) return null; const r = b.getBoundingClientRect(); const p = b.parentElement; const pr = p.getBoundingClientRect(); return { btnTop: Math.round(r.top), parentBottom: Math.round(pr.bottom), parentCls: p.className + '' } })(),
  }
})()`)
console.log(JSON.stringify(out, null, 1))
ws.close(); process.exit(0)
