import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
async function attach(filter) {
  const targets = await get('/json')
  const page = targets.find(filter)
  if (!page) throw new Error('no target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0; const pending = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  await new Promise(r => ws.onopen = r)
  const send = (method, params) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value ?? JSON.stringify(r.result?.exceptionDetails) }
  return { ws, ev, send }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const w = await attach(t => t.url.includes('__dsh-welcome'))
console.log('welcome buttons:', await w.ev("JSON.stringify(Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()))"))
console.log('click sign in:', await w.ev("(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /sign in/i.test(x.textContent)); if (!b) return 'no btn'; b.click(); return 'clicked' })()"))
await sleep(1500)
const targets = await get('/json')
console.log('targets after:', targets.filter(t => t.type === 'page').map(t => t.url))
const m = await attach(t => t.url.startsWith('http://127.0.0.1') && !t.url.includes('__dsh-welcome'))
console.log('main overlay:', await m.ev("(() => { const o = document.querySelector('div[class*=\"_root_14mp3_6\"]'); return JSON.stringify({ overlay: !!o, text: o ? o.innerText.slice(0,120) : '', buttons: Array.from(document.querySelectorAll('[role=dialog] button')).map(b=>b.textContent.trim()) }) })()"))
await sleep(4000)
console.log('main overlay later:', await m.ev("(() => { const o = document.querySelector('div[class*=\"_root_14mp3_6\"]'); return JSON.stringify({ overlay: !!o, text: o ? o.innerText.slice(0,200) : '', buttons: Array.from(document.querySelectorAll('[role=dialog] button')).map(b=>b.textContent.trim()) }) })()"))
w.ws.close(); m.ws.close(); process.exit(0)
