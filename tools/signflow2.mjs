import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http://127.0.0.1') && !t.url.includes('__dsh-welcome'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
await new Promise(r => ws.onopen = r)
const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value ?? JSON.stringify(r.result?.exceptionDetails) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const OVERLAY = "!!document.querySelector('div[class*=\"_root_14mp3_6\"]')"
await send('Page.enable')
await send('Page.reload', {})
for (let i = 0; i < 120; i++) { await sleep(100); if (await ev(OVERLAY) === true) break }
console.log('overlay ready:', await ev(OVERLAY))
console.log('hook:', await ev("(() => { window.__opens = []; window.__origOpen = window.open; window.open = function(u){ window.__opens.push(String(u)); return null }; return 'ok' })()"))
console.log('click:', await ev("(() => { const o = document.querySelector('div[class*=\"_root_14mp3_6\"]'); const sign = Array.from(o.querySelectorAll('button')).find(b => /sign\\s*in/i.test(b.textContent || '')); if (!sign) return 'no signin'; sign.click(); return 'clicked' })()"))
await sleep(3000)
console.log('opens:', await ev("JSON.stringify(window.__opens)"))
console.log('dialog:', await ev("(() => { const o = document.querySelector('div[class*=\"_root_14mp3_6\"]'); return JSON.stringify({ overlay: !!o, texts: Array.from(document.querySelectorAll('[role=dialog] button')).map(b=>b.textContent.trim()), body: (o?o.innerText:'').slice(0,400) }) })()"))
ws.close(); process.exit(0)
