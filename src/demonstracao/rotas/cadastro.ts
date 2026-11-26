/**
 * Cadastro de clientes e pacientes: a lista e a ficha, as gavetas de edição (alerta, autorizado,
 * inativar, mesclar, excluir a pedido do titular, foto), o vínculo com o app e as propostas, os
 * pedidos de correção, a leitura do app (resumo, diário, peso, carteirinha), a auditoria e a
 * importação da base.
 *
 * As escritas mexem nos registros de `base/cadastro.ts` (o paciente novo entra na lista, a
 * inativação por óbito cancela os horários futuros, o mesclar leva a agenda junto) e anotam na
 * trilha de auditoria o que a dona fez.
 */
import type { PaginaImportacoesDeBaseDto, PaginaTrilhaDto } from '@/service/contrato/openapi'
import type {
  PropostaCriada,
  Vinculo,
  PedidoDeCorrecao,
  Proposta,
  CanalDoConvite,
} from '@/service/parceiro/vinculo-service'
import type {
  Alerta,
  Anonimizacao,
  Autorizado,
  Cliente,
  ClienteDaLista,
  EdicaoDoAlerta,
  EdicaoDoAutorizado,
  EdicaoDoCliente,
  EdicaoDoPaciente,
  Inativacao,
  NovoAlerta,
  NovoAutorizado,
  NovoCliente,
  NovoPaciente,
  Paciente,
  PacienteDoCliente,
  PaginaDeClientes,
  PaginaDePacientes,
} from '@/service/parceiro/pacientes-service'
import {
  ALERTAS_ATIVOS_MAX,
  MOTIVO_DA_EXCLUSAO_MAX,
  MOTIVO_DA_EXCLUSAO_MIN,
} from '@/service/parceiro/pacientes-service'
import type {
  CarteirinhaParaClinica,
  DiarioParaClinica,
  PesosParaClinica,
  ResumoDoPaciente,
  UrlDaFoto,
} from '@/service/parceiro/leitura-do-app-service'
import type {
  Importacao,
  ImportacaoCriada,
  LinhaEnviada,
  LinhasRecebidas,
  NovaImportacao,
  PaginaDeDuvidas,
  PaginaDeLinhas,
  PropostasEmLote,
  RespostaDaDuvida,
  RespostasRegistradas,
  ResumoDaImportacao,
} from '@/service/parceiro/importacao-service'

import { agendamentosDoPaciente } from '../base/agenda'
import {
  CLIENTES,
  PACIENTES,
  cliente,
  clienteDe,
  paciente,
  pacienteDto,
  pacienteResumo,
  pacientesDoCliente,
  type PacienteDaDemo,
} from '../base/cadastro'
import { PARCEIRO_NOME } from '../base/clinica'
import {
  anotar,
  cancelarPropostasDoCliente,
  codigoDeConvite,
  correcao,
  correcoes,
  criarProposta,
  encerrarVinculo,
  moverPropostas,
  proposta,
  propostasDoCliente,
  trilha,
  vinculoDe,
} from '../dados/cadastro'
import {
  DIAS_DO_DIARIO,
  carteirinhaDe,
  desdePadrao,
  diarioDe,
  fotoDoDiario,
  pesosDeCasa,
  resumoDe,
} from '../dados/cadastro-app'
import {
  confirmar,
  continuar,
  criarImportacao,
  descartar,
  desfazer,
  dtoDa,
  duvidasDa,
  importacao,
  importacoes,
  linhasDa,
  pausar,
  proporVinculos,
  receberLinhas,
  responder,
  resumoDa,
} from '../dados/cadastro-importacao'
import { agoraIso, diasEntre, hoje, instante, jaPassou, somarDias } from '../relogio'
import {
  corpoDe,
  erro,
  normalizar,
  ok,
  paginar,
  rota,
  vazio,
  type Pedido,
  type Resposta,
} from '../roteador'

const PORTAL = '/parceiro/portal'

/* --------------------------------------------------------------------------- validação */

function semAcesso() {
  return erro(403, 'OWNERSHIP_FORBIDDEN', 'Este cadastro não está disponível para a clínica.')
}

function naoEncontrado(oQue: string) {
  return erro(404, 'NAO_ENCONTRADO', `${oQue} não foi encontrado.`)
}

/** O paciente que a clínica enxerga: o de cliente excluído a pedido do titular dá 403. */
function pacienteVisivel(id: string): PacienteDaDemo | Resposta {
  const p = paciente(id)
  if (!p) return naoEncontrado('Paciente')
  if (cliente(p.clienteId)?.anonimizadoEm) return semAcesso()
  return p
}

function ehResposta(x: unknown): x is Resposta {
  return typeof x === 'object' && x !== null && 'status' in x && 'corpo' in x
}

type Leitura<T> = { valor: T } | { falha: Resposta }

function telefone(valor: string | null | undefined, campo: string): Leitura<string | null> {
  if (valor == null || !valor.trim()) return { valor: null }
  let digitos = valor.replace(/\D/g, '')
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`
  if (digitos.length < 12 || digitos.length > 13) {
    return {
      falha: erro(400, 'TELEFONE_INVALIDO', 'Telefone inválido: confira o DDD e o número.', {
        campo,
      }),
    }
  }
  return { valor: digitos }
}

function cpfConfere(digitos: string) {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false
  const nums = [...digitos].map(Number)
  const dv = (n: number) => {
    const soma = nums.slice(0, n).reduce((t, d, i) => t + d * (n + 1 - i), 0)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === nums[9] && dv(10) === nums[10]
}

function cpf(valor: string | null | undefined, clienteId: string | null): Leitura<string | null> {
  if (valor == null || !valor.trim()) return { valor: null }
  const digitos = valor.replace(/\D/g, '')
  if (!cpfConfere(digitos)) return { falha: erro(400, 'CPF_INVALIDO', 'CPF inválido.') }
  const dono = CLIENTES.find(
    (c) => c.cpf === digitos && c.id !== clienteId && c.ativo && !c.anonimizadoEm,
  )
  if (dono) {
    return {
      falha: erro(409, 'CPF_JA_CADASTRADO', `Este CPF já está no cadastro de ${dono.nome}.`, {
        clienteId: dono.id,
      }),
    }
  }
  return { valor: digitos }
}

/** Os campos do cliente que vieram, conferidos; o que não veio fica como está. */
function camposDoCliente(
  corpo: Partial<NovoCliente & EdicaoDoCliente>,
  clienteId: string | null,
): Leitura<Partial<Cliente>> {
  const saida: Partial<Cliente> = {}
  for (const campo of ['telefone', 'telefoneSecundario', 'emergenciaTelefone'] as const) {
    if (!(campo in corpo)) continue
    const lido = telefone(corpo[campo], campo)
    if ('falha' in lido) return lido
    saida[campo] = lido.valor
  }
  if ('cpf' in corpo) {
    const lido = cpf(corpo.cpf, clienteId)
    if ('falha' in lido) return lido
    saida.cpf = lido.valor
  }
  for (const campo of [
    'email',
    'logradouro',
    'numero',
    'complemento',
    'bairro',
    'cidade',
    'uf',
    'observacao',
    'codigoNaOrigem',
    'emergenciaNome',
  ] as const) {
    if (campo in corpo) saida[campo] = corpo[campo]?.trim() || null
  }
  if ('cep' in corpo) saida.cep = corpo.cep ? corpo.cep.replace(/\D/g, '') : null
  if (corpo.nome !== undefined) saida.nome = corpo.nome.trim()
  if (corpo.contatoPreferido) saida.contatoPreferido = corpo.contatoPreferido
  return { valor: saida }
}

/* ------------------------------------------------------------------------------- a lista */

function filtrar(query: URLSearchParams): PacienteDaDemo[] {
  const termo = (query.get('q') ?? '').trim()
  const especie = query.get('especie')
  const ativos = query.get('ativo') !== 'false'
  const comLetras = /\p{L}/u.test(termo)
  const digitos = termo.replace(/\D/g, '')
  const busca = normalizar(termo)

  return PACIENTES.filter((p) => {
    const c = cliente(p.clienteId)
    if (!c || c.anonimizadoEm) return false
    if (p.ativo !== ativos) return false
    if (especie && p.especie !== especie) return false
    if (!termo) return true
    if (comLetras) return normalizar(p.nome).includes(busca) || normalizar(c.nome).includes(busca)
    if (digitos.length < 3) return true
    return [c.telefone, c.telefoneSecundario, c.cpf, p.microchip].some((v) =>
      (v ?? '').includes(digitos),
    )
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/* ---------------------------------------------------------------------------- agenda */

/** Óbito e exclusão a pedido do titular cancelam os horários que ainda iam acontecer. */
function cancelarHorarios(
  pacienteId: string,
  motivo: 'OBITO' | 'EXCLUSAO_DO_TITULAR' | 'PACIENTE_INDISPONIVEL',
) {
  const em = agoraIso()
  for (const a of agendamentosDoPaciente(pacienteId)) {
    if ((a.status === 'AGENDADO' || a.status === 'CONFIRMADO') && !jaPassou(a.inicio)) {
      a.status = 'CANCELADO'
      a.canceladoEm = em
      a.canceladoPor = 'RECEPCAO'
      a.motivoCancelamento = motivo
      a.atualizadoEm = em
      a.versao += 1
    }
  }
}

/* -------------------------------------------------------------------------- os pacientes */

let sequenciaDeCadastro = 0

function registrarPacientes() {
  rota('GET', `${PORTAL}/pacientes`, ({ query }) => {
    const { itens, proximoCursor } = paginar(filtrar(query), query, 20)
    return ok<PaginaDePacientes>({ itens: itens.map((p) => pacienteResumo(p.id)), proximoCursor })
  })

  rota('POST', `${PORTAL}/pacientes`, (pedido) => {
    const corpo = corpoDe<NovoPaciente>(pedido)
    if (!corpo.nome?.trim() || !corpo.especie) {
      return erro(400, 'DADOS_INVALIDOS', 'Informe o nome e a espécie do paciente.')
    }

    let clienteId = corpo.clienteId ?? null
    if (clienteId) {
      const c = cliente(clienteId)
      if (!c || c.anonimizadoEm || !c.ativo) return naoEncontrado('Responsável')
    } else {
      const novo = corpo.cliente
      if (!novo?.nome?.trim()) {
        return erro(400, 'DADOS_INVALIDOS', 'Informe o responsável pelo paciente.')
      }
      const lido = camposDoCliente(novo, null)
      if ('falha' in lido) return lido.falha
      clienteId = `demo-cli-novo-${String(++sequenciaDeCadastro).padStart(3, '0')}`
      CLIENTES.push({
        id: clienteId,
        nome: novo.nome.trim(),
        cpf: null,
        telefone: null,
        telefoneSecundario: null,
        email: null,
        contatoPreferido: 'WHATSAPP',
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        uf: null,
        observacao: null,
        emergenciaNome: null,
        emergenciaTelefone: null,
        codigoNaOrigem: null,
        ativo: true,
        inativoMotivo: null,
        mescladoEmId: null,
        anonimizadoEm: null,
        bloqueadoAte: null,
        autorizados: [],
        criadoEm: agoraIso(),
        ...lido.valor,
      })
      anotar('ALTERAR', 'cliente-do-parceiro', clienteId, null, ['criado'])
    }

    const id = `demo-pac-novo-${String(++sequenciaDeCadastro).padStart(3, '0')}`
    PACIENTES.push({
      id,
      nome: corpo.nome.trim(),
      especie: corpo.especie,
      especieOutra: corpo.especie === 'OUTRO' ? (corpo.especieOutra?.trim() ?? null) : null,
      raca: corpo.raca?.trim() || null,
      sexo: corpo.sexo ?? null,
      nascimento: corpo.nascimento ?? null,
      nascimentoEstimado: corpo.nascimentoEstimado ?? false,
      porte: corpo.porte ?? null,
      ativo: true,
      inativoMotivo: null,
      obitoEm: null,
      temFoto: false,
      fotoUrl: null,
      codigoNaOrigem: corpo.codigoNaOrigem ?? null,
      castrado: corpo.castrado ?? null,
      pesoKg: corpo.pesoKg ?? null,
      microchip: corpo.microchip?.trim() || null,
      pelagem: corpo.pelagem?.trim() || null,
      mescladoEmId: null,
      alertas: (corpo.alertas ?? []).map((a, i) => ({
        ...a,
        id: `${id}-alerta-${i + 1}`,
        ativo: true,
      })),
      clienteId,
      noApp: false,
      criadoEm: agoraIso(),
    })
    anotar('ALTERAR', 'paciente-do-parceiro', id, id, ['criado'])
    return ok<Paciente>(pacienteDto(id), 201)
  })

  rota('GET', `${PORTAL}/pacientes/:id`, ({ params }) => {
    const p = pacienteVisivel(params.id ?? '')
    if (ehResposta(p)) return p
    anotar('LER', 'paciente-do-parceiro', p.id, p.id)
    return ok<Paciente>(pacienteDto(p.id))
  })

  rota('PATCH', `${PORTAL}/pacientes/:id`, (pedido) => {
    const p = pacienteVisivel(pedido.params.id ?? '')
    if (ehResposta(p)) return p
    const corpo = corpoDe<EdicaoDoPaciente>(pedido)
    if (corpo.nome !== undefined && !corpo.nome.trim()) {
      return erro(400, 'DADOS_INVALIDOS', 'O nome do paciente não pode ficar em branco.')
    }
    if (corpo.clienteId && corpo.clienteId !== p.clienteId) {
      const novo = cliente(corpo.clienteId)
      if (!novo || novo.anonimizadoEm) return naoEncontrado('Responsável')
    }
    const campos = Object.keys(corpo) as Array<keyof EdicaoDoPaciente>
    Object.assign(p, {
      ...corpo,
      ...(corpo.nome ? { nome: corpo.nome.trim() } : {}),
      ...(corpo.especie && corpo.especie !== 'OUTRO' ? { especieOutra: null } : {}),
    })
    anotar('ALTERAR', 'paciente-do-parceiro', p.id, p.id, campos)
    return ok<Paciente>(pacienteDto(p.id))
  })

  rota('POST', `${PORTAL}/pacientes/:id/inativar`, (pedido) => {
    const p = pacienteVisivel(pedido.params.id ?? '')
    if (ehResposta(p)) return p
    const corpo = corpoDe<Inativacao>(pedido)
    if (!corpo.motivo) return erro(400, 'DADOS_INVALIDOS', 'Escolha o motivo.')
    p.ativo = false
    p.inativoMotivo = corpo.motivo
    p.obitoEm = corpo.motivo === 'OBITO' ? (corpo.obitoEm ?? hoje()) : null
    cancelarHorarios(p.id, corpo.motivo === 'OBITO' ? 'OBITO' : 'PACIENTE_INDISPONIVEL')
    anotar('ALTERAR', 'paciente-do-parceiro', p.id, p.id, ['ativo', 'inativoMotivo'])
    return ok<Paciente>(pacienteDto(p.id))
  })

  rota('POST', `${PORTAL}/pacientes/:id/reativar`, ({ params }) => {
    const p = pacienteVisivel(params.id ?? '')
    if (ehResposta(p)) return p
    if (p.mescladoEmId) {
      return erro(409, 'PACIENTE_MESCLADO', 'Este cadastro foi juntado a outro e não volta.')
    }
    p.ativo = true
    p.inativoMotivo = null
    p.obitoEm = null
    anotar('ALTERAR', 'paciente-do-parceiro', p.id, p.id, ['ativo'])
    return ok<Paciente>(pacienteDto(p.id))
  })

  /* O da rota fica; o outro some na busca, com a agenda e os alertas passados para este. */
  rota('POST', `${PORTAL}/pacientes/:id/mesclar`, (pedido) => {
    const p = pacienteVisivel(pedido.params.id ?? '')
    if (ehResposta(p)) return p
    const outroId = corpoDe<{ comPacienteId: string }>(pedido).comPacienteId ?? ''
    const outro = pacienteVisivel(outroId)
    if (ehResposta(outro)) return outro
    if (outro.id === p.id) return erro(400, 'DADOS_INVALIDOS', 'Escolha outro cadastro.')

    const novos = outro.alertas.filter(
      (a) => a.ativo && !p.alertas.some((b) => b.tipo === a.tipo && b.detalhe === a.detalhe),
    )
    if (p.alertas.filter((a) => a.ativo).length + novos.length > ALERTAS_ATIVOS_MAX) {
      return erro(409, 'ALERTAS_NO_LIMITE', 'Os dois juntos passam de 50 alertas ativos.')
    }
    p.alertas.push(...novos.map((a) => ({ ...a, id: `${a.id}-m` })))
    p.microchip ??= outro.microchip
    p.pelagem ??= outro.pelagem
    p.nascimento ??= outro.nascimento
    p.pesoKg ??= outro.pesoKg
    for (const a of agendamentosDoPaciente(outro.id)) a.pacienteId = p.id
    outro.ativo = false
    outro.inativoMotivo = 'DUPLICADO'
    outro.mescladoEmId = p.id
    anotar('ALTERAR', 'paciente-do-parceiro', p.id, p.id, ['mesclado'])
    return ok<Paciente>(pacienteDto(p.id))
  })

  rota('POST', `${PORTAL}/pacientes/:id/foto`, (pedido) => {
    const p = pacienteVisivel(pedido.params.id ?? '')
    if (ehResposta(p)) return p
    const arquivo = pedido.corpo instanceof FormData ? pedido.corpo.get('file') : null
    if (!(arquivo instanceof Blob)) return erro(400, 'FOTO_INVALIDA', 'Mande a foto no campo file.')
    p.fotoUrl = URL.createObjectURL(arquivo)
    p.temFoto = true
    anotar('ALTERAR', 'paciente-do-parceiro', p.id, p.id, ['foto'])
    return ok<Paciente>(pacienteDto(p.id))
  })

  rota('DELETE', `${PORTAL}/pacientes/:id/foto`, ({ params }) => {
    const p = pacienteVisivel(params.id ?? '')
    if (ehResposta(p)) return p
    p.fotoUrl = null
    p.temFoto = false
    return vazio()
  })

  /* ----------------------------------------------------------------------------- alertas */

  rota('POST', `${PORTAL}/pacientes/:id/alertas`, (pedido) => {
    const p = pacienteVisivel(pedido.params.id ?? '')
    if (ehResposta(p)) return p
    const corpo = corpoDe<NovoAlerta>(pedido)
    if (!corpo.tipo || !corpo.severidade || !corpo.detalhe?.trim()) {
      return erro(400, 'DADOS_INVALIDOS', 'Informe o tipo, a gravidade e o detalhe do alerta.')
    }
    if (p.alertas.filter((a) => a.ativo).length >= ALERTAS_ATIVOS_MAX) {
      return erro(409, 'ALERTAS_NO_LIMITE', 'Este paciente já tem 50 alertas ativos.')
    }
    const alerta: Alerta = {
      id: `${p.id}-alerta-n${++sequenciaDeCadastro}`,
      tipo: corpo.tipo,
      severidade: corpo.severidade,
      detalhe: corpo.detalhe.trim(),
      ativo: true,
    }
    p.alertas.push(alerta)
    anotar('CRIAR', 'alerta-do-paciente', alerta.id, p.id, Object.keys(corpo))
    return ok<Alerta>(alerta, 201)
  })

  rota('PATCH', `${PORTAL}/pacientes/:id/alertas/:alertaId`, (pedido) => {
    const p = pacienteVisivel(pedido.params.id ?? '')
    if (ehResposta(p)) return p
    const alerta = p.alertas.find((a) => a.id === pedido.params.alertaId)
    if (!alerta) return naoEncontrado('Alerta')
    const corpo = corpoDe<EdicaoDoAlerta>(pedido)
    if (
      corpo.ativo === true &&
      !alerta.ativo &&
      p.alertas.filter((a) => a.ativo).length >= ALERTAS_ATIVOS_MAX
    ) {
      return erro(409, 'ALERTAS_NO_LIMITE', 'Este paciente já tem 50 alertas ativos.')
    }
    Object.assign(alerta, corpo, corpo.detalhe ? { detalhe: corpo.detalhe.trim() } : {})
    anotar('ALTERAR', 'alerta-do-paciente', alerta.id, p.id, Object.keys(corpo))
    return ok<Alerta>({ ...alerta })
  })
}

/* --------------------------------------------------------------------------- os clientes */

let sequenciaDeProtocolo = 40

function clienteVisivel(id: string) {
  const c = cliente(id)
  if (!c) return naoEncontrado('Responsável')
  if (c.anonimizadoEm) return semAcesso()
  return c
}

/**
 * Os telefones que a busca casa, igual (N54): com ou sem o 55 na frente. Menos de 8 dígitos não
 * busca (400 `TELEFONE_INVALIDO`).
 */
function telefonesDaBusca(texto: string): string[] | null {
  const digitos = texto.replace(/\D/g, '')
  if (digitos.length < 8) return null
  return digitos.startsWith('55') ? [digitos, digitos.slice(2)] : [digitos, `55${digitos}`]
}

function clienteDaLista(c: (typeof CLIENTES)[number]): ClienteDaLista {
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    telefoneSecundario: c.telefoneSecundario,
    email: c.email,
    contatoPreferido: c.contatoPreferido,
    codigoNaOrigem: c.codigoNaOrigem,
    ativo: c.ativo,
    inativoMotivo: c.inativoMotivo as ClienteDaLista['inativoMotivo'],
    mescladoEmId: c.mescladoEmId,
    anonimizadoEm: c.anonimizadoEm,
    pacientesAtivos: pacientesDoCliente(c.id).filter((p) => p.ativo).length,
  }
}

function registrarClientes() {
  /* N54: a lista de clientes por nome ou telefone (o principal ou o secundário), em ordem de nome. */
  rota('GET', `${PORTAL}/clientes`, ({ query }) => {
    const nome = normalizar((query.get('q') ?? '').trim())
    const telefone = (query.get('telefone') ?? '').trim()
    const ativos = query.get('ativo') !== 'false'
    const valores = telefone ? telefonesDaBusca(telefone) : []
    if (!valores) {
      return erro(
        400,
        'TELEFONE_INVALIDO',
        'Telefone inválido. Use DDD e número, ou o código do país com +.',
      )
    }
    const lista = CLIENTES.filter((c) => {
      if (Boolean(c.ativo && !c.anonimizadoEm) !== ativos) return false
      if (nome && !normalizar(c.nome).includes(nome)) return false
      if (valores.length && !valores.some((v) => v === c.telefone || v === c.telefoneSecundario)) {
        return false
      }
      return true
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    const { itens, proximoCursor } = paginar(lista, query, 30)
    return ok<PaginaDeClientes>({ itens: itens.map(clienteDaLista), proximoCursor })
  })

  /* N47: os pacientes do cliente, ativos primeiro e por nome, com o vínculo do dono atual. */
  rota('GET', `${PORTAL}/clientes/:id/pacientes`, ({ params }) => {
    const c = clienteVisivel(params.id ?? '')
    if (ehResposta(c)) return c
    const lista = pacientesDoCliente(c.id)
      .filter((p) => p.inativoMotivo !== 'DUPLICADO')
      .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 100)
    return ok<PacienteDoCliente[]>(
      lista.map((p) => ({
        ...pacienteResumo(p.id),
        vinculoAtivo: Boolean(vinculoDe(p.id)?.doDonoAtual),
      })),
    )
  })

  rota('GET', `${PORTAL}/clientes/:id`, ({ params }) => {
    const c = clienteVisivel(params.id ?? '')
    if (ehResposta(c)) return c
    return ok<Cliente>(clienteDe(c.id))
  })

  rota('PATCH', `${PORTAL}/clientes/:id`, (pedido) => {
    const c = clienteVisivel(pedido.params.id ?? '')
    if (ehResposta(c)) return c
    const corpo = corpoDe<EdicaoDoCliente>(pedido)
    if (corpo.nome !== undefined && !corpo.nome.trim()) {
      return erro(400, 'DADOS_INVALIDOS', 'O nome do responsável não pode ficar em branco.')
    }
    const lido = camposDoCliente(corpo, c.id)
    if ('falha' in lido) return lido.falha
    const mudou = (Object.keys(lido.valor) as Array<keyof Cliente>).filter(
      (k) => lido.valor[k] !== c[k],
    )
    Object.assign(c, lido.valor)
    anotar('ALTERAR', 'cliente-do-parceiro', c.id, null, mudou)
    return ok<Cliente>(clienteDe(c.id))
  })

  /* Pacientes, autorizados, propostas e o CPF vão para o que fica. */
  rota('POST', `${PORTAL}/clientes/:id/mesclar`, (pedido) => {
    const c = clienteVisivel(pedido.params.id ?? '')
    if (ehResposta(c)) return c
    const outroId = corpoDe<{ comClienteId: string }>(pedido).comClienteId ?? ''
    const outro = clienteVisivel(outroId)
    if (ehResposta(outro)) return outro
    if (outro.id === c.id) return erro(400, 'DADOS_INVALIDOS', 'Escolha outro cadastro.')

    for (const p of pacientesDoCliente(outro.id)) p.clienteId = c.id
    c.autorizados.push(...outro.autorizados)
    if (!c.cpf && outro.cpf) c.cpf = outro.cpf
    c.email ??= outro.email
    c.telefoneSecundario ??= outro.telefone
    moverPropostas(outro.id, c.id)
    outro.cpf = null
    outro.autorizados = []
    outro.ativo = false
    outro.inativoMotivo = 'DUPLICADO'
    outro.mescladoEmId = c.id
    anotar('ALTERAR', 'cliente-do-parceiro', c.id, null, ['mesclado'])
    return ok<Cliente>(clienteDe(c.id))
  })

  /* Exclusão a pedido do titular (LGPD): sai o contato; o prontuário fica bloqueado. */
  rota('POST', `${PORTAL}/clientes/:id/anonimizar`, (pedido) => {
    const c = clienteVisivel(pedido.params.id ?? '')
    if (ehResposta(c)) return c
    const motivo = (corpoDe<{ motivo: string }>(pedido).motivo ?? '').trim()
    if (motivo.length < MOTIVO_DA_EXCLUSAO_MIN || motivo.length > MOTIVO_DA_EXCLUSAO_MAX) {
      return erro(400, 'MOTIVO_INVALIDO', 'Descreva o pedido em 10 a 500 caracteres.')
    }

    const pets = pacientesDoCliente(c.id)
    const historico = pets.flatMap((p) =>
      agendamentosDoPaciente(p.id).filter((a) => a.status === 'FINALIZADO'),
    )
    const ultimo =
      historico
        .map((a) => a.inicio.slice(0, 10))
        .sort()
        .pop() ?? null
    for (const p of pets) {
      cancelarHorarios(p.id, 'EXCLUSAO_DO_TITULAR')
      p.ativo = false
      p.inativoMotivo = 'PEDIDO_DO_RESPONSAVEL'
    }
    cancelarPropostasDoCliente(c.id)

    const resultado: Anonimizacao['resultado'] = historico.length ? 'ANONIMIZADO' : 'EXCLUIDO'
    const ano = Number(hoje().slice(0, 4))
    const protocolo = `LGPD-${ano}-${String(++sequenciaDeProtocolo).padStart(5, '0')}`
    Object.assign(c, {
      nome: 'Responsável excluído',
      cpf: null,
      telefone: null,
      telefoneSecundario: null,
      email: null,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      observacao: null,
      emergenciaNome: null,
      emergenciaTelefone: null,
      autorizados: [],
      ativo: false,
      anonimizadoEm: agoraIso(),
      bloqueadoAte:
        resultado === 'ANONIMIZADO' && ultimo
          ? instante(`${Number(ultimo.slice(0, 4)) + 5}${ultimo.slice(4)}`, '23:59')
          : null,
    })
    if (resultado === 'EXCLUIDO') {
      for (const p of pets) PACIENTES.splice(PACIENTES.indexOf(p), 1)
    }
    if (resultado === 'EXCLUIDO') anotar('EXCLUIR', 'cliente-do-parceiro', c.id, null)
    else anotar('ALTERAR', 'cliente-do-parceiro', c.id, null, ['anonimizadoEm'])
    return ok<Anonimizacao>({
      resultado,
      bloqueadoAte: c.bloqueadoAte,
      protocolo,
      reservasCanceladas: [],
      comPagamento: [],
      reservasAjustadas: [],
      internacoesEncerradas: [],
      hospedagensEncerradas: [],
    })
  })

  /* ------------------------------------------------------------------------- autorizados */

  rota('POST', `${PORTAL}/clientes/:id/autorizados`, (pedido) => {
    const c = clienteVisivel(pedido.params.id ?? '')
    if (ehResposta(c)) return c
    const corpo = corpoDe<NovoAutorizado>(pedido)
    if (!corpo.nome?.trim()) return erro(400, 'DADOS_INVALIDOS', 'Informe o nome.')
    const tel = telefone(corpo.telefone, 'telefone')
    if ('falha' in tel) return tel.falha
    const autorizado: Autorizado = {
      id: `${c.id}-aut-${++sequenciaDeCadastro}`,
      nome: corpo.nome.trim(),
      telefone: tel.valor,
      documento: corpo.documento?.trim() || null,
      relacao: corpo.relacao?.trim() || null,
      ativo: true,
    }
    c.autorizados.push(autorizado)
    anotar(
      'CRIAR',
      'autorizado-do-cliente',
      autorizado.id,
      null,
      Object.keys(corpo).filter((campo) => corpo[campo as keyof NovoAutorizado]),
    )
    return ok<Autorizado>(autorizado, 201)
  })

  rota('PATCH', `${PORTAL}/clientes/:id/autorizados/:autorizadoId`, (pedido) => {
    const c = clienteVisivel(pedido.params.id ?? '')
    if (ehResposta(c)) return c
    const autorizado = c.autorizados.find((a) => a.id === pedido.params.autorizadoId)
    if (!autorizado) return naoEncontrado('Autorizado')
    const corpo = corpoDe<EdicaoDoAutorizado>(pedido)
    if ('telefone' in corpo) {
      const tel = telefone(corpo.telefone, 'telefone')
      if ('falha' in tel) return tel.falha
      autorizado.telefone = tel.valor
    }
    if (corpo.nome?.trim()) autorizado.nome = corpo.nome.trim()
    if ('documento' in corpo) autorizado.documento = corpo.documento?.trim() || null
    if ('relacao' in corpo) autorizado.relacao = corpo.relacao?.trim() || null
    anotar('ALTERAR', 'cliente-do-parceiro', c.id, null, ['autorizados'])
    return ok<Autorizado>({ ...autorizado })
  })

  rota('DELETE', `${PORTAL}/clientes/:id/autorizados/:autorizadoId`, ({ params }) => {
    const c = clienteVisivel(params.id ?? '')
    if (ehResposta(c)) return c
    const antes = c.autorizados.length
    c.autorizados = c.autorizados.filter((a) => a.id !== params.autorizadoId)
    if (c.autorizados.length === antes) return naoEncontrado('Autorizado')
    anotar('ALTERAR', 'cliente-do-parceiro', c.id, null, ['autorizados'])
    return vazio()
  })
}

/* ------------------------------------------------------------- vínculo, propostas, correções */

const CANAL: Record<CanalDoConvite, Proposta['canal']> = {
  LINK: 'PROPOSTA_LINK',
  EMAIL: 'PROPOSTA_EMAIL',
  CODIGO: 'PROPOSTA_CODIGO',
}

function dataCurta(iso: string) {
  const [, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}`
}

function registrarVinculo() {
  rota('GET', `${PORTAL}/pacientes/:id/vinculo`, ({ params }) => {
    const p = pacienteVisivel(params.id ?? '')
    if (ehResposta(p)) return p
    return ok<Vinculo | null>(vinculoDe(p.id))
  })

  rota('POST', `${PORTAL}/pacientes/:id/vinculo/encerrar`, (pedido) => {
    const p = pacienteVisivel(pedido.params.id ?? '')
    if (ehResposta(p)) return p
    if (!vinculoDe(p.id)) return erro(404, 'VINCULO_INEXISTENTE', 'Este paciente não está no app.')
    const motivo = (corpoDe<{ motivo: string }>(pedido).motivo ?? '').trim()
    if (motivo.length < 3 || motivo.length > 300) {
      return erro(400, 'MOTIVO_INVALIDO', 'Escreva o motivo em 3 a 300 caracteres.')
    }
    encerrarVinculo(p.id)
    return vazio()
  })

  rota('GET', `${PORTAL}/clientes/:id/propostas-de-vinculo`, ({ params }) => {
    const c = clienteVisivel(params.id ?? '')
    if (ehResposta(c)) return c
    return ok<Proposta[]>(propostasDoCliente(c.id))
  })

  /* O convite: link e código com a mensagem pronta, ou o e-mail que a API manda. */
  rota('POST', `${PORTAL}/clientes/:id/propostas-de-vinculo`, (pedido) => {
    const c = clienteVisivel(pedido.params.id ?? '')
    if (ehResposta(c)) return c
    const corpo = corpoDe<{ pacienteIds: string[]; canal: CanalDoConvite }>(pedido)
    const canal = corpo.canal ?? 'LINK'
    const pets = (corpo.pacienteIds ?? []).map((id) => paciente(id))
    if (!pets.length || pets.some((p) => !p || p.clienteId !== c.id || !p.ativo)) {
      return erro(400, 'PACIENTE_INVALIDO', 'Escolha pacientes ativos deste responsável.')
    }
    if (pets.some((p) => p && vinculoDe(p.id))) {
      return erro(409, 'VINCULO_JA_ATIVO', 'Um destes pacientes já está ligado ao app.')
    }
    if (canal === 'EMAIL' && !c.email) {
      return erro(400, 'CLIENTE_SEM_EMAIL', 'O cadastro deste responsável não tem e-mail.')
    }

    const ids = pets.map((p) => p?.id ?? '')
    const { proposta: nova, canceladas } = criarProposta(c.id, ids, CANAL[canal])
    if (canal === 'EMAIL') {
      return ok<PropostaCriada>(
        {
          id: nova.id,
          canal: nova.canal,
          status: nova.status,
          expiraEm: nova.expiraEm,
          codigo: null,
          link: null,
          mensagem: null,
          whatsappUrl: null,
          canceladas,
        },
        201,
      )
    }
    const codigo = codigoDeConvite(nova.id)
    const link = `https://petjourney.com.br/convite/${codigo}`
    const nomes = new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(
      pets.map((p) => p?.nome ?? ''),
    )
    const primeiro = c.nome.split(' ')[0]
    const mensagem =
      `Olá, ${primeiro}! A ${PARCEIRO_NOME} convidou você para acompanhar ${nomes} pelo app ` +
      `PetJourney: vacinas, receitas e o resumo de cada consulta no celular. Abra o link para ` +
      `aceitar: ${link} — ou, no app, digite o código ${codigo.slice(0, 4)}-${codigo.slice(4)}. ` +
      `O convite vale até ${dataCurta(nova.expiraEm)}.`
    return ok<PropostaCriada>(
      {
        id: nova.id,
        canal: nova.canal,
        status: nova.status,
        expiraEm: nova.expiraEm,
        codigo,
        link,
        mensagem,
        whatsappUrl: c.telefone
          ? `https://wa.me/${c.telefone}?text=${encodeURIComponent(mensagem)}`
          : null,
        canceladas,
      },
      201,
    )
  })

  rota('DELETE', `${PORTAL}/propostas-de-vinculo/:id`, ({ params }) => {
    const p = proposta(params.id ?? '')
    if (!p) return naoEncontrado('Proposta')
    if (p.status !== 'PENDENTE') {
      return erro(409, 'PROPOSTA_NAO_PENDENTE', 'Só a proposta não respondida se cancela.')
    }
    p.status = 'CANCELADA'
    return vazio()
  })

  rota('GET', `${PORTAL}/pedidos-de-correcao`, ({ query }) =>
    ok<PedidoDeCorrecao[]>(correcoes(query.get('resolvidos') === 'true')),
  )

  rota('POST', `${PORTAL}/pedidos-de-correcao/:id/resolver`, ({ params }) => {
    const pedido = correcao(params.id ?? '')
    if (!pedido) return naoEncontrado('Pedido de correção')
    pedido.resolvidoEm ??= agoraIso()
    return vazio()
  })
}

/* ------------------------------------------------------------------- a leitura do app */

/** As recusas são as mesmas nas cinco rotas: sem vínculo ativo, ou sem a chave liberada. */
function leitura(pedido: Pedido): { p: PacienteDaDemo; vinculo: Vinculo } | Resposta {
  const p = pacienteVisivel(pedido.params.id ?? '')
  if (ehResposta(p)) return p
  const vinculo = vinculoDe(p.id)
  if (!vinculo) {
    return erro(403, 'PET_SEM_ACESSO', 'Este paciente não está ligado a um pet do app.')
  }
  return { p, vinculo }
}

function semConsentimento(chave: 'diarioCompleto' | 'peso') {
  return erro(403, 'SEM_CONSENTIMENTO', 'O responsável não liberou esta leitura.', { chave })
}

/** `desde` até 90 dias para trás; sem ele, desde o último atendimento (ou 30 dias). */
function desdeDo(pedido: Pedido, pacienteId: string): string | Resposta {
  const desde = pedido.query.get('desde')
  if (!desde) return desdePadrao(pacienteId)
  const minimo = somarDias(hoje(), -DIAS_DO_DIARIO)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || desde < minimo || diasEntre(hoje(), desde) > 0) {
    return erro(400, 'LEITURA_APP_PERIODO_INVALIDO', 'Escolha uma data dos últimos 90 dias.', {
      minimo,
      maximo: hoje(),
    })
  }
  return desde
}

function registrarLeituraDoApp() {
  rota('GET', `${PORTAL}/pacientes/:id/resumo`, (pedido) => {
    const lido = leitura(pedido)
    if (ehResposta(lido)) return lido
    const { p, vinculo } = lido
    anotar('LER_DADO_DO_APP', 'diario-do-app', p.id, p.id)
    return ok<ResumoDoPaciente>(
      resumoDe(p.id, {
        diario: vinculo.consentimento.diarioCompleto,
        peso: vinculo.consentimento.peso,
      }),
    )
  })

  rota('GET', `${PORTAL}/pacientes/:id/app/diario`, (pedido) => {
    const lido = leitura(pedido)
    if (ehResposta(lido)) return lido
    if (!lido.vinculo.consentimento.diarioCompleto) return semConsentimento('diarioCompleto')
    const desde = desdeDo(pedido, lido.p.id)
    if (ehResposta(desde)) return desde
    anotar('LER_DADO_DO_APP', 'diario-do-app', lido.p.id, lido.p.id)
    return ok<DiarioParaClinica>(diarioDe(lido.p.id, desde))
  })

  rota('GET', `${PORTAL}/pacientes/:id/app/pesos`, (pedido) => {
    const lido = leitura(pedido)
    if (ehResposta(lido)) return lido
    if (!lido.vinculo.consentimento.peso) return semConsentimento('peso')
    const desde = desdeDo(pedido, lido.p.id)
    if (ehResposta(desde)) return desde
    return ok<PesosParaClinica>(pesosDeCasa(lido.p.id, desde))
  })

  rota('GET', `${PORTAL}/pacientes/:id/app/carteirinha`, (pedido) => {
    const lido = leitura(pedido)
    if (ehResposta(lido)) return lido
    return ok<CarteirinhaParaClinica>(carteirinhaDe(lido.p.id))
  })

  rota('GET', `${PORTAL}/pacientes/:id/app/fotos/:fotoId/url`, (pedido) => {
    const lido = leitura(pedido)
    if (ehResposta(lido)) return lido
    const foto = fotoDoDiario(lido.p.id, pedido.params.fotoId ?? '')
    if (!foto) return naoEncontrado('Foto')
    return ok<UrlDaFoto>(foto)
  })
}

/* ---------------------------------------------------------------------------- auditoria */

function paginaDaTrilha(query: URLSearchParams, pacienteId: string | null): PaginaTrilhaDto {
  const usuarioId = query.get('usuarioId')
  const profissionalId = query.get('profissionalId')
  const acao = query.get('acao')
  const paciente = pacienteId ?? query.get('pacienteId')
  const de = query.get('de') ? Date.parse(query.get('de') as string) : null
  const ate = query.get('ate') ? Date.parse(query.get('ate') as string) : null

  const eventos = trilha().filter((e) => {
    const em = Date.parse(e.em)
    return (
      (!usuarioId || e.usuario?.id === usuarioId) &&
      (!profissionalId || e.profissional?.id === profissionalId) &&
      (!acao || e.acao === acao) &&
      (!paciente || e.pacienteId === paciente) &&
      (de === null || em >= de) &&
      (ate === null || em <= ate)
    )
  })
  const { itens, proximoCursor } = paginar(eventos, query, 50)
  return { eventos: itens, proximoCursor }
}

function registrarAuditoria() {
  rota('GET', `${PORTAL}/auditoria`, ({ query }) =>
    ok<PaginaTrilhaDto>(paginaDaTrilha(query, null)),
  )

  rota('GET', `${PORTAL}/pacientes/:id/auditoria`, ({ params, query }) => {
    const p = pacienteVisivel(params.id ?? '')
    if (ehResposta(p)) return p
    return ok<PaginaTrilhaDto>(paginaDaTrilha(query, p.id))
  })
}

/* -------------------------------------------------------------------------- importação */

function daImportacao(id: string) {
  return importacao(id) ?? naoEncontrado('Importação')
}

function naoPode(acao: string) {
  return erro(409, 'IMPORTACAO_STATUS_INVALIDO', `Não dá para ${acao} esta importação agora.`)
}

function registrarImportacao() {
  const IMPORTACOES = `${PORTAL}/importacoes`

  rota('GET', IMPORTACOES, ({ query }) => {
    const limite = Math.min(Number(query.get('limite')) || 10, 50)
    const umAno = somarDias(hoje(), -365)
    const lista = importacoes().filter((i) => i.dto.criadaEm.slice(0, 10) >= umAno)
    const inicio = Number(query.get('cursor') ?? 0) || 0
    const itens = lista.slice(inicio, inicio + limite).map(dtoDa)
    const fim = inicio + limite
    return ok<PaginaImportacoesDeBaseDto>({
      itens,
      proximoCursor: fim < lista.length ? String(fim) : null,
    })
  })

  rota('POST', IMPORTACOES, (pedido) => {
    const corpo = corpoDe<NovaImportacao>(pedido)
    if (!corpo.arquivoNome || !corpo.hashArquivo || !corpo.totalLinhas) {
      return erro(400, 'DADOS_INVALIDOS', 'Faltam o arquivo e o total de linhas.')
    }
    if (corpo.totalLinhas > 10_000) {
      return erro(400, 'IMPORTACAO_GRANDE_DEMAIS', 'O arquivo passa de 10.000 linhas.')
    }
    return ok<ImportacaoCriada>(criarImportacao(corpo as NovaImportacao), 201)
  })

  rota('GET', `${IMPORTACOES}/:id`, ({ params }) => {
    const imp = daImportacao(params.id ?? '')
    if (ehResposta(imp)) return imp
    return ok<Importacao>(dtoDa(imp))
  })

  rota('POST', `${IMPORTACOES}/:id/linhas`, (pedido) => {
    const imp = daImportacao(pedido.params.id ?? '')
    if (ehResposta(imp)) return imp
    if (imp.dto.status !== 'RECEBENDO_LINHAS') return naoPode('mandar linhas para')
    const linhas = corpoDe<{ linhas: LinhaEnviada[] }>(pedido).linhas ?? []
    if (linhas.length > 500) return erro(400, 'LOTE_GRANDE_DEMAIS', 'Mande até 500 linhas por vez.')
    return ok<LinhasRecebidas>(receberLinhas(imp, linhas))
  })

  rota('GET', `${IMPORTACOES}/:id/linhas`, ({ params, query }) => {
    const imp = daImportacao(params.id ?? '')
    if (ehResposta(imp)) return imp
    const destino = query.get('destino')
    const motivo = query.get('motivo')
    const desfecho = query.get('desfecho')
    const cursor = Number(query.get('cursor') ?? 0) || 0
    const limite = Math.min(Number(query.get('limite')) || 100, 100)
    const lista = linhasDa(imp).filter(
      (l) =>
        l.numeroLinha > cursor &&
        (!destino || l.destino === destino) &&
        (!motivo || (l.motivos as string[]).includes(motivo)) &&
        (!desfecho || l.desfecho === desfecho),
    )
    const itens = lista.slice(0, limite)
    return ok<PaginaDeLinhas>({
      itens,
      proximoCursor: lista.length > limite ? (itens[itens.length - 1]?.numeroLinha ?? null) : null,
    })
  })

  rota('GET', `${IMPORTACOES}/:id/duvidas`, ({ params, query }) => {
    const imp = daImportacao(params.id ?? '')
    if (ehResposta(imp)) return imp
    const todas = duvidasDa(imp)
    const lista = query.get('pendentes') === 'true' ? todas.filter((d) => !d.resposta) : todas
    const limite = Math.min(Number(query.get('limite')) || 20, 50)
    const inicio = Number(query.get('cursor') ?? 0) || 0
    const fim = inicio + limite
    return ok<PaginaDeDuvidas>({
      itens: lista.slice(inicio, fim),
      proximoCursor: fim < lista.length ? String(fim) : null,
      abertas: todas.filter((d) => !d.resposta).length,
      total: todas.length,
    })
  })

  rota('POST', `${IMPORTACOES}/:id/respostas`, (pedido) => {
    const imp = daImportacao(pedido.params.id ?? '')
    if (ehResposta(imp)) return imp
    if (imp.dto.status !== 'COM_DUVIDAS' && imp.dto.status !== 'PRONTA') return naoPode('responder')
    const respostas = corpoDe<{ respostas: RespostaDaDuvida[] }>(pedido).respostas ?? []
    const resultado = responder(imp, respostas)
    if ('erro' in resultado) {
      return erro(404, 'IMPORTACAO_DUVIDA_INEXISTENTE', 'Esta pergunta não existe mais.')
    }
    return ok<RespostasRegistradas>(resultado)
  })

  rota('GET', `${IMPORTACOES}/:id/resumo`, ({ params }) => {
    const imp = daImportacao(params.id ?? '')
    if (ehResposta(imp)) return imp
    return ok<ResumoDaImportacao>(resumoDa(imp))
  })

  rota('POST', `${IMPORTACOES}/:id/confirmar`, ({ params }) => {
    const imp = daImportacao(params.id ?? '')
    if (ehResposta(imp)) return imp
    if (imp.dto.status !== 'PRONTA' && imp.dto.status !== 'COM_DUVIDAS') return naoPode('importar')
    if (!confirmar(imp)) {
      return erro(409, 'IMPORTACAO_COM_DUVIDAS', 'Apareceu uma dúvida nova: responda antes.')
    }
    return ok<Importacao>(dtoDa(imp))
  })

  const acoes: Array<
    [string, string, (imp: NonNullable<ReturnType<typeof importacao>>) => unknown]
  > = [
    ['pausar', 'pausar', pausar],
    ['continuar', 'continuar', continuar],
    ['descartar', 'descartar', descartar],
    ['desfazer', 'desfazer', desfazer],
  ]
  for (const [caminho, verbo, fazer] of acoes) {
    rota('POST', `${IMPORTACOES}/:id/${caminho}`, ({ params }) => {
      const imp = daImportacao(params.id ?? '')
      if (ehResposta(imp)) return imp
      if (!fazer(imp)) return naoPode(verbo)
      return ok<Importacao>(dtoDa(imp))
    })
  }

  rota('POST', `${IMPORTACOES}/:id/propor-vinculos`, ({ params }) => {
    const imp = daImportacao(params.id ?? '')
    if (ehResposta(imp)) return imp
    if (imp.dto.status !== 'CONCLUIDA') return naoPode('propor vínculo com')
    return ok<PropostasEmLote>(proporVinculos(imp))
  })
}

/* ------------------------------------------------------------------------------- tudo */

export function registrarCadastro() {
  registrarPacientes()
  registrarClientes()
  registrarVinculo()
  registrarLeituraDoApp()
  registrarAuditoria()
  registrarImportacao()
}
