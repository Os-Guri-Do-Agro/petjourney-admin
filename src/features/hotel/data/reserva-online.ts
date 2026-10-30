/**
 * O servidor da reserva online do hotel — o que o app, a página pública e o balcão chamam.
 *
 * O irmão de `features/clinico/data/agendamento-online.ts`, com as diferenças de um hotel: o que
 * se pede é o tipo de acomodação para um período, dois pets da mesma casa dividem a unidade, e o
 * aceite cria uma reserva `pendente` — falta o sinal, como em toda reserva da casa.
 *
 * O celular e a página pública falam só o contrato (`contrato/responsavel.ts`); o balcão fala os
 * tipos do hotel. A vaga é a da mesma função do mapa (`avaliarVaga`).
 */

import { addDays, createClinicClock, diffDays } from '@/features/clinico/domain/clinic-time'
import type { Pet, PetPorte, PetSpecies, Tutor } from '@/features/clinico/data/types'

import {
  textoPtDaNotificacaoDaReserva,
  type CodigoDeErroDaReserva,
  type CriarPedidoDeReserva,
  type CriarPedidoDeReservaPeloLink,
  type DisponibilidadeDoPeriodo,
  type ExigenciaNoPedido,
  type PedidoDeReservaNoContrato,
  type PedidoDeReservaPeloLink,
  type PorteNoContrato,
  type ReservaOnlineDoHotel,
  type ServicoNoPedido,
  type TipoDisponivel,
} from '../contrato/responsavel'
import { avaliarAdmissao } from '../domain/admissao'
import { avaliarVaga, reservaDoAnimalNoPeriodo } from '../domain/disponibilidade'
import { contarDiarias, dataDe, horaDe, instante, offsetDe } from '../domain/hotel-time'
import {
  ehUrgente,
  melhoresAcomodacoes,
  pedidoDeReservaPerdeuOSentido,
  podemDividir,
  prazoNoBalcao,
  unidadesLivres,
  type PetDaVaga,
  type SugestaoDeAcomodacao,
} from '../domain/pedidos-de-reserva'
import { montarOrcamento } from '../domain/tarifas'

import { HOTEL_UTC_OFFSET } from './fixtures'
import { simularChamada } from './mock-runtime'
import { VagaIndisponivelError } from './repositories/reserva-repository'
import { agoraIso, getDataset, hojeIso, novoId } from './store'
import type {
  Acomodacao,
  AvisoDoPedidoDeReserva,
  CadastroMinimoDaReserva,
  ISODate,
  ISODateTime,
  MotivoDaRecusaDaReserva,
  PedidoDeReserva,
  Reserva,
  ReservaOnline,
  ServicoContratado,
  ServicoKind,
} from './types'

const clock = createClinicClock(HOTEL_UTC_OFFSET)

/** Recusa com código estável, como a API. */
export class ErroDaReservaOnline extends Error {
  readonly codigo: CodigoDeErroDaReserva

  constructor(codigo: CodigoDeErroDaReserva) {
    super(`[reserva online] ${codigo}`)
    this.name = 'ErroDaReservaOnline'
    this.codigo = codigo
  }
}

// ---------------------------------------------------------------------------
// Ensaio — o "esgotou enquanto eu pedia"
// ---------------------------------------------------------------------------

/**
 * Ligado, o próximo envio de tipo escolhido encontra o tipo esgotado — e esgotado de verdade:
 * outras pessoas pedem as unidades que restavam. Voltar à lista mostra o tipo sem vaga.
 */
const ensaio = { proximoEnvioDisputado: false }

export function disputarProximoEnvio(ligado = true) {
  ensaio.proximoEnvioDisputado = ligado
}

export function envioVaiSerDisputado() {
  return ensaio.proximoEnvioDisputado
}

// ---------------------------------------------------------------------------
// De-para
// ---------------------------------------------------------------------------

const SERVICO_DO_FIO: Record<ServicoNoPedido, ServicoKind> = {
  BANHO: 'banho',
  TOSA: 'tosa',
  PASSEIO_EXTRA: 'passeio-extra',
}

const SERVICO_NO_FIO: Partial<Record<ServicoKind, ServicoNoPedido>> = {
  banho: 'BANHO',
  tosa: 'TOSA',
  'passeio-extra': 'PASSEIO_EXTRA',
}

const PORTE_DO_FIO: Record<PorteNoContrato, PetPorte> = {
  MINI: 'mini',
  PEQUENO: 'pequeno',
  MEDIO: 'medio',
  GRANDE: 'grande',
  GIGANTE: 'gigante',
}

const ESPECIE_DO_FIO: Record<string, PetSpecies> = {
  CANINA: 'canina',
  FELINA: 'felina',
  AVE: 'ave',
  ROEDOR: 'roedor',
  REPTIL: 'reptil',
  EQUINA: 'equina',
}

const STATUS_NO_FIO = {
  pendente: 'AGUARDANDO_HOTEL',
  aceito: 'ACEITO',
  recusado: 'RECUSADO',
  desistiu: 'CANCELADO_PELO_RESPONSAVEL',
  expirado: 'EXPIRADO',
} as const

const RECUSA_NO_FIO = {
  'sem-vaga': 'SEM_VAGA',
  exigencias: 'EXIGENCIAS',
  perfil: 'PERFIL',
  outro: 'OUTRO',
} as const

const RECURSO_NO_FIO = {
  camera: 'CAMERA',
  climatizacao: 'CLIMATIZACAO',
  'area-externa': 'AREA_EXTERNA',
  'piso-aquecido': 'PISO_AQUECIDO',
  janela: 'JANELA',
} as const

const EXIGENCIA_NO_FIO = {
  ok: 'OK',
  dispensado: 'OK',
  'vence-durante': 'VENCE_DURANTE',
  vencido: 'VENCIDO',
  ausente: 'AUSENTE',
} as const

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

function configuracao(): ReservaOnline {
  return getDataset().reservaOnline
}

function petEmQualquerLugar(petId: string): Pet | null {
  const dataset = getDataset()

  return (
    dataset.pets.find((pet) => pet.id === petId) ??
    dataset.contasSoNoApp.flatMap((conta) => conta.pets).find((pet) => pet.id === petId) ??
    null
  )
}

function tutorEmQualquerLugar(tutorId: string): Tutor | null {
  const dataset = getDataset()

  return (
    dataset.tutores.find((tutor) => tutor.id === tutorId) ??
    dataset.contasSoNoApp.find((conta) => conta.tutor.id === tutorId)?.tutor ??
    null
  )
}

/** Cão precisa de porte para saber onde cabe. Gato, ave e companhia o hotel aloca pela espécie. */
function faltaPorte(pet: Pick<Pet, 'especie' | 'porte'>): boolean {
  return pet.especie === 'canina' && pet.porte === null
}

function unidades(
  pets: PetDaVaga[],
  inicio: ISODateTime,
  fim: ISODateTime,
  ignorar?: PedidoDeReserva,
) {
  const dataset = getDataset()

  return unidadesLivres({
    acomodacoes: dataset.acomodacoes,
    tipos: dataset.tiposDeAcomodacao,
    reservas: dataset.reservas,
    pedidos: dataset.pedidosDeReserva,
    pets,
    inicio,
    fim,
    tipoIds: configuracao().tipoIds,
    ignorarPedidoId: ignorar?.id ?? null,
    chegouAntesDe: ignorar?.criadoEm ?? null,
  })
}

function orcamentoEm(
  acomodacao: Acomodacao,
  pets: PetDaVaga[],
  inicio: ISODateTime,
  fim: ISODateTime,
  servicos: ServicoContratado[] = [],
) {
  const dataset = getDataset()
  const tarifa = dataset.tarifas.find((item) => item.id === acomodacao.tarifaId)

  if (!tarifa) {
    return null
  }

  return montarOrcamento({
    entrada: inicio,
    saida: fim,
    tarifa,
    porte: pets[0]?.porte ?? null,
    porteAcompanhante: pets[1] ? pets[1].porte : null,
    temporadas: dataset.temporadas,
    servicos,
    catalogoDeServicos: dataset.servicos,
    politica: dataset.hotel.politica,
  })
}

/** Os serviços pedidos, com o preço do catálogo de hoje — por diária quando é por diária. */
function servicosContratados(kinds: ServicoKind[], diarias: number): ServicoContratado[] {
  return getDataset()
    .servicos.filter((servico) => servico.ativo && kinds.includes(servico.kind))
    .map((servico) => ({
      servicoId: servico.id,
      quantidade: servico.porDiaria ? diarias : 1,
      precoUnitarioCentavos: servico.precoCentavos,
      observacao: '',
    }))
}

function exigenciasDe(pet: Pet, saida: ISODateTime): ExigenciaNoPedido[] {
  const dataset = getDataset()
  const avaliacao = avaliarAdmissao({
    exigencias: dataset.exigencias,
    comprovantes: dataset.comprovantes,
    petId: pet.id,
    especie: pet.especie,
    saidaPrevista: dataDe(saida),
    hoje: hojeIso(),
  })

  return avaliacao.itens.map((item) => ({
    exigencia: item.kind,
    bloqueia: item.bloqueia,
    situacao: EXIGENCIA_NO_FIO[item.situacao],
  }))
}

// ---------------------------------------------------------------------------
// O lado do responsável
// ---------------------------------------------------------------------------

function hotelNoFio(): ReservaOnlineDoHotel {
  const dataset = getDataset()
  const config = configuracao()

  return {
    hotel: {
      id: dataset.hotel.id,
      nome: dataset.hotel.nome,
      telefone: dataset.hotel.telefone,
      endereco: dataset.hotel.endereco,
      utcOffset: dataset.hotel.utcOffset,
    },
    recebePedidos: config.ativo,
    modos: [
      ...(config.permiteEscolherAcomodacao ? (['ACOMODACAO_ESCOLHIDA'] as const) : []),
      ...(config.permiteHotelEscolhe ? (['HOTEL_ESCOLHE'] as const) : []),
    ],
    prazoDeRespostaHoras: config.prazoDeRespostaHoras,
    antecedenciaMinimaHoras: config.antecedenciaMinimaHoras,
    horizonteDias: config.horizonteDias,
    horarioDeEntrada: dataset.hotel.politica.horarioDeEntrada,
    horarioDeSaida: dataset.hotel.politica.horarioDeSaida,
    sinalPercentual: dataset.hotel.politica.sinalPercentual,
    cancelamentoSemCustoDias: dataset.hotel.politica.cancelamentoSemCustoDias,
    balcao: { ...config.balcao },
    servicos: dataset.servicos
      .filter((servico) => servico.ativo && SERVICO_NO_FIO[servico.kind])
      .map((servico) => ({
        servico: SERVICO_NO_FIO[servico.kind]!,
        precoCentavos: servico.precoCentavos,
        porDiaria: servico.porDiaria,
      })),
    urgencia: {
      telefone: config.urgencia.telefone,
      whatsapp: config.urgencia.whatsapp,
      orientacao: config.urgencia.orientacao,
      idiomaDaOrientacao: 'pt-BR',
    },
  }
}

function conferirPeriodo(entrada: ISODateTime, saida: ISODateTime) {
  const config = configuracao()

  if (Date.parse(saida) <= Date.parse(entrada)) {
    throw new ErroDaReservaOnline('PERIODO_INVALIDO')
  }

  if (ehUrgente(entrada, agoraIso(), config.antecedenciaMinimaHoras)) {
    throw new ErroDaReservaOnline('FORA_DA_ANTECEDENCIA')
  }

  if (diffDays(hojeIso(), dataDe(entrada)) > config.horizonteDias) {
    throw new ErroDaReservaOnline('PERIODO_INVALIDO')
  }
}

function disponibilidade(
  pets: PetDaVaga[],
  inicio: ISODateTime,
  fim: ISODateTime,
  petsDoApp: Pet[],
): DisponibilidadeDoPeriodo {
  const dataset = getDataset()
  const config = configuracao()

  if (!config.ativo) {
    throw new ErroDaReservaOnline('HOTEL_NAO_RECEBE_PEDIDOS')
  }

  conferirPeriodo(inicio, fim)

  if (!podemDividir(pets)) {
    throw new ErroDaReservaOnline('NAO_DIVIDEM_ACOMODACAO')
  }

  const livres = unidades(pets, inicio, fim)
  const diarias = contarDiarias(inicio, fim)

  const tipos: TipoDisponivel[] = dataset.tiposDeAcomodacao
    .filter((tipo) => config.tipoIds.includes(tipo.id))
    .sort((a, b) => a.ordem - b.ordem)
    .map((tipo) => {
      const doTipo = livres.filter((item) => item.tipo.id === tipo.id)
      /* A estimativa sai da unidade mais barata livre — ou da primeira do tipo, quando esgotou. */
      const referencia =
        doTipo[0]?.acomodacao ??
        dataset.acomodacoes.find((item) => item.tipoId === tipo.id && item.ativa)
      const orcamento = referencia ? orcamentoEm(referencia, pets, inicio, fim) : null
      const recursos = new Set(
        dataset.acomodacoes
          .filter((item) => item.tipoId === tipo.id && item.ativa)
          .flatMap((item) => item.recursos),
      )

      return {
        tipoId: tipo.id,
        nome: tipo.nome,
        livres: doTipo.length,
        estimativaCentavos: orcamento?.totalCentavos ?? 0,
        diarias,
        recursos: [...recursos].map((recurso) => RECURSO_NO_FIO[recurso]),
      }
    })
    /* O tipo que não serve a estes pets (gatil para cão) não aparece — não é "esgotado". */
    .filter((tipo) =>
      dataset.acomodacoes.some(
        (acomodacao) =>
          acomodacao.tipoId === tipo.tipoId &&
          acomodacao.ativa &&
          avaliarVaga({
            acomodacao,
            reservas: [],
            inicio,
            fim,
            porte: pets[0]?.porte ?? null,
            especie: pets[0]?.especie ?? null,
            ocupantes: pets.length,
          }).impedimentos.length === 0,
      ),
    )

  return {
    diarias,
    tipos,
    exigencias: petsDoApp.map((pet) => ({ petId: pet.id, itens: exigenciasDe(pet, fim) })),
  }
}

function petsDaVaga(pets: Pet[]): PetDaVaga[] {
  return pets.map((pet) => ({ porte: pet.porte, especie: pet.especie }))
}

function disponibilidadeNoApp(
  tutorId: string,
  petIds: string[],
  inicio: ISODateTime,
  fim: ISODateTime,
) {
  const pets = petIds
    .map(petEmQualquerLugar)
    .filter((pet): pet is Pet => pet !== null && pet.tutorId === tutorId)

  if (pets.length !== petIds.length || pets.some(faltaPorte)) {
    throw new ErroDaReservaOnline('CADASTRO_INCOMPLETO')
  }

  return disponibilidade(petsDaVaga(pets), inicio, fim, pets)
}

function disponibilidadePublica(
  especie: string,
  porte: PorteNoContrato | null,
  inicio: ISODateTime,
  fim: ISODateTime,
) {
  return disponibilidade(
    [{ especie: ESPECIE_DO_FIO[especie] ?? 'canina', porte: porte ? PORTE_DO_FIO[porte] : null }],
    inicio,
    fim,
    [],
  )
}

/**
 * Outra pessoa pede as unidades que sobravam do tipo — o "esgotou enquanto eu pedia" de verdade:
 * a lista relida mostra o tipo sem vaga.
 */
function esgotarTipo(tipoId: string, pets: PetDaVaga[], inicio: ISODateTime, fim: ISODateTime) {
  const dataset = getDataset()
  const restantes = unidades(pets, inicio, fim).filter((item) => item.tipo.id === tipoId)

  for (const [indice] of restantes.entries()) {
    dataset.pedidosDeReserva.push({
      id: novoId('pedido-res'),
      canal: 'app',
      modo: 'acomodacao-escolhida',
      petId: indice % 2 === 0 ? 'pet-nero' : 'pet-lola',
      acompanhantePetId: null,
      tutorId: indice % 2 === 0 ? 'tutor-eduardo' : 'tutor-sergio',
      novoCadastro: null,
      entrada: inicio,
      saida: fim,
      tipoId,
      aceitaMudarUmDia: false,
      servicos: [],
      observacao: '',
      status: 'pendente',
      criadoEm: clock.toIso(clock.now().date, clock.now().minutes - 1),
      responderAte: prazoNoBalcao(
        agoraIso(),
        configuracao().prazoDeRespostaHoras,
        configuracao().balcao,
      ),
      respondidoEm: null,
      respondidoPor: null,
      reservaId: null,
      recusa: null,
    })
  }
}

function conferirModo(modo: CriarPedidoDeReserva['modo']) {
  const config = configuracao()

  if (!config.ativo) {
    throw new ErroDaReservaOnline('HOTEL_NAO_RECEBE_PEDIDOS')
  }

  if (
    modo === 'ACOMODACAO_ESCOLHIDA'
      ? !config.permiteEscolherAcomodacao
      : !config.permiteHotelEscolhe
  ) {
    throw new ErroDaReservaOnline('MODO_INDISPONIVEL')
  }
}

function gravarPedido(
  entrada: Omit<CriarPedidoDeReserva, 'petIds'>,
  quem: Pick<PedidoDeReserva, 'canal' | 'petId' | 'acompanhantePetId' | 'tutorId' | 'novoCadastro'>,
  pets: PetDaVaga[],
): PedidoDeReserva {
  const dataset = getDataset()

  conferirModo(entrada.modo)
  conferirPeriodo(entrada.entrada, entrada.saida)

  if (!podemDividir(pets)) {
    throw new ErroDaReservaOnline('NAO_DIVIDEM_ACOMODACAO')
  }

  if (entrada.modo === 'ACOMODACAO_ESCOLHIDA') {
    if (!entrada.tipoId || !configuracao().tipoIds.includes(entrada.tipoId)) {
      throw new ErroDaReservaOnline('MODO_INDISPONIVEL')
    }

    if (ensaio.proximoEnvioDisputado) {
      ensaio.proximoEnvioDisputado = false
      esgotarTipo(entrada.tipoId, pets, entrada.entrada, entrada.saida)
    }

    const livres = unidades(pets, entrada.entrada, entrada.saida).filter(
      (item) => item.tipo.id === entrada.tipoId,
    )

    if (livres.length === 0) {
      throw new ErroDaReservaOnline('SEM_VAGA_NO_TIPO')
    }
  }

  const criadoEm = agoraIso()
  const pedido: PedidoDeReserva = {
    id: novoId('pedido-res'),
    ...quem,
    modo: entrada.modo === 'ACOMODACAO_ESCOLHIDA' ? 'acomodacao-escolhida' : 'hotel-escolhe',
    entrada: entrada.entrada,
    saida: entrada.saida,
    tipoId: entrada.modo === 'ACOMODACAO_ESCOLHIDA' ? (entrada.tipoId ?? null) : null,
    aceitaMudarUmDia: entrada.modo === 'HOTEL_ESCOLHE' && Boolean(entrada.aceitaMudarUmDia),
    servicos: (entrada.servicos ?? []).map((servico) => SERVICO_DO_FIO[servico]),
    observacao: (entrada.observacao ?? '').trim(),
    status: 'pendente',
    criadoEm,
    responderAte: prazoNoBalcao(
      criadoEm,
      configuracao().prazoDeRespostaHoras,
      configuracao().balcao,
    ),
    respondidoEm: null,
    respondidoPor: null,
    reservaId: null,
    recusa: null,
  }

  dataset.pedidosDeReserva.push(pedido)

  return pedido
}

function pedirPeloApp(tutorId: string, entrada: CriarPedidoDeReserva): PedidoDeReservaNoContrato {
  const dataset = getDataset()
  const pets = entrada.petIds
    .map(petEmQualquerLugar)
    .filter((pet): pet is Pet => pet !== null && pet.tutorId === tutorId)

  if (
    pets.length === 0 ||
    pets.length > 2 ||
    pets.length !== entrada.petIds.length ||
    pets.some(faltaPorte)
  ) {
    throw new ErroDaReservaOnline('CADASTRO_INCOMPLETO')
  }

  const tutor = tutorEmQualquerLugar(tutorId)
  const [principal, acompanhante] = pets as [Pet, Pet | undefined]
  const conhecido = dataset.pets.some((pet) => pet.id === principal.id)

  const pedido = gravarPedido(
    entrada,
    {
      canal: 'app',
      petId: principal.id,
      acompanhantePetId: acompanhante?.id ?? null,
      tutorId,
      /* O hotel ainda não conhece este pet: recebe o que o app sabe, e o cadastro nasce no aceite. */
      novoCadastro: conhecido
        ? null
        : {
            nome: tutor?.nome ?? '',
            telefone: tutor?.telefone ?? '',
            petNome: principal.nome,
            especie: principal.especie,
            porte: principal.porte,
          },
    },
    petsDaVaga(pets),
  )

  return pedidoNoFio(pedido)
}

function soDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

/** O telefone é a chave, como na clínica: cliente da casa não vira segundo cadastro. */
function pedirPeloLink(entrada: CriarPedidoDeReservaPeloLink): PedidoDeReservaPeloLink {
  const dataset = getDataset()
  const { visitante } = entrada

  if (
    !visitante.nome.trim() ||
    soDigitos(visitante.telefone).length < 10 ||
    !visitante.petNome.trim()
  ) {
    throw new ErroDaReservaOnline('CADASTRO_INCOMPLETO')
  }

  const especie = ESPECIE_DO_FIO[visitante.especie] ?? 'canina'
  const porte = visitante.porte ? PORTE_DO_FIO[visitante.porte] : null

  if (especie === 'canina' && porte === null) {
    throw new ErroDaReservaOnline('CADASTRO_INCOMPLETO')
  }

  const tutor =
    dataset.tutores.find((item) => soDigitos(item.telefone) === soDigitos(visitante.telefone)) ??
    null
  const pet = tutor
    ? (dataset.pets.find(
        (item) =>
          item.tutorId === tutor.id &&
          item.nome.localeCompare(visitante.petNome.trim(), 'pt-BR', { sensitivity: 'base' }) === 0,
      ) ?? null)
    : null

  const pedido = gravarPedido(
    entrada,
    {
      canal: 'link',
      petId: pet?.id ?? null,
      acompanhantePetId: null,
      tutorId: tutor?.id ?? null,
      novoCadastro: pet
        ? null
        : {
            nome: visitante.nome.trim(),
            telefone: visitante.telefone.trim(),
            petNome: visitante.petNome.trim(),
            especie,
            porte,
          },
    },
    [{ especie: pet?.especie ?? especie, porte: pet?.porte ?? porte }],
  )

  const token = novoId('lk').split('-').slice(0, 2).join('')

  dataset.tokensDoLink[pedido.id] = token

  return { ...pedidoNoFio(pedido), token }
}

function pedidoNoFio(pedido: PedidoDeReserva): PedidoDeReservaNoContrato {
  const dataset = getDataset()
  const reserva = pedido.reservaId
    ? dataset.reservas.find((item) => item.id === pedido.reservaId)
    : null
  const acomodacao = reserva
    ? dataset.acomodacoes.find((item) => item.id === reserva.acomodacaoId)
    : null
  const tipo = pedido.tipoId
    ? dataset.tiposDeAcomodacao.find((item) => item.id === pedido.tipoId)
    : null

  const pets = [pedido.petId, pedido.acompanhantePetId]
    .filter((id): id is string => Boolean(id))
    .map((id) => {
      const pet = petEmQualquerLugar(id)

      return { id, nome: pet?.nome ?? '', fotoUrl: pet?.fotoUrl || null }
    })

  return {
    id: pedido.id,
    canal: pedido.canal === 'link' ? 'LINK_PUBLICO' : 'APP',
    modo: pedido.modo === 'acomodacao-escolhida' ? 'ACOMODACAO_ESCOLHIDA' : 'HOTEL_ESCOLHE',
    pets:
      pets.length > 0
        ? pets
        : [{ id: '', nome: pedido.novoCadastro?.petNome ?? '', fotoUrl: null }],
    entrada: pedido.entrada,
    saida: pedido.saida,
    diarias: contarDiarias(pedido.entrada, pedido.saida),
    tipoPedido: tipo ? { tipoId: tipo.id, nome: tipo.nome } : null,
    servicos: pedido.servicos
      .map((servico) => SERVICO_NO_FIO[servico])
      .filter((servico): servico is ServicoNoPedido => Boolean(servico)),
    observacao: pedido.observacao,
    status: STATUS_NO_FIO[pedido.status],
    criadoEm: pedido.criadoEm,
    responderAte: pedido.responderAte,
    reserva:
      reserva && acomodacao
        ? {
            id: reserva.id,
            acomodacao: acomodacao.nome,
            entrada: reserva.entradaPrevista,
            saida: reserva.saidaPrevista,
            totalCentavos: reserva.orcamento.totalCentavos,
            sinalCentavos: reserva.orcamento.sinalCentavos,
          }
        : null,
    recusa: pedido.recusa
      ? {
          motivo: RECUSA_NO_FIO[pedido.recusa.motivo],
          mensagemDoHotel: pedido.recusa.mensagem,
          idiomaDaMensagem: 'pt-BR',
        }
      : null,
    podeCancelar: pedido.status === 'pendente',
  }
}

function expirar() {
  const agora = agoraIso()

  for (const pedido of getDataset().pedidosDeReserva) {
    if (pedidoDeReservaPerdeuOSentido(pedido, agora)) {
      pedido.status = 'expirado'
    }
  }
}

function pedidosDoResponsavel(tutorId: string): PedidoDeReservaNoContrato[] {
  expirar()

  return getDataset()
    .pedidosDeReserva.filter((pedido) => pedido.tutorId === tutorId && pedido.canal === 'app')
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .map(pedidoNoFio)
}

function pedidoPorToken(token: string): PedidoDeReservaPeloLink | null {
  const achado = Object.entries(getDataset().tokensDoLink).find(([, valor]) => valor === token)
  const pedido = achado ? getDataset().pedidosDeReserva.find((item) => item.id === achado[0]) : null

  expirar()

  return pedido ? { ...pedidoNoFio(pedido), token } : null
}

function cancelarPedido(pedidoId: string): PedidoDeReservaNoContrato {
  const pedido = getDataset().pedidosDeReserva.find((item) => item.id === pedidoId)

  if (!pedido || pedido.status !== 'pendente') {
    throw new ErroDaReservaOnline('PEDIDO_JA_RESPONDIDO')
  }

  pedido.status = 'desistiu'
  pedido.respondidoEm = agoraIso()

  return pedidoNoFio(pedido)
}

/** Os pets da conta, como o app os tem — com o que falta para pedir hospedagem. */
export type PetDaContaNoHotel = {
  id: string
  nome: string
  especie: PetSpecies
  porte: PetPorte | null
  fotoUrl: string | null
  faltaPorte: boolean
  /** Já está hospedado agora: o pedido para ele é outra estadia, não a atual. */
  hospedadoAgora: boolean
  /** Nunca se hospedou aqui. */
  primeiraEstadia: boolean
}

function petsDaConta(tutorId: string): PetDaContaNoHotel[] {
  const dataset = getDataset()
  const daCasa = dataset.pets.filter((pet) => pet.tutorId === tutorId)
  const soNoApp = dataset.contasSoNoApp
    .filter((conta) => conta.tutor.id === tutorId)
    .flatMap((conta) => conta.pets)
    .filter((pet) => !daCasa.some((item) => item.id === pet.id))

  return (
    [...daCasa, ...soNoApp]
      /* Hotel de cão e gato: a ave, o réptil e o cavalo da casa não aparecem para escolher. */
      .filter((pet) => pet.especie === 'canina' || pet.especie === 'felina')
      .map((pet) => ({
        id: pet.id,
        nome: pet.nome,
        especie: pet.especie,
        porte: pet.porte,
        fotoUrl: pet.fotoUrl || null,
        faltaPorte: faltaPorte(pet),
        hospedadoAgora: dataset.hospedagens.some(
          (item) => item.petId === pet.id && item.status === 'hospedado',
        ),
        primeiraEstadia: !dataset.reservas.some(
          (reserva) => reserva.petId === pet.id && reserva.status === 'encerrada',
        ),
      }))
  )
}

function completarPorte(tutorId: string, petId: string, porte: PetPorte) {
  const pet = petEmQualquerLugar(petId)

  if (!pet || pet.tutorId !== tutorId) {
    throw new ErroDaReservaOnline('CADASTRO_INCOMPLETO')
  }

  pet.porte = porte
}

/** As estadias que vão acontecer, dos pets desta pessoa — o "próximas hospedagens" do app. */
export type EstadiaNoApp = {
  reservaId: string
  petNomes: string[]
  acomodacao: string
  entrada: ISODateTime
  saida: ISODateTime
  /** Falta o sinal: a reserva existe, mas ainda não está confirmada. */
  aguardaSinal: boolean
  sinalCentavos: number
}

function estadias(tutorId: string): EstadiaNoApp[] {
  const dataset = getDataset()
  const agora = Date.parse(agoraIso())

  return dataset.reservas
    .filter(
      (reserva) =>
        reserva.tutorId === tutorId &&
        (reserva.status === 'pendente' || reserva.status === 'confirmada') &&
        Date.parse(reserva.saidaPrevista) > agora,
    )
    .sort((a, b) => a.entradaPrevista.localeCompare(b.entradaPrevista))
    .map((reserva) => ({
      reservaId: reserva.id,
      petNomes: [reserva.petId, reserva.acompanhantePetId]
        .filter((id): id is string => Boolean(id))
        .map((id) => petEmQualquerLugar(id)?.nome ?? ''),
      acomodacao: dataset.acomodacoes.find((item) => item.id === reserva.acomodacaoId)?.nome ?? '',
      entrada: reserva.entradaPrevista,
      saida: reserva.saidaPrevista,
      aguardaSinal: reserva.status === 'pendente',
      sinalCentavos: reserva.orcamento.sinalCentavos,
    }))
}

export const reservaOnlineDoResponsavel = {
  hotel: () => simularChamada('pedido.disponibilidade', hotelNoFio),
  disponibilidade: (tutorId: string, petIds: string[], entrada: ISODateTime, saida: ISODateTime) =>
    simularChamada('pedido.disponibilidade', () =>
      disponibilidadeNoApp(tutorId, petIds, entrada, saida),
    ),
  disponibilidadePublica: (
    especie: string,
    porte: PorteNoContrato | null,
    entrada: ISODateTime,
    saida: ISODateTime,
  ) =>
    simularChamada('pedido.disponibilidade', () =>
      disponibilidadePublica(especie, porte, entrada, saida),
    ),
  pedir: (tutorId: string, entrada: CriarPedidoDeReserva) =>
    simularChamada('pedido.enviar', () => pedirPeloApp(tutorId, entrada)),
  pedirPeloLink: (entrada: CriarPedidoDeReservaPeloLink) =>
    simularChamada('pedido.enviar', () => pedirPeloLink(entrada)),
  pedidos: (tutorId: string) =>
    simularChamada('pedido.disponibilidade', () => pedidosDoResponsavel(tutorId)),
  pedidoPorToken: (token: string) =>
    simularChamada('pedido.disponibilidade', () => pedidoPorToken(token)),
  cancelarPedido: (pedidoId: string) =>
    simularChamada('pedido.enviar', () => cancelarPedido(pedidoId)),
  completarPorte: (tutorId: string, petId: string, porte: PetPorte) =>
    simularChamada('pedido.enviar', () => completarPorte(tutorId, petId, porte)),
  /** Síncronas: a conta já está no aparelho, e o aviso chega por push. */
  petsDaConta,
  estadias,
  avisos: (tutorId: string): AvisoDoPedidoDeReserva[] =>
    getDataset()
      .avisosDoPedido.filter((aviso) => aviso.tutorId === tutorId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
}

// ---------------------------------------------------------------------------
// O lado do hotel — a caixa de pedidos do balcão
// ---------------------------------------------------------------------------

function petsDoPedido(pedido: PedidoDeReserva): PetDaVaga[] {
  if (pedido.novoCadastro && !pedido.petId) {
    return [{ especie: pedido.novoCadastro.especie, porte: pedido.novoCadastro.porte }]
  }

  return [pedido.petId, pedido.acompanhantePetId]
    .filter((id): id is string => Boolean(id))
    .map((id) => petEmQualquerLugar(id))
    .filter((pet): pet is Pet => pet !== null)
    .map((pet) => ({ especie: pet.especie, porte: pet.porte }))
}

function sugestoesPara(pedido: PedidoDeReserva, limite: number): SugestaoDeAcomodacao[] {
  const dataset = getDataset()

  return melhoresAcomodacoes({
    acomodacoes: dataset.acomodacoes,
    tipos: dataset.tiposDeAcomodacao,
    reservas: dataset.reservas,
    pedidos: dataset.pedidosDeReserva,
    pets: petsDoPedido(pedido),
    inicio: pedido.entrada,
    fim: pedido.saida,
    tipoIds: configuracao().tipoIds,
    ignorarPedidoId: pedido.id,
    chegouAntesDe: pedido.criadoEm,
    tipoPreferido: pedido.tipoId,
    aceitaMudarUmDia: pedido.aceitaMudarUmDia,
    limite,
  })
}

/**
 * As opções para outro período — quando o balcão toca outras datas no calendário da gaveta. Sem o
 * "aceita mudar um dia": as datas já são as que o balcão escolheu.
 */
function sugestoesNoPeriodo(
  pedido: PedidoDeReserva,
  inicio: ISODateTime,
  fim: ISODateTime,
  limite: number,
): SugestaoDeAcomodacao[] {
  const dataset = getDataset()

  return melhoresAcomodacoes({
    acomodacoes: dataset.acomodacoes,
    tipos: dataset.tiposDeAcomodacao,
    reservas: dataset.reservas,
    pedidos: dataset.pedidosDeReserva,
    pets: petsDoPedido(pedido),
    inicio,
    fim,
    tipoIds: configuracao().tipoIds,
    ignorarPedidoId: pedido.id,
    chegouAntesDe: pedido.criadoEm,
    tipoPreferido: pedido.tipoId,
    aceitaMudarUmDia: false,
    limite,
  })
}

/**
 * Cada noite de `de` a `ate`: sobra unidade para estes pets — no tipo que pediram, ou em qualquer
 * tipo quando o hotel escolhe? É o ponto do calendário da gaveta, com a hora de entrada e de saída
 * do próprio pedido.
 */
function noitesDoPedido(pedido: PedidoDeReserva, de: ISODate, ate: ISODate) {
  const dataset = getDataset()
  const offset = offsetDe(pedido.entrada)
  const tipoIds = pedido.tipoId ? [pedido.tipoId] : configuracao().tipoIds
  const noites: Record<ISODate, 'livre' | 'cheio'> = {}

  for (let data = de; data <= ate; data = addDays(data, 1)) {
    const livres = unidadesLivres({
      acomodacoes: dataset.acomodacoes,
      tipos: dataset.tiposDeAcomodacao,
      reservas: dataset.reservas,
      pedidos: dataset.pedidosDeReserva,
      pets: petsDoPedido(pedido),
      inicio: instante(data, horaDe(pedido.entrada), offset),
      fim: instante(addDays(data, 1), horaDe(pedido.saida), offset),
      tipoIds,
      ignorarPedidoId: pedido.id,
      chegouAntesDe: pedido.criadoEm,
    })

    noites[data] = livres.length > 0 ? 'livre' : 'cheio'
  }

  return noites
}

function pedidoDeReservaPorId(pedidoId: string) {
  return getDataset().pedidosDeReserva.find((item) => item.id === pedidoId) ?? null
}

/** Uma linha da caixa: o pedido e o que o balcão precisa para responder. */
export type PedidoDeReservaNaCaixa = {
  pedido: PedidoDeReserva
  /** Tipo escolhido ainda tem unidade — contando só quem pediu antes. */
  tipoTemVaga: boolean
  /** A unidade que o aceite gravaria. `null` quando não há nenhuma. */
  sugestao: SugestaoDeAcomodacao | null
  /** A estimativa da estadia na sugestão, em centavos. */
  estimativaCentavos: number | null
  token: string | null
  /** Depois do aceite: a reserva criada. */
  reserva: { acomodacao: string; totalCentavos: number; status: Reserva['status'] } | null
  /**
   * Outra reserva viva do mesmo animal que cruza o período pedido (a Luna, reservada até 07/11 às
   * 12:00, pedindo de 07/11 às 10:00). Aceitar daria duas baias ao mesmo cão: o balcão altera a
   * reserva que existe, ou recusa este pedido.
   */
  reservaDoAnimal: {
    id: string
    acomodacao: string
    entrada: ISODateTime
    saida: ISODateTime
  } | null
}

/** A reserva viva dos pets já cadastrados do pedido que cruza o período dele. */
function reservaDoAnimalNoPedido(pedido: PedidoDeReserva) {
  const dataset = getDataset()
  const existente = reservaDoAnimalNoPeriodo(
    dataset.reservas,
    [pedido.petId ?? '', pedido.acompanhantePetId ?? ''],
    pedido.entrada,
    pedido.saida,
  )

  return existente
    ? {
        id: existente.id,
        acomodacao:
          dataset.acomodacoes.find((item) => item.id === existente.acomodacaoId)?.nome ?? '',
        entrada: existente.entradaPrevista,
        saida: existente.saidaPrevista,
      }
    : null
}

function caixa(): PedidoDeReservaNaCaixa[] {
  const dataset = getDataset()

  expirar()

  return dataset.pedidosDeReserva.map((pedido) => {
    const pendente = pedido.status === 'pendente'
    const [sugestao] = pendente ? sugestoesPara(pedido, 1) : []
    const reserva = pedido.reservaId
      ? dataset.reservas.find((item) => item.id === pedido.reservaId)
      : null
    const pets = petsDoPedido(pedido)

    return {
      pedido: { ...pedido },
      tipoTemVaga:
        pendente &&
        pedido.tipoId !== null &&
        sugestao !== undefined &&
        sugestao.tipo.id === pedido.tipoId &&
        !sugestao.mudouAData,
      sugestao: sugestao ?? null,
      estimativaCentavos: sugestao
        ? (orcamentoEm(
            sugestao.acomodacao,
            pets,
            sugestao.inicio,
            sugestao.fim,
            servicosContratados(pedido.servicos, contarDiarias(sugestao.inicio, sugestao.fim)),
          )?.totalCentavos ?? null)
        : null,
      token: dataset.tokensDoLink[pedido.id] ?? null,
      reservaDoAnimal: pendente ? reservaDoAnimalNoPedido(pedido) : null,
      reserva: reserva
        ? {
            acomodacao:
              dataset.acomodacoes.find((item) => item.id === reserva.acomodacaoId)?.nome ?? '',
            totalCentavos: reserva.orcamento.totalCentavos,
            status: reserva.status,
          }
        : null,
    }
  })
}

/** O pet que o hotel ainda não conhece entra no cadastro agora — o vínculo nasce no aceite. */
function cadastrarSePreciso(pedido: PedidoDeReserva) {
  const dataset = getDataset()

  if (!pedido.novoCadastro) {
    return
  }

  if (pedido.petId) {
    const conta = dataset.contasSoNoApp.find((item) => item.tutor.id === pedido.tutorId)

    if (conta && !dataset.tutores.some((tutor) => tutor.id === conta.tutor.id)) {
      dataset.tutores.push({ ...conta.tutor })
    }

    for (const id of [pedido.petId, pedido.acompanhantePetId]) {
      const pet = conta?.pets.find((item) => item.id === id)

      if (pet && !dataset.pets.some((item) => item.id === pet.id)) {
        dataset.pets.push({ ...pet, alertas: [...pet.alertas] })
      }
    }

    return
  }

  const cadastro: CadastroMinimoDaReserva = pedido.novoCadastro
  let tutorId = pedido.tutorId

  if (!tutorId) {
    tutorId = novoId('tutor')
    dataset.tutores.push({
      id: tutorId,
      nome: cadastro.nome,
      telefone: cadastro.telefone,
      telefoneSecundario: '',
      email: '',
      documento: '',
      preferenciaContato: 'whatsapp',
      endereco: null,
    })
  }

  const petId = novoId('pet')

  dataset.pets.push({
    id: petId,
    nome: cadastro.petNome,
    especie: cadastro.especie,
    raca: '',
    sexo: null,
    nascimento: null,
    castrado: false,
    porte: cadastro.porte,
    pesoKg: null,
    microchip: '',
    pelagem: '',
    tutorId,
    alertas: [],
    iniciais: cadastro.petNome.slice(0, 2).toUpperCase(),
    fotoUrl: '',
  })

  pedido.tutorId = tutorId
  pedido.petId = petId
}

function avisar(
  pedido: PedidoDeReserva,
  tipo: AvisoDoPedidoDeReserva['tipo'],
  reserva: Reserva | null,
) {
  const dataset = getDataset()
  const nomes = [pedido.petId, pedido.acompanhantePetId]
    .filter((id): id is string => Boolean(id))
    .map((id) => petEmQualquerLugar(id)?.nome ?? pedido.novoCadastro?.petNome ?? '')
  const texto = textoPtDaNotificacaoDaReserva({
    tipo:
      tipo === 'aceito'
        ? 'RESERVA_PEDIDO_ACEITO'
        : tipo === 'alocado'
          ? 'RESERVA_PEDIDO_ALOCADO'
          : 'RESERVA_PEDIDO_RECUSADO',
    petNomes: nomes.length > 0 ? nomes : [pedido.novoCadastro?.petNome ?? ''],
    hotelNome: dataset.hotel.nome,
    entrada: reserva?.entradaPrevista ?? null,
    saida: reserva?.saidaPrevista ?? null,
    acomodacao: reserva
      ? (dataset.acomodacoes.find((item) => item.id === reserva.acomodacaoId)?.nome ?? null)
      : null,
  })
  const tutor = pedido.tutorId ? tutorEmQualquerLugar(pedido.tutorId) : null
  const token = dataset.tokensDoLink[pedido.id]

  dataset.avisosDoPedido.push({
    id: novoId('aviso'),
    pedidoId: pedido.id,
    tutorId: pedido.canal === 'app' ? pedido.tutorId : null,
    canal: pedido.canal,
    telefone: tutor?.telefone ?? pedido.novoCadastro?.telefone ?? '',
    tipo,
    criadoEm: agoraIso(),
    titulo: texto.titulo,
    corpo:
      pedido.canal === 'link' && token
        ? `${texto.corpo} Acompanhe: /reservar/${configuracao().slug}?pedido=${token}`
        : texto.corpo,
  })
}

/**
 * Aceita — na unidade que o balcão escolheu, ou na melhor sugestão. Confere a vaga de novo antes de
 * gravar, com a mesma função do mapa: o mapa não parou enquanto alguém lia o pedido.
 */
function aceitar(
  pedidoId: string,
  escolha: { acomodacaoId: string; inicio: ISODateTime; fim: ISODateTime } | null,
): Reserva {
  const dataset = getDataset()
  const pedido = dataset.pedidosDeReserva.find((item) => item.id === pedidoId)

  if (!pedido || pedido.status !== 'pendente') {
    throw new ErroDaReservaOnline('PEDIDO_JA_RESPONDIDO')
  }

  const destino =
    escolha ??
    (() => {
      const [melhor] = sugestoesPara(pedido, 1)

      return melhor
        ? { acomodacaoId: melhor.acomodacao.id, inicio: melhor.inicio, fim: melhor.fim }
        : null
    })()

  if (!destino) {
    throw new ErroDaReservaOnline('SEM_VAGA_NO_TIPO')
  }

  const pets = petsDoPedido(pedido)
  const acomodacao = dataset.acomodacoes.find((item) => item.id === destino.acomodacaoId)
  const livre = unidades(pets, destino.inicio, destino.fim, pedido).some(
    (item) => item.acomodacao.id === destino.acomodacaoId,
  )

  if (!acomodacao || !livre) {
    throw new ErroDaReservaOnline('SEM_VAGA_NO_TIPO')
  }

  /* O mesmo animal não dorme em duas baias: a mesma regra da reserva de balcão. */
  if (
    reservaDoAnimalNoPeriodo(
      dataset.reservas,
      [pedido.petId ?? '', pedido.acompanhantePetId ?? ''],
      destino.inicio,
      destino.fim,
    )
  ) {
    throw new VagaIndisponivelError('animal-ja-reservado')
  }

  cadastrarSePreciso(pedido)

  const diarias = contarDiarias(destino.inicio, destino.fim)
  const servicos = servicosContratados(pedido.servicos, diarias)
  const orcamento = orcamentoEm(acomodacao, pets, destino.inicio, destino.fim, servicos)!
  const agora = agoraIso()
  const reserva: Reserva = {
    id: novoId('res'),
    petId: pedido.petId!,
    tutorId: pedido.tutorId!,
    acompanhantePetId: pedido.acompanhantePetId,
    acomodacaoId: acomodacao.id,
    entradaPrevista: destino.inicio,
    saidaPrevista: destino.fim,
    diarias,
    /* Como toda reserva da casa: nasce pendente, e o sinal a confirma. */
    status: 'pendente',
    origem: pedido.canal,
    servicos,
    orcamento,
    pagoCentavos: 0,
    observacao: pedido.observacao,
    autorizadosARetirar: [],
    dispensas: [],
    criadoEm: agora,
    atualizadoEm: agora,
    canceladaEm: null,
    motivoCancelamento: null,
  }

  dataset.reservas.push(reserva)

  const mudou =
    pedido.modo === 'hotel-escolhe' ||
    acomodacao.tipoId !== pedido.tipoId ||
    destino.inicio !== pedido.entrada ||
    destino.fim !== pedido.saida

  pedido.status = 'aceito'
  pedido.respondidoEm = agora
  pedido.respondidoPor = 'recepcao'
  pedido.reservaId = reserva.id

  avisar(pedido, mudou ? 'alocado' : 'aceito', reserva)

  return { ...reserva }
}

function recusar(pedidoId: string, motivo: MotivoDaRecusaDaReserva, mensagem: string) {
  const pedido = getDataset().pedidosDeReserva.find((item) => item.id === pedidoId)

  if (!pedido || pedido.status !== 'pendente') {
    throw new ErroDaReservaOnline('PEDIDO_JA_RESPONDIDO')
  }

  pedido.status = 'recusado'
  pedido.respondidoEm = agoraIso()
  pedido.respondidoPor = 'recepcao'
  pedido.recusa = { motivo, mensagem: mensagem.trim() }
  avisar(pedido, 'recusado', null)

  return { ...pedido }
}

export const pedidoDeReservaRepository = {
  listar: () => simularChamada('pedido.listar', caixa),
  sugestoes: (pedidoId: string, limite = 8) =>
    simularChamada('pedido.listar', () => {
      const pedido = getDataset().pedidosDeReserva.find((item) => item.id === pedidoId)

      return pedido ? sugestoesPara(pedido, limite) : []
    }),
  sugestoesNoPeriodo: (pedidoId: string, inicio: ISODateTime, fim: ISODateTime, limite = 8) =>
    simularChamada('pedido.listar', () => {
      const pedido = pedidoDeReservaPorId(pedidoId)

      return pedido ? sugestoesNoPeriodo(pedido, inicio, fim, limite) : []
    }),
  noites: (pedidoId: string, de: ISODate, ate: ISODate) =>
    simularChamada('pedido.listar', () => {
      const pedido = pedidoDeReservaPorId(pedidoId)

      return pedido ? noitesDoPedido(pedido, de, ate) : {}
    }),
  aceitar: (
    pedidoId: string,
    escolha: { acomodacaoId: string; inicio: ISODateTime; fim: ISODateTime } | null = null,
  ) => simularChamada('pedido.responder', () => aceitar(pedidoId, escolha)),
  recusar: (pedidoId: string, motivo: MotivoDaRecusaDaReserva, mensagem: string) =>
    simularChamada('pedido.responder', () => recusar(pedidoId, motivo, mensagem)),
  /** A estimativa de uma unidade para um pedido — o número que o diálogo de alocação mostra. */
  estimativa: (pedidoId: string, acomodacaoId: string, inicio: ISODateTime, fim: ISODateTime) => {
    const dataset = getDataset()
    const pedido = dataset.pedidosDeReserva.find((item) => item.id === pedidoId)
    const acomodacao = dataset.acomodacoes.find((item) => item.id === acomodacaoId)

    if (!pedido || !acomodacao) {
      return null
    }

    return (
      orcamentoEm(
        acomodacao,
        petsDoPedido(pedido),
        inicio,
        fim,
        servicosContratados(pedido.servicos, contarDiarias(inicio, fim)),
      )?.totalCentavos ?? null
    )
  },
  configuracao: (): ReservaOnline => JSON.parse(JSON.stringify(configuracao())) as ReservaOnline,
  salvarConfiguracao: (nova: ReservaOnline) =>
    simularChamada('pedido.responder', () => {
      /* JSON, e não structuredClone: o que chega da tela pode ser um proxy reativo. */
      getDataset().reservaOnline = JSON.parse(JSON.stringify(nova)) as ReservaOnline

      return JSON.parse(JSON.stringify(nova)) as ReservaOnline
    }),
  hotel: () => {
    const { hotel } = getDataset()

    return { nome: hotel.nome, telefone: hotel.telefone, endereco: hotel.endereco }
  },
  /** Os que esperam resposta — o selo do menu. Passa pela rede como as outras fontes do selo. */
  pendentes: (): Promise<PedidoDeReserva[]> =>
    simularChamada('pedido.listar', () => {
      expirar()

      return getDataset().pedidosDeReserva.filter((pedido) => pedido.status === 'pendente')
    }),
}

/** Datas úteis para a busca — exportadas para o fluxo montar a entrada padrão. */
export function sugestaoDePeriodo(): { entrada: string; saida: string } {
  const hoje = hojeIso()

  return { entrada: addDays(hoje, 7), saida: addDays(hoje, 10) }
}
