// Responsável do guia do portal (09/11), como o cadastro do app faz. Idempotente.
// Uso: SENHA=... node criar-responsavel.mjs
const API = 'https://petjourney-api-dev.up.railway.app'
const SENHA = process.env.SENHA
const FOTO = 'https://ttfhgvbpqhoklhsucnoh.supabase.co/storage/v1/object/public/bucketFotos/uploads/usuarios/admin/new_user.jpeg'
async function chamar(c, { metodo = 'GET', corpo, token } = {}) {
  const h = { 'Accept-Language': 'pt-BR' }; if (corpo) h['Content-Type'] = 'application/json'; if (token) h.Authorization = `Bearer ${token}`
  const r = await fetch(API + c, { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined }); const t = await r.text()
  let j; try { j = JSON.parse(t) } catch { j = t } return { status: r.status, json: j, data: j?.data }
}
const CONTAS = [
  { email: 'qa-bruna@petjourney.test', nome: 'Bruna Castro', telefone: '11988887711', pets: [
    { nome: 'Fubá', especiePet: 'CACHORRO', sexo: 'MACHO', dataNascimento: '2020-06-15T12:00:00.000Z', dogInfo: { raca: 'SRD', porte: 'MEDIO', castrado: true } },
    { nome: 'Amora', especiePet: 'GATO', sexo: 'FEMEA', dataNascimento: '2023-03-02T12:00:00.000Z', catInfo: { raca: 'SRD', castrado: false } },
  ] },
]
const out = {}
for (const c of CONTAS) {
  const v = await chamar(`/usuario/verificar?email=${encodeURIComponent(c.email)}`)
  let token
  if (v.status === 409) { console.log(c.email, 'já existe'); token = (await chamar('/auth/login', { metodo: 'POST', corpo: { email: c.email, senha: SENHA } })).data?.access_token }
  else {
    const r = await chamar('/usuario', { metodo: 'POST', corpo: { email: c.email, nome: c.nome, senha: SENHA, ativo: true, telefone: c.telefone, comoNosConheceu: 'OUTRO', tutor: { foto: FOTO } } })
    console.log(c.email, 'criada', r.status, r.status >= 400 ? JSON.stringify(r.json?.message) : '')
    token = r.data?.access_token
  }
  const eu = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  const tutorId = eu.tutorId
  const ja = (await chamar(`/pet/byTutorId/${tutorId}`, { token })).data ?? []
  out[c.email] = { userId: eu.sub ?? eu.userId, tutorId, pets: {} }
  for (const p of c.pets) {
    const x = ja.find((y) => y.nome === p.nome)
    if (x) { out[c.email].pets[p.nome] = x.id; continue }
    const r = await chamar('/pet', { metodo: 'POST', token, corpo: { ...p, tutorId } })
    console.log(' pet', p.nome, r.status, r.status >= 400 ? JSON.stringify(r.json?.message) : '')
    out[c.email].pets[p.nome] = r.data?.id
  }
}
console.log(JSON.stringify(out, null, 1))
