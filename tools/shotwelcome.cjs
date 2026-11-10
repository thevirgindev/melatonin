const http = require('http')
const fs = require('fs')
http.get({ host: '127.0.0.1', port: 9223, path: '/json' }, r => {
  let d = ''
  r.on('data', c => d += c)
  r.on('end', () => {
    const t = JSON.parse(d).find(x => x.url.includes('tauri.localhost'))
    if (!t) { console.log('no welcome target'); process.exit(1) }
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }))
    ws.onmessage = m => {
      const j = JSON.parse(m.data)
      if (j.id === 1) {
        fs.writeFileSync(process.argv[2] || 'welcome.png', Buffer.from(j.result.data, 'base64'))
        console.log('saved', process.argv[2] || 'welcome.png')
        ws.close(); process.exit(0)
      }
    }
  })
})
