const http = require('http')
const path = process.argv[2] || '/assets/index-BgUyXZcc.js'
const terms = process.argv.slice(3).length ? process.argv.slice(3) : ['Get started', 'stored locally']
http.get({ host: '127.0.0.1', port: 9223, path: '/json' }, r => {
  let d = ''
  r.on('data', c => d += c)
  r.on('end', () => {
    const t = JSON.parse(d).find(x => x.url.startsWith('http://127.0.0.1'))
    if (!t) { console.log('no target'); process.exit(0) }
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: `fetch('${path}',{credentials:'include'}).then(r=>r.text())`, returnByValue: true, awaitPromise: true } }))
    ws.onmessage = m => {
      const j = JSON.parse(m.data)
      const txt = typeof j.result === 'object' && j.result && j.result.result ? (j.result.result.value || j.result.result.description) : JSON.stringify(j.result)
      const out = {}
      for (const term of terms) out[term] = String(txt).indexOf(term)
      out.len = String(txt).length
      console.log(JSON.stringify(out))
      ws.close(); process.exit(0)
    }
  })
})
