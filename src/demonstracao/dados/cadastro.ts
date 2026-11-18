/**
 * Dados do cadastro da demonstração: o que mora em volta de `base/cadastro.ts` (clientes e pacientes)
 * e é desta área — o vínculo com o app, as propostas, os pedidos de correção e a trilha de auditoria.
 * A leitura do app mora em `cadastro-app.ts`; a importação da base, em `cadastro-importacao.ts`.
 *
 * Ao carregar, o cadastro da base ganha o que uma clínica de verdade tem e a base deixou em branco:
 * CPF da maioria, segundo telefone, contato de emergência e uma observação aqui e ali.
 *
 * Exporta, para as agregadoras:
 * - as pendências da área: `correcoesAbertas()` (pedidos de correção esperando a recepção, na
 *   tela `/clinica/correcoes`) e `importacoesParadas()` (importação pausada ou parada no meio, a
 *   `importacoesPausadas` que a lista de pacientes lê; mora em `cadastro-importacao.ts` e sai
 *   daqui também);
 * - `vinculoDe(pacienteId)` (o paciente está ligado ao app, desde quando e por onde),
 *   `propostasDoCliente(clienteId)` e `propostasPendentes()`; `ligarAoApp(paciente, origem)` faz o
 *   vínculo nascer, para a área que simular o aceite do responsável;
 * - `eventosDoPaciente(pacienteId)`: a trilha de auditoria de um paciente (quem abriu, alterou,
 *   publicou), do mais novo para o mais antigo — serve à linha do tempo;
 * - `trilha()`: a trilha inteira, e `anotar(...)`, que as escritas desta área usam para a trilha
 *   acompanhar o que se faz na apresentação.
 */
import type { EventoDaTrilha } from '@/service/parceiro/auditoria-service'
import type { PedidoDeCorrecao, Proposta, Vinculo } from '@/service/parceiro/vinculo-service'

import { criarSorteio } from '../aleatorio'
import { AGENDAMENTOS } from '../base/agenda'
import {
  CLIENTES,
  PACIENTES,
  cliente,
  paciente,
  pacientesDoCliente,
  type PacienteDaDemo,
} from '../base/cadastro'
import { EQUIPE, PROFISSIONAIS, USUARIO_ID, pessoaDaEquipe } from '../base/clinica'
import { agora, agoraIso, hoje, instante, jaPassou, somarDias, somarMinutos } from '../relogio'

/* ----------------------------------------------------------------- o cadastro mais completo */

const OBSERVACOES = [
  'Prefere contato pelo WhatsApp depois das 18h.',
  'Portaria do prédio: avisar que é da clínica para liberar a entrada.',
  'Paga sempre no Pix. Pede recibo com o CPF.',
  'Trabalha em turnos: confirmar consulta na véspera, de manhã.',
  'Durante a semana, os animais ficam com a avó.',
  'Fala melhor por mensagem; não costuma atender ligação.',
  'Chegou por indicação da família Rocha.',
]

const PARENTES = ['Sônia', 'Roberto', 'Helena', 'Marcos', 'Teresa', 'Paulo', 'Lúcia', 'Jorge']

function digitoDoCpf(numeros: number[]) {
  const soma = numeros.reduce((total, n, i) => total + n * (numeros.length + 1 - i), 0)
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

function cpfValido(sorte: ReturnType<typeof criarSorteio>) {
  const base = Array.from({ length: 9 }, () => sorte.inteiro(0, 9))
  if (base.every((n) => n === base[0])) base[8] = ((base[8] ?? 0) + 1) % 10
  const d1 = digitoDoCpf(base)
  const d2 = digitoDoCpf([...base, d1])
  return [...base, d1, d2].join('')
}

function celular(sorte: ReturnType<typeof criarSorteio>) {
  return `55119${sorte.inteiro(6000, 9999)}${String(sorte.inteiro(0, 9999)).padStart(4, '0')}`
}

function enriquecer() {
  const sorte = criarSorteio('cadastro:enriquecer')

  CLIENTES.forEach((c, i) => {
    const sobrenome = c.nome.split(' ').slice(-1)[0] ?? ''
    if (!c.cpf && sorte.chance(0.72)) c.cpf = cpfValido(sorte)
    if (!c.telefoneSecundario && sorte.chance(0.2)) c.telefoneSecundario = celular(sorte)
    if (!c.emergenciaNome && sorte.chance(0.3)) {
      c.emergenciaNome = `${sorte.escolher(PARENTES)} ${sobrenome}`
      c.emergenciaTelefone = celular(sorte)
    }
    if (!c.observacao && i % 6 === 2) {
      c.observacao = OBSERVACOES[Math.floor(i / 6) % OBSERVACOES.length] ?? null
    }
  })
}

enriquecer()

/* ------------------------------------------------------------------------------ o vínculo */

type VinculoDaDemo = Vinculo & { pacienteId: string }

const ORIGENS: ReadonlyArray<readonly [Vinculo['origem'], number]> = [
  ['PROPOSTA_LINK', 40],
  ['PEDIDO_APP', 20],
  ['QR_CARTEIRINHA', 18],
  ['PROPOSTA_EMAIL', 12],
  ['PROPOSTA_CODIGO', 10],
]

/** Os pets das histórias da leitura do app: liberaram tudo, para o resumo sair cheio. */
const LIBERAM_TUDO = new Set([
  'demo-pac-001',
  'demo-pac-001-2',
  'demo-pac-003',
  'demo-pac-004',
  'demo-pac-006',
  'demo-pac-007',
  'demo-pac-007-2',
  'demo-pac-008',
  'demo-pac-009',
  'demo-pac-010',
])

const VINCULOS = new Map<string, VinculoDaDemo>()

function montarVinculos() {
  const sorte = criarSorteio('cadastro:vinculos')

  for (const p of PACIENTES) {
    if (!p.noApp || !p.ativo || !cliente(p.clienteId)) continue
    /* O mesmo responsável ligou todos os pets dele no mesmo dia, pela mesma via. */
    const irmao = [...VINCULOS.values()].find(
      (v) => paciente(v.pacienteId)?.clienteId === p.clienteId,
    )
    const dias = sorte.inteiro(12, 220)
    const hora = `${sorte.inteiro(8, 20)}:${sorte.escolher(['05', '22', '41', '57'])}`
    const tudo = LIBERAM_TUDO.has(p.id)
    VINCULOS.set(p.id, {
      id: `demo-vinc-${p.id.slice('demo-pac-'.length)}`,
      pacienteId: p.id,
      origem: irmao?.origem ?? sorte.pesado(ORIGENS),
      ativadoEm: irmao?.ativadoEm ?? instante(somarDias(hoje(), -dias), hora),
      consentimento: {
        diarioCompleto: tudo || sorte.chance(0.82),
        peso: tudo || sorte.chance(0.88),
        notas: tudo || sorte.chance(0.7),
      },
    })
  }
}

montarVinculos()

export function vinculoDe(pacienteId: string): Vinculo | null {
  const v = VINCULOS.get(pacienteId)
  if (!v) return null
  const { pacienteId: _id, ...dto } = v
  return dto
}

export function encerrarVinculo(pacienteId: string) {
  VINCULOS.delete(pacienteId)
  const p = paciente(pacienteId)
  if (p) p.noApp = false
}

/** O vínculo que nasce quando o responsável aceita (a demonstração não aceita sozinha). */
export function ligarAoApp(p: PacienteDaDemo, origem: Vinculo['origem']) {
  VINCULOS.set(p.id, {
    id: `demo-vinc-${p.id.slice('demo-pac-'.length)}`,
    pacienteId: p.id,
    origem,
    ativadoEm: agoraIso(),
    consentimento: { diarioCompleto: true, peso: true, notas: true },
  })
  p.noApp = true
}

/* ----------------------------------------------------------------------------- propostas */

type PropostaDaDemo = Proposta & { clienteId: string }

const PROPOSTAS: PropostaDaDemo[] = []

const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
let sequenciaDeProposta = 0

export function codigoDeConvite(semente: string) {
  const sorte = criarSorteio(`convite:${semente}`)
  return Array.from({ length: 8 }, () => sorte.escolher([...LETRAS])).join('')
}

function petsDa(ids: string[], acao: Proposta['pets'][number]['acao']) {
  return ids.map((id) => ({ pacienteId: id, pacienteNome: paciente(id)?.nome ?? '', acao }))
}

function montarPropostas() {
  const sorte = criarSorteio('cadastro:propostas')

  for (const c of CLIENTES) {
    const pets = pacientesDoCliente(c.id).filter((p) => p.ativo)
    if (!pets.length) continue
    const ligados = pets.filter((p) => VINCULOS.has(p.id))
    const soltos = pets.filter((p) => !VINCULOS.has(p.id))

    /* A proposta que virou vínculo, respondida no dia em que ele começou. */
    const primeiro = ligados[0] ? VINCULOS.get(ligados[0].id) : undefined
    if (primeiro) {
      const canal = primeiro.origem
      PROPOSTAS.push({
        id: `demo-prop-${String(++sequenciaDeProposta).padStart(3, '0')}`,
        clienteId: c.id,
        canal,
        status: 'RESPONDIDA',
        criadaEm: somarMinutos(primeiro.ativadoEm, -sorte.inteiro(25, 180)),
        expiraEm: somarMinutos(primeiro.ativadoEm, 7 * 24 * 60),
        respondidaEm: primeiro.ativadoEm,
        motivoRecusa: null,
        pets: petsDa(
          ligados.map((p) => p.id),
          'LIGAR',
        ),
      })
    }

    if (!soltos.length) continue
    const ids = soltos.map((p) => p.id)
    const sorteio = sorte.numero()

    if (sorteio < 0.3) {
      const dias = sorte.inteiro(1, 5)
      const criadaEm = instante(somarDias(hoje(), -dias), `${sorte.inteiro(9, 18)}:15`)
      PROPOSTAS.push({
        id: `demo-prop-${String(++sequenciaDeProposta).padStart(3, '0')}`,
        clienteId: c.id,
        canal: sorte.escolher(['PROPOSTA_LINK', 'PROPOSTA_LINK', 'PROPOSTA_EMAIL'] as const),
        status: 'PENDENTE',
        criadaEm,
        expiraEm: somarMinutos(criadaEm, 7 * 24 * 60),
        respondidaEm: null,
        motivoRecusa: null,
        pets: petsDa(ids, null),
      })
    } else if (sorteio < 0.45) {
      const criadaEm = instante(somarDias(hoje(), -sorte.inteiro(18, 60)), '10:30')
      PROPOSTAS.push({
        id: `demo-prop-${String(++sequenciaDeProposta).padStart(3, '0')}`,
        clienteId: c.id,
        canal: 'PROPOSTA_EMAIL',
        status: 'EXPIRADA',
        criadaEm,
        expiraEm: somarMinutos(criadaEm, 7 * 24 * 60),
        respondidaEm: null,
        motivoRecusa: null,
        pets: petsDa(ids, null),
      })
    } else if (sorteio < 0.5) {
      const criadaEm = instante(somarDias(hoje(), -sorte.inteiro(20, 50)), '16:05')
      PROPOSTAS.push({
        id: `demo-prop-${String(++sequenciaDeProposta).padStart(3, '0')}`,
        clienteId: c.id,
        canal: 'PROPOSTA_LINK',
        status: 'RECUSADA',
        criadaEm,
        expiraEm: somarMinutos(criadaEm, 7 * 24 * 60),
        respondidaEm: somarMinutos(criadaEm, sorte.inteiro(30, 600)),
        motivoRecusa: 'NAO_QUERO_VINCULO',
        pets: petsDa(ids, null),
      })
    }
  }
}

montarPropostas()

export function propostasDoCliente(clienteId: string): Proposta[] {
  vencerPropostas()
  return PROPOSTAS.filter((p) => p.clienteId === clienteId)
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
    .map(({ clienteId: _c, ...dto }) => dto)
}

export function propostasPendentes(): Proposta[] {
  vencerPropostas()
  return PROPOSTAS.filter((p) => p.status === 'PENDENTE').map(({ clienteId: _c, ...dto }) => dto)
}

export function proposta(id: string) {
  return PROPOSTAS.find((p) => p.id === id) ?? null
}

/** A pendente que passou dos 7 dias vira expirada. */
function vencerPropostas() {
  for (const p of PROPOSTAS)
    if (p.status === 'PENDENTE' && jaPassou(p.expiraEm)) p.status = 'EXPIRADA'
}

/**
 * O convite novo: cancela as pendentes do cliente cujos pets estão todos nele (vale o último) e
 * devolve quantas caíram.
 */
export function criarProposta(
  clienteId: string,
  pacienteIds: string[],
  canal: Proposta['canal'],
): { proposta: Proposta; canceladas: number } {
  vencerPropostas()
  let canceladas = 0
  for (const p of PROPOSTAS) {
    if (p.clienteId !== clienteId || p.status !== 'PENDENTE') continue
    if (p.pets.every((pet) => pacienteIds.includes(pet.pacienteId))) {
      p.status = 'CANCELADA'
      canceladas += 1
    }
  }
  const criadaEm = agoraIso()
  const nova: PropostaDaDemo = {
    id: `demo-prop-${String(++sequenciaDeProposta).padStart(3, '0')}`,
    clienteId,
    canal,
    status: 'PENDENTE',
    criadaEm,
    expiraEm: somarMinutos(criadaEm, 7 * 24 * 60),
    respondidaEm: null,
    motivoRecusa: null,
    pets: petsDa(pacienteIds, null),
  }
  PROPOSTAS.push(nova)
  const { clienteId: _c, ...dto } = nova
  return { proposta: dto, canceladas }
}

/** As pendentes de um cliente que somem junto com ele (exclusão a pedido do titular). */
export function cancelarPropostasDoCliente(clienteId: string) {
  let canceladas = 0
  for (const p of PROPOSTAS) {
    if (p.clienteId === clienteId && p.status === 'PENDENTE') {
      p.status = 'CANCELADA'
      canceladas += 1
    }
  }
  return canceladas
}

/** O cliente que sumiu num mesclar: as propostas dele passam para o que ficou. */
export function moverPropostas(deClienteId: string, paraClienteId: string) {
  for (const p of PROPOSTAS) if (p.clienteId === deClienteId) p.clienteId = paraClienteId
}

/* ------------------------------------------------------------------- pedidos de correção */

const CORRECOES: PedidoDeCorrecao[] = []

function montarCorrecoes() {
  const pedidos: Array<[string, string, number, string, number | null]> = [
    [
      'demo-cli-001',
      'Mudei de endereço: agora é Rua Harmonia, 233, apto 51, Vila Madalena, CEP 05435-001.',
      0,
      '08:12',
      null,
    ],
    [
      'demo-cli-003',
      'Meu e-mail certo é luciana.campos.casa@example.com. O que está no cadastro eu não uso mais.',
      1,
      '21:47',
      null,
    ],
    [
      'demo-cli-007',
      'Por favor, incluam meu marido, Carlos Figueiredo, como autorizado a buscar a Cacau e o Bento. O telefone dele é (11) 99702-4418.',
      2,
      '19:05',
      null,
    ],
    [
      'demo-cli-010',
      'Meu nome completo é Gustavo Almeida Prado. No cadastro saiu só Gustavo Almeida.',
      3,
      '12:30',
      null,
    ],
    [
      'demo-cli-008',
      'O telefone principal agora é o (11) 97311-0482. Podem deixar o antigo como segundo número.',
      5,
      '09:58',
      null,
    ],
    ['demo-cli-004', 'Troquei de celular e o número mudou para (11) 98820-3175.', 19, '18:20', 17],
    [
      'demo-cli-006',
      'O nome da Brunilda está com a data de nascimento exata, mas foi um palpite nosso: ela veio adulta.',
      31,
      '10:44',
      30,
    ],
    ['demo-cli-009', 'O bairro certo é Lapa de Baixo, não Lapa.', 46, '15:02', 44],
  ]

  pedidos.forEach(([clienteId, mensagem, dias, hora, resolvidoHa], i) => {
    const c = cliente(clienteId)
    if (!c) return
    CORRECOES.push({
      id: `demo-corr-${String(i + 1).padStart(3, '0')}`,
      clienteId,
      clienteNome: c.nome,
      mensagem,
      criadoEm: instante(somarDias(hoje(), -dias), hora),
      resolvidoEm: resolvidoHa === null ? null : instante(somarDias(hoje(), -resolvidoHa), '11:20'),
    })
  })
}

montarCorrecoes()

export function correcoes(resolvidos: boolean): PedidoDeCorrecao[] {
  const quando = (c: PedidoDeCorrecao) => (resolvidos ? (c.resolvidoEm ?? '') : c.criadoEm)
  return CORRECOES.filter(
    (c) => (c.resolvidoEm !== null) === resolvidos && jaPassou(c.criadoEm),
  ).sort((a, b) => quando(b).localeCompare(quando(a)))
}

export function correcao(id: string) {
  return CORRECOES.find((c) => c.id === id) ?? null
}

/** Pendência da área: pedidos de correção que esperam a recepção. */
export function correcoesAbertas(): number {
  return correcoes(false).length
}

/* ------------------------------------------------------------------- trilha de auditoria */

const EVENTOS: EventoDaTrilha[] = []
let trilhaMontada = false
let sequenciaDeEvento = 0

function pessoa(usuarioId: string | null) {
  const p = usuarioId ? pessoaDaEquipe(usuarioId) : null
  return p ? { id: p.usuarioId, nome: p.nome } : null
}

/** O profissional em nome de quem: com o nome da pessoa, para "em nome de" só aparecer se for outro. */
function profissionalDe(profissionalId: string | null) {
  if (!profissionalId) return null
  const quem = EQUIPE.find((p) => p.profissionalId === profissionalId)
  const ficha = PROFISSIONAIS.find((p) => p.id === profissionalId)
  return { id: profissionalId, nome: quem?.nome ?? ficha?.nome ?? null }
}

function usuarioDoProfissional(profissionalId: string) {
  return EQUIPE.find((p) => p.profissionalId === profissionalId)?.usuarioId ?? USUARIO_ID
}

type NovoEvento = {
  em: string
  ator?: EventoDaTrilha['ator']
  acao: EventoDaTrilha['acao']
  recursoTipo: string
  recursoId: string
  pacienteId: string | null
  campos?: string[]
  protocolo?: string | null
  usuarioId: string | null
  profissionalId?: string | null
}

function evento(novo: NovoEvento): EventoDaTrilha {
  return {
    id: `demo-trilha-${String(++sequenciaDeEvento).padStart(5, '0')}`,
    em: novo.em,
    ator: novo.ator ?? 'EQUIPE',
    acao: novo.acao,
    recursoTipo: novo.recursoTipo,
    recursoId: novo.recursoId,
    pacienteId: novo.pacienteId,
    campos: novo.campos ?? [],
    protocolo: novo.protocolo ?? null,
    usuario: pessoa(novo.usuarioId),
    profissional: profissionalDe(novo.profissionalId ?? null),
  }
}

const CAMPOS_DO_ATENDIMENTO = [
  ['anamnese', 'exameFisico'],
  ['anamnese', 'exameFisico', 'diagnostico'],
  ['exameFisico', 'diagnostico', 'prescricao'],
  ['anamnese', 'prescricao'],
  ['diagnostico', 'conduta'],
]

function montarTrilha() {
  if (trilhaMontada) return
  trilhaMontada = true

  const sorte = criarSorteio('cadastro:trilha')
  const inicio = somarDias(hoje(), -14)
  const lista: NovoEvento[] = []
  const lucas = 'demo-usr-lucas'
  const juliana = 'demo-usr-juliana'

  const recentes = AGENDAMENTOS.filter(
    (a) =>
      a.inicio.slice(0, 10) >= inicio &&
      (a.status === 'FINALIZADO' || a.status === 'EM_ATENDIMENTO' || a.status === 'AGUARDANDO'),
  )

  for (const a of recentes) {
    const p = paciente(a.pacienteId)
    if (!p) continue
    const vet = usuarioDoProfissional(a.profissionalId)
    const chegada = a.chegadaEm ?? somarMinutos(a.inicio, -sorte.inteiro(4, 15))
    const comeco = a.iniciadoEm ?? a.inicio
    const vacina = a.tipoId === 'demo-tipo-vacina'

    if (sorte.chance(0.14)) {
      lista.push({
        em: somarMinutos(chegada, -1),
        acao: 'ALTERAR',
        recursoTipo: 'cliente-do-parceiro',
        recursoId: p.clienteId,
        pacienteId: p.id,
        campos: sorte.escolher([
          ['telefone'],
          ['email', 'contatoPreferido'],
          ['logradouro', 'numero', 'cep'],
        ]),
        usuarioId: juliana,
      })
    }
    if (sorte.chance(0.55)) {
      lista.push({
        em: somarMinutos(chegada, 2),
        acao: 'ALTERAR',
        recursoTipo: 'paciente-do-parceiro',
        recursoId: p.id,
        pacienteId: p.id,
        campos: ['pesoKg'],
        usuarioId: lucas,
      })
    }
    if (a.status === 'AGUARDANDO') continue

    if (p.noApp) {
      lista.push({
        em: somarMinutos(comeco, -2),
        acao: 'LER_DADO_DO_APP',
        recursoTipo: 'diario-do-app',
        recursoId: p.id,
        pacienteId: p.id,
        usuarioId: vet,
        profissionalId: a.profissionalId,
      })
    }
    lista.push({
      em: somarMinutos(comeco, -1),
      acao: 'LER',
      recursoTipo: 'paciente-do-parceiro',
      recursoId: p.id,
      pacienteId: p.id,
      usuarioId: vet,
      profissionalId: a.profissionalId,
    })

    if (!a.atendimentoId) continue
    if (vacina) {
      lista.push({
        em: somarMinutos(comeco, 8),
        acao: 'CRIAR',
        recursoTipo: 'aplicacao-vacina',
        recursoId: `demo-apl-${a.id}`,
        pacienteId: p.id,
        usuarioId: sorte.chance(0.6) ? lucas : vet,
        profissionalId: a.profissionalId,
      })
    }
    lista.push({
      em: somarMinutos(comeco, sorte.inteiro(6, 18)),
      acao: 'ALTERAR',
      recursoTipo: 'atendimento',
      recursoId: a.atendimentoId,
      pacienteId: p.id,
      campos: sorte.escolher(CAMPOS_DO_ATENDIMENTO),
      usuarioId: vet,
      profissionalId: a.profissionalId,
    })
    if (a.status !== 'FINALIZADO') continue
    const fim = a.finalizadoEm ?? a.fim
    lista.push({
      em: fim,
      acao: 'FINALIZAR',
      recursoTipo: 'atendimento',
      recursoId: a.atendimentoId,
      pacienteId: p.id,
      usuarioId: vet,
      profissionalId: a.profissionalId,
    })
    if (sorte.chance(0.4)) {
      lista.push({
        em: somarMinutos(fim, 2),
        acao: 'IMPRIMIR',
        recursoTipo: 'atendimento',
        recursoId: a.atendimentoId,
        pacienteId: p.id,
        campos: ['prescricao'],
        usuarioId: sorte.chance(0.5) ? juliana : vet,
        profissionalId: a.profissionalId,
      })
    }
    if (p.noApp) {
      lista.push({
        em: somarMinutos(fim, 1),
        acao: 'PUBLICAR',
        recursoTipo: 'consulta-do-app',
        recursoId: `demo-pub-${a.atendimentoId}`,
        pacienteId: p.id,
        usuarioId: vet,
        profissionalId: a.profissionalId,
      })
      if (vacina) {
        lista.push({
          em: somarMinutos(fim, 1),
          ator: 'SISTEMA',
          acao: 'PUBLICAR',
          recursoTipo: 'vacina-do-app',
          recursoId: `demo-apl-${a.id}`,
          pacienteId: p.id,
          usuarioId: null,
        })
      }
    }
  }

  /* O que não sai da agenda: cadastro novo, alerta, a dona conferindo a trilha, o suporte. */
  const avulsos: NovoEvento[] = [
    {
      em: instante(somarDias(hoje(), -2), '16:42'),
      acao: 'ALTERAR',
      recursoTipo: 'alerta-do-paciente',
      recursoId: 'demo-alerta-novo-1',
      pacienteId: 'demo-pac-003',
      campos: ['criado'],
      usuarioId: 'demo-usr-rafael',
      profissionalId: 'demo-prof-rafael',
    },
    {
      em: instante(somarDias(hoje(), -4), '09:12'),
      acao: 'ALTERAR',
      recursoTipo: 'paciente-do-parceiro',
      recursoId: 'demo-pac-045',
      pacienteId: 'demo-pac-045',
      campos: ['criado'],
      usuarioId: juliana,
    },
    {
      em: instante(somarDias(hoje(), -6), '18:05'),
      acao: 'EXPORTAR',
      recursoTipo: 'trilha-clinica',
      recursoId: 'demo-parceiro-vila-madalena',
      pacienteId: null,
      usuarioId: USUARIO_ID,
    },
    {
      em: instante(somarDias(hoje(), -6), '18:01'),
      acao: 'LER',
      recursoTipo: 'trilha-clinica',
      recursoId: 'demo-parceiro-vila-madalena',
      pacienteId: null,
      usuarioId: 'demo-usr-patricia',
    },
    {
      em: instante(somarDias(hoje(), -9), '14:26'),
      ator: 'SUPORTE',
      acao: 'LER',
      recursoTipo: 'atendimento',
      recursoId: recentes.find((a) => a.atendimentoId)?.atendimentoId ?? 'demo-atd',
      pacienteId: recentes.find((a) => a.atendimentoId)?.pacienteId ?? null,
      protocolo: 'SUP-2026-0412',
      usuarioId: null,
    },
    {
      em: instante(somarDias(hoje(), -11), '10:03'),
      acao: 'ALTERAR',
      recursoTipo: 'alerta-do-paciente',
      recursoId: 'demo-alerta-encerrado-1',
      pacienteId: 'demo-pac-016',
      campos: ['ativo'],
      usuarioId: 'demo-usr-camila',
      profissionalId: 'demo-prof-camila',
    },
  ]

  const limite = agora().getTime()
  for (const novo of [...lista, ...avulsos]) {
    if (Date.parse(novo.em) <= limite) EVENTOS.push(evento(novo))
  }
  ordenarTrilha()
}

function ordenarTrilha() {
  EVENTOS.sort((a, b) => Date.parse(b.em) - Date.parse(a.em))
}

/** A trilha inteira, do mais novo para o mais antigo. */
export function trilha(): EventoDaTrilha[] {
  montarTrilha()
  return EVENTOS
}

export function eventosDoPaciente(pacienteId: string): EventoDaTrilha[] {
  return trilha().filter((e) => e.pacienteId === pacienteId)
}

/**
 * O que a dona faz na apresentação entra na trilha na hora. Leitura do app repetida em poucos
 * minutos não se anota de novo, como a API faz.
 */
export function anotar(
  acao: EventoDaTrilha['acao'],
  recursoTipo: string,
  recursoId: string,
  pacienteId: string | null,
  campos: string[] = [],
) {
  montarTrilha()
  const em = agoraIso()
  if (acao === 'LER' || acao === 'LER_DADO_DO_APP') {
    const recente = EVENTOS.find(
      (e) =>
        e.acao === acao &&
        e.recursoId === recursoId &&
        e.usuario?.id === USUARIO_ID &&
        Date.parse(em) - Date.parse(e.em) < 5 * 60 * 1000,
    )
    if (recente) return
  }
  EVENTOS.unshift(
    evento({
      em,
      acao,
      recursoTipo,
      recursoId,
      pacienteId,
      campos,
      usuarioId: USUARIO_ID,
      profissionalId: 'demo-prof-marina',
    }),
  )
}

export { importacoesParadas } from './cadastro-importacao'
