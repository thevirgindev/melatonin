import http from 'node:http'

function get(path) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: 9223, path }, r => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => res(JSON.parse(d)))
    }).on('error', rej)
  })
}

const targets = await get('/json')
const page = targets.find(t => t.url.startsWith('http'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
}
await new Promise(r => ws.onopen = r)
function send(method, params = {}) {
  return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
}
const ex = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value

const out = await ex(`(() => {
  const se = document.scrollingElement
  const wide = []
  if (document.documentElement.scrollWidth > innerWidth) wide.push('html ' + document.documentElement.scrollWidth)
  if (document.body && document.body.scrollWidth > innerWidth) wide.push('body ' + document.body.scrollWidth)
  const syms = document.querySelectorAll('symbol').length
  const uses = document.querySelectorAll('use').length
  let useInfo = null
  const u = document.querySelector('use')
  if (u) {
    const svg = u.closest('svg')
    const r = svg ? svg.getBoundingClientRect() : null
    const ref = u.getAttribute('href')
    const sym = ref ? document.querySelector(ref) : null
    useInfo = { ref: ref, symFound: !!sym, symKids: sym ? sym.children.length : 0, w: r ? r.width : null, h: r ? r.height : null, fill: svg ? getComputedStyle(svg).fill : null, stroke: svg ? getComputedStyle(svg).stroke : null, color: svg ? getComputedStyle(svg).color : null, html: svg ? svg.outerHTML.slice(0, 200) : null }
  }
  return {
    htmlAttrs: [...document.documentElement.attributes].map(a => a.name),
    innerW: innerWidth, docW: se.scrollWidth, docH: se.scrollHeight, clientH: se.clientHeight,
    bodyStyle: document.body ? getComputedStyle(document.body).overflowX : null,
    htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
    wide: wide,
    syms, uses, useInfo,
    titlebarVar: getComputedStyle(document.documentElement).getPropertyValue('--dsh-windows-titlebar-height'),
  }
})()`)
out.useInfo && out.useInfo.html && (out.useInfo.html + '')
console.log(JSON.stringify(out, null, 1))
ws.close()
process.exit(0)
