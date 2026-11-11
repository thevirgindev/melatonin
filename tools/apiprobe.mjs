import process from 'node:process'

const origin = new URL(process.argv[2])
const base = origin.origin
const jar = new Map()

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')
}
function absorb(res) {
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : []
  for (const line of set) {
    const [pair] = line.split(';')
    const i = pair.indexOf('=')
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
}

const boot = await fetch(origin.toString(), { redirect: 'manual' })
absorb(boot)
await boot.arrayBuffer()
console.log('exchange', boot.status, 'cookies', jar.size)
if (boot.status !== 303) {
  const page = await fetch(base + '/', { headers: { cookie: cookieHeader() } })
  absorb(page)
  console.log('index', page.status)
}

async function rpc(endpoint, args) {
  const res = await fetch(base + '/api/' + endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieHeader(), origin: base },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: endpoint, payload: { args } }),
  })
  absorb(res)
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}

const state = await rpc('account/getState', {})
console.log('getState', state.status, JSON.stringify(state.body).slice(0, 600))
