import process from 'node:process'
import readline from 'node:readline'

const origin = new URL(process.argv[2])
const base = origin.origin
const jar = new Map()
const cookieHeader = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')
function absorb(res) {
  for (const line of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) {
    const pair = line.split(';')[0]
    const i = pair.indexOf('=')
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
}
async function bootstrap() {
  if (jar.size) return
  const res = await fetch(origin.toString(), { redirect: 'manual' })
  absorb(res)
  await res.arrayBuffer()
  if (res.status !== 303) throw new Error('cookie exchange failed: ' + res.status)
}
async function rpc(endpoint, args = []) {
  await bootstrap()
  const res = await fetch(base + '/api/' + endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieHeader(), origin: base },
    body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: endpoint, payload: { args } }),
  })
  absorb(res)
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  if (res.status !== 200) throw new Error('http ' + res.status + ': ' + String(text).slice(0, 200))
  if (!body || body.type !== 'server-response') throw new Error('bad envelope')
  if (body.result && body.result.ok === false) throw new Error(JSON.stringify(body.result.error ?? body.result).slice(0, 300))
  return body.result ? body.result.value : body
}
const out = (v) => process.stdout.write(JSON.stringify(v) + '\n')
const CLIENT = { version: '0.2.2-rc.1', locale: 'en', timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 }
let lastState = null
let pollTimer = null
let canceled = false

async function pushState() {
  try {
    const state = await rpc('account/getState', {})
    if (JSON.stringify(state) !== JSON.stringify(lastState)) {
      lastState = state
      out({ event: 'state', value: state })
    }
  } catch (e) {
    out({ event: 'error', message: String(e && e.message || e) })
  }
}
function startPolling() {
  if (pollTimer) return
  const tick = async () => {
    if (canceled) return
    await pushState()
    pollTimer = setTimeout(tick, 1200)
  }
  tick()
}
function stopPolling() { canceled = true; if (pollTimer) { clearTimeout(pollTimer); pollTimer = null } }

const rl = readline.createInterface({ input: process.stdin })
rl.on('line', async (line) => {
  let msg
  try { msg = JSON.parse(line) } catch { return }
  const id = msg.id
  try {
    if (msg.op === 'state') {
      const state = await rpc('account/getState', {})
      lastState = state
      out({ id, ok: true, value: state })
    } else if (msg.op === 'start') {
      let state = await rpc('account/startSignIn', { client: CLIENT, callbackOrigin: origin.origin, loginSource: 'desktop' })
      // The authorize URL appears on the next state tick, not on the start reply.
      for (let i = 0; i < 25; i++) {
        const a = state && state.attempt
        if (a && (a.authorizeUrl || a.phase === 'failed' || a.phase === 'expired')) break
        await new Promise(r => setTimeout(r, 300))
        state = await rpc('account/getState', {})
      }
      lastState = state
      out({ id, ok: true, value: state })
      // open browser via side effect? Host returns authorizeUrl; renderer opens it.
    } else if (msg.op === 'cancel') {
      const attemptId = msg.attemptId
      const state = await rpc('account/cancelSignIn', { attemptId })
      lastState = state
      out({ id, ok: true, value: state })
    } else if (msg.op === 'copyLink') {
      const s = await rpc('account/getState', {})
      out({ id, ok: true, value: s && s.attempt ? s.attempt.authorizeUrl : null })
    } else if (msg.op === 'saveKey') {
      await rpc('credentials/set', { ref: msg.ref, value: msg.value })
      out({ id, ok: true, value: true })
    } else if (msg.op === 'describeCred') {
      const v = await rpc('credentials/describe', { refs: msg.refs })
      out({ id, ok: true, value: v })
    } else if (msg.op === 'listProviders') {
      out({ id, ok: true, value: true })
    } else if (msg.op === 'stop') {
      stopPolling()
      out({ id, ok: true, value: true })
      process.exit(0)
    } else {
      out({ id, ok: false, error: 'unknown op ' + msg.op })
    }
  } catch (e) {
    out({ id, ok: false, error: String(e && e.message || e) })
  }
})
process.on('SIGTERM', () => { process.exit(0) })