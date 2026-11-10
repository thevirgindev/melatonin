const http = require('http')
const expr = process.argv[2]
const filter = process.argv[3] || '127.0.0.1'
http.get({ host: '127.0.0.1', port: 9223, path: '/json' }, r => {
  let d = ''
  r.on('data', c => d += c)
  r.on('end', () => {
    const t = JSON.parse(d).find(x => x.url.includes(filter))
    if (!t) { console.log('no target'); process.exit(0) }
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }))
    ws.onmessage = m => {
      const j = JSON.parse(m.data)
      const v = j.result && j.result.result ? j.result.result : j.result
      console.log(typeof v === 'object' && v !== null && v.value ? (typeof v.value === 'object' ? JSON.stringify(v.value) : v.value) : JSON.stringify(v))
      ws.close()
    }
  })
})
