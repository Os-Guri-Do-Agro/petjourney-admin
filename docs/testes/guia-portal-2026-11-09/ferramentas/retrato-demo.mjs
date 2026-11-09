// Só leitura: o que a "Clínica e Hotel Demo" (portal-demo) tem na API de dev.
// Uso: SENHA=... node retrato-demo.mjs
const API = 'https://petjourney-api-dev.up.railway.app'
const P = '1103a825-df04-4da9-89d9-4944af348bb3'
const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'portal-demo@petjourney.test', senha: process.env.SENHA }) })).json()
const token = login?.data?.access_token
if (!token) throw new Error('login falhou ' + JSON.stringify(login).slice(0, 200))
const ler = async (c) => {
  const r = await fetch(API + c + (c.includes('?') ? '&' : '?') + 'parceiroId=' + P, { headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'pt-BR' } })
  const t = await r.text()
  try { return { s: r.status, d: JSON.parse(t)?.data ?? JSON.parse(t) } } catch { return { s: r.status, d: t.slice(0, 200) } }
}
const lista = (x) => (Array.isArray(x) ? x : x?.itens ?? x?.items ?? x?.dados ?? x?.data ?? [])
const C = '/parceiro/portal/clinica'
const out = {}
const eu = await ler('/parceiro/portal/eu'); out.eu = `${eu.s} ` + JSON.stringify({ papel: eu.d?.papel, modulos: eu.d?.modulos, permissoes: (eu.d?.permissoes ?? []).length, selo: eu.d?.seloDeAssinatura ?? eu.d?.selo }).slice(0, 700)
const dash = await ler('/parceiro/portal/dashboard'); out.dashboard = `${dash.s} ` + JSON.stringify(dash.d).slice(0, 300)
const equipe = await ler('/parceiro/portal/equipe'); out.equipe = `${equipe.s} ` + JSON.stringify({ membros: (equipe.d?.membros ?? []).map((m) => `${m.nome}|${m.email}|${m.papel}|${(m.papeisOperacionais ?? []).join('+')}`), convites: (equipe.d?.convites ?? []).map((c) => c.email) })
const prof = await ler('/parceiro/portal/profissionais'); out.profissionais = `${prof.s} ` + lista(prof.d).map((p) => `${p.nome}(${p.conselho}${p.registro ? ' ' + p.registro + '/' + p.uf : ''}${p.crmvConferidoEm ? ',conferido' : ''}${p.usuarioId ? ',login' : ''}${p.ativo === false ? ',inativa' : ''})`).join(', ')
const pac = await ler('/parceiro/portal/pacientes?limit=50'); out.pacientes = `${pac.s} ` + lista(pac.d).map((p) => `${p.nome}(${p.especie ?? ''}${p.ativo === false ? ',inativo' : ''})`).join(', ')
const salas = await ler(`${C}/salas`); out.salas = `${salas.s} ` + lista(salas.d).map((s) => `${s.nome}(${s.tipo})`).join(', ')
const tipos = await ler(`${C}/tipos-de-atendimento`); out.tipos = `${tipos.s} ` + lista(tipos.d).map((t) => `${t.nome}/${t.duracaoMinutos}min${t.ofertadoOnline ? '/online' : ''}`).join(', ')
const pol = await ler(`${C}/politica`); out.politica = `${pol.s} ` + JSON.stringify(pol.d).slice(0, 500)
const online = await ler(`${C}/agendamento-online`); out.agendamentoOnline = `${online.s} ` + JSON.stringify(online.d).slice(0, 500)
const leitos = await ler(`${C}/leitos`); out.leitos = `${leitos.s} ` + lista(leitos.d).map((l) => `${l.nome}(${l.kind ?? l.tipo})`).join(', ')
const mapa = await ler(`${C}/internacao/mapa`); out.internacao = `${mapa.s} ` + JSON.stringify(mapa.d?.cabecalho ?? mapa.d).slice(0, 300)
const turno = await ler(`${C}/turnos/atual`); out.plantao = `${turno.s} ` + JSON.stringify(turno.d).slice(0, 250)
const gel = await ler(`${C}/estoque/geladeira`); out.geladeira = `${gel.s} ` + JSON.stringify(gel.d).slice(0, 500)
const ped = await ler(`${C}/pedidos?situacao=PENDENTE`); out.pedidosPendentes = `${ped.s} ` + JSON.stringify(ped.d).slice(0, 300)
const est = await ler('/parceiro/portal/estabelecimento'); out.estabelecimento = `${est.s} ` + JSON.stringify(est.d).slice(0, 600)
const pag = await ler('/parceiro/portal/estabelecimento/pagina'); out.pagina = `${pag.s} ` + JSON.stringify(pag.d).slice(0, 300)
console.log(JSON.stringify(out, null, 2))
