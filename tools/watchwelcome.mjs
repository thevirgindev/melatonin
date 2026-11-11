import http from 'node:http'
function get(path) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9223, path, timeout: 1500 }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)) } catch { res([]) } }) }).on('error', rej) }) }
const t0 = Date.now()
let seenWelcome = false
for (let i = 0; i < 250; i++) {
  try {
    const ts = await get('/json')
    const urls = ts.filter(t => t.type === 'page').map(t => t.url)
    if (urls.length) console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', urls.join(' | '))
    const hasW = urls.some(u => u.includes('__dsh-welcome'))
    if (hasW) seenWelcome = true
    if (seenWelcome && !hasW) { console.log('WELCOME DISAPPEARED at', ((Date.now() - t0) / 1000).toFixed(1)); break }
  } catch (e) { }
  await new Promise(r => setTimeout(r, 400))
}
process.exit(0)
