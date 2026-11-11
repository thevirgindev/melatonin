import process from 'node:process'

const origin = new URL(process.argv[2])
const endpoint = process.argv[3]
const args = process.argv[4] ? JSON.parse(process.argv[4]) : {}
const base = origin.origin
const jar = new Map()
const cookieHeader = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')
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
async function rpc(ep, a) {
  const res = await fetch(base + '/api/' + ep, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieHeader(), origin: base },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: ep, payload: { args: a } }),
  })
  absorb(res)
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}
const out = await rpc(endpoint, args)
console.log(out.status, JSON.stringify(out.body, null, 1).slice(0, 4000))
