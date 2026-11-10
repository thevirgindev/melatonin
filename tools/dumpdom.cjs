const h = require('http')
const fs = require('fs')
const expr = process.argv[2]
h.get({ host: '127.0.0.1', port: 9223, path: '/json' }, r => {
  let d = ''
  r.on('data', c => d += c)
  r.on('end', () => {
    const t = JSON.parse(d).find(x => x.url.includes('tauri.localhost'))
    if (!t) { console.log('no welcome target'); process.exit(0) }
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }))
    ws.onmessage = m => {
      const j = JSON.parse(m.data)
      const v = j.result ? j.result.result : null
      fs.writeFileSync(process.argv[3] || 'zz.tmp', typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))
      if (v && process.argv[4]) fs.writeFileSync(process.argv[4], String(v.value))
      ws.close()
      console.log('status', j.result && j.result.status, 'exception', JSON.stringify(j.result && j.result.exceptionDetails))
    }
  })
})
