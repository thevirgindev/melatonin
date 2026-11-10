const s = require('fs').readFileSync('welcome/renderer/index.html', 'utf8')
const i = s.lastIndexOf('<script>', s.indexOf('Use another provider'))
const j = s.lastIndexOf('</script>')
const b = s.slice(i + 8, j)
let d = 0
for (const c of b) { if (c === '{') d++; if (c === '}') d-- }
console.log('depth', d, 'len', b.length)
try { new Function(b); console.log('parse OK') } catch (e) { console.log('PARSE ERR', e.message) }
