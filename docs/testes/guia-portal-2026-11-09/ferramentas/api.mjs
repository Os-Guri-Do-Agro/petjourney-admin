// Chamada à API de dev como uma conta de QA (o lado do app no preparo do guia).
// Uso: SENHA=... node api.mjs <email> <METODO> <caminho> [corpo-json]
const API = 'https://petjourney-api-dev.up.railway.app'
const [email, metodo, caminho, corpo] = process.argv.slice(2)
const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha: process.env.SENHA }) })).json()
const token = login?.data?.access_token
if (!token) throw new Error('login falhou')
const h = { Authorization: `Bearer ${token}`, 'Accept-Language': 'pt-BR', 'Idempotency-Key': crypto.randomUUID() }
if (corpo) h['Content-Type'] = 'application/json'
const r = await fetch(API + caminho, { method: metodo, headers: h, body: corpo || undefined })
const t = await r.text()
let j; try { j = JSON.parse(t) } catch { j = t }
console.log(r.status, JSON.stringify(j?.data ?? j, null, 1).slice(0, Number(process.env.MAX ?? 3000)))
