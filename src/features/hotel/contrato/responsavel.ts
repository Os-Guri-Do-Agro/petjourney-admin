/**
 * Contrato da reserva online do hotel — visão do responsável.
 *
 * A forma no fio entre a API e os dois clientes: o portal do hotel (este repositório) e o app do
 * responsável (`petjourney-app`), mais a página pública do hotel para quem não tem o app. As mesmas
 * regras de forma do contrato clínico (`features/clinico/contrato/responsavel.ts`): ids `cuid`,
 * data e hora em ISO 8601 com o offset do hotel, enum em MAIÚSCULAS, chave omitida em vez de
 * `null` onde o DTO usa `@IsOptional`.
 *
 * **Este arquivo é a fonte.** O app copia como está; mudança começa aqui. Especificação em
 * `docs/hotel/03-reserva-online.md`.
 */

import type {
  Cuid,
  DataHoraIso,
  DataIso,
  EspecieNaClinica,
  HoraDoDia,
  IdiomaDoTexto,
  PetResumo,
} from '@/features/clinico/contrato/responsavel'

export type { Cuid, DataHoraIso, DataIso, HoraDoDia, IdiomaDoTexto, PetResumo }

export const MODOS_DO_PEDIDO_DE_RESERVA = ['ACOMODACAO_ESCOLHIDA', 'HOTEL_ESCOLHE'] as const
export type ModoDoPedidoDeReservaNoContrato = (typeof MODOS_DO_PEDIDO_DE_RESERVA)[number]

export const STATUS_DO_PEDIDO_DE_RESERVA = [
  'AGUARDANDO_HOTEL',
  'ACEITO',
  'RECUSADO',
  'CANCELADO_PELO_RESPONSAVEL',
  /** A data de entrada chegou sem resposta. */
  'EXPIRADO',
] as const
export type StatusDoPedidoDeReservaNoContrato = (typeof STATUS_DO_PEDIDO_DE_RESERVA)[number]

export const MOTIVOS_DE_RECUSA_DA_RESERVA = ['SEM_VAGA', 'EXIGENCIAS', 'PERFIL', 'OUTRO'] as const
export type MotivoDeRecusaDaReserva = (typeof MOTIVOS_DE_RECUSA_DA_RESERVA)[number]

/** Os extras que se pedem junto da estadia. O preço vem do hotel, nunca do app. */
export const SERVICOS_NO_PEDIDO = ['BANHO', 'TOSA', 'PASSEIO_EXTRA'] as const
export type ServicoNoPedido = (typeof SERVICOS_NO_PEDIDO)[number]

export const PORTES_NO_CONTRATO = ['MINI', 'PEQUENO', 'MEDIO', 'GRANDE', 'GIGANTE'] as const
export type PorteNoContrato = (typeof PORTES_NO_CONTRATO)[number]

export type CodigoDeErroDaReserva =
  | 'SEM_VAGA_NO_TIPO'
  | 'HOTEL_NAO_RECEBE_PEDIDOS'
  | 'MODO_INDISPONIVEL'
  /** Entrada antes da antecedência mínima: é urgência, vai por telefone. */
  | 'FORA_DA_ANTECEDENCIA'
  | 'PERIODO_INVALIDO'
  | 'CADASTRO_INCOMPLETO'
  /** Dois pets que não dividem acomodação (espécies diferentes, ou porte que não cabe). */
  | 'NAO_DIVIDEM_ACOMODACAO'
  | 'PEDIDO_JA_RESPONDIDO'

/** O que o hotel exige na entrada, e como o pet está — o app mostra antes de pedir. */
export type ExigenciaNoPedido = {
  exigencia: string
  /** Bloqueia a entrada se faltar. As outras o hotel pede, mas aceita sem. */
  bloqueia: boolean
  situacao: 'OK' | 'VENCE_DURANTE' | 'VENCIDO' | 'AUSENTE'
}

export type TipoDisponivel = {
  tipoId: Cuid
  nome: string
  /** Quantas unidades servem a estes pets, nestas datas. Zero é esgotado. */
  livres: number
  /** A estimativa da estadia inteira neste tipo, em centavos, para estes pets. */
  estimativaCentavos: number
  diarias: number
  recursos: Array<'CAMERA' | 'CLIMATIZACAO' | 'AREA_EXTERNA' | 'PISO_AQUECIDO' | 'JANELA'>
}

export type BuscarDisponibilidade = {
  petIds: Cuid[]
  entrada: DataHoraIso
  saida: DataHoraIso
}

export type DisponibilidadeDoPeriodo = {
  diarias: number
  tipos: TipoDisponivel[]
  exigencias: Array<{ petId: Cuid; itens: ExigenciaNoPedido[] }>
}

export type ReservaOnlineDoHotel = {
  hotel: { id: Cuid; nome: string; telefone: string; endereco: string; utcOffset: string }
  recebePedidos: boolean
  modos: ModoDoPedidoDeReservaNoContrato[]
  prazoDeRespostaHoras: number
  antecedenciaMinimaHoras: number
  horizonteDias: number
  horarioDeEntrada: HoraDoDia
  horarioDeSaida: HoraDoDia
  sinalPercentual: number
  cancelamentoSemCustoDias: number
  /** O balcão responde neste horário — o prazo só anda nele. */
  balcao: { abre: HoraDoDia; fecha: HoraDoDia }
  servicos: Array<{ servico: ServicoNoPedido; precoCentavos: number; porDiaria: boolean }>
  urgencia: {
    telefone: string
    whatsapp: string | null
    orientacao: string
    idiomaDaOrientacao: IdiomaDoTexto
  }
}

export type CriarPedidoDeReserva = {
  modo: ModoDoPedidoDeReservaNoContrato
  /** 1 ou 2, da mesma casa, na mesma acomodação. */
  petIds: Cuid[]
  entrada: DataHoraIso
  saida: DataHoraIso
  /** Obrigatório em `ACOMODACAO_ESCOLHIDA`. */
  tipoId?: Cuid
  /** Em `HOTEL_ESCOLHE`: aceita entrar um dia antes ou depois. */
  aceitaMudarUmDia?: boolean
  servicos?: ServicoNoPedido[]
  observacao?: string
}

export type VisitanteDaReserva = {
  nome: string
  telefone: string
  petNome: string
  especie: EspecieNaClinica
  porte?: PorteNoContrato
}

export type CriarPedidoDeReservaPeloLink = Omit<CriarPedidoDeReserva, 'petIds'> & {
  visitante: VisitanteDaReserva
}

export type PedidoDeReservaNoContrato = {
  id: Cuid
  canal: 'APP' | 'LINK_PUBLICO'
  modo: ModoDoPedidoDeReservaNoContrato
  pets: PetResumo[]
  entrada: DataHoraIso
  saida: DataHoraIso
  diarias: number
  tipoPedido: { tipoId: Cuid; nome: string } | null
  servicos: ServicoNoPedido[]
  observacao: string
  status: StatusDoPedidoDeReservaNoContrato
  criadoEm: DataHoraIso
  responderAte: DataHoraIso
  /** Depois do aceite: a reserva, a acomodação e o que falta pagar para confirmar. */
  reserva: {
    id: Cuid
    acomodacao: string
    entrada: DataHoraIso
    saida: DataHoraIso
    totalCentavos: number
    sinalCentavos: number
  } | null
  recusa: {
    motivo: MotivoDeRecusaDaReserva
    mensagemDoHotel: string
    idiomaDaMensagem: IdiomaDoTexto
  } | null
  podeCancelar: boolean
}

export type PedidoDeReservaPeloLink = PedidoDeReservaNoContrato & { token: string }

export const ROTAS_DA_RESERVA_ONLINE = {
  reservaOnline: 'GET /tutor/hotel/hoteis/:hotelId/reserva-online', // ReservaOnlineDoHotel
  disponibilidade: 'GET /tutor/hotel/hoteis/:hotelId/disponibilidade', // BuscarDisponibilidade → DisponibilidadeDoPeriodo
  pedir: 'POST /tutor/hotel/pedidos', // CriarPedidoDeReserva → PedidoDeReservaNoContrato [SEM_VAGA_NO_TIPO, FORA_DA_ANTECEDENCIA, NAO_DIVIDEM_ACOMODACAO]
  pedidos: 'GET /tutor/hotel/pedidos', // PedidoDeReservaNoContrato[]
  cancelarPedido: 'POST /tutor/hotel/pedidos/:id/cancelar', // PedidoDeReservaNoContrato [PEDIDO_JA_RESPONDIDO]
  hotelPublico: 'GET /publico/hoteis/:slug', // ReservaOnlineDoHotel
  disponibilidadePublica: 'GET /publico/hoteis/:slug/disponibilidade', // espécie e porte no lugar de petIds
  pedirPublico: 'POST /publico/hoteis/:slug/pedidos', // CriarPedidoDeReservaPeloLink → PedidoDeReservaPeloLink
  pedidoPublico: 'GET /publico/reservas/:token', // PedidoDeReservaPeloLink
  cancelarPedidoPublico: 'POST /publico/reservas/:token/cancelar', // PedidoDeReservaPeloLink
} as const

export const TIPOS_DE_NOTIFICACAO_DA_RESERVA = [
  /** Tipo escolhido, aceito; a reserva espera o sinal. */
  'RESERVA_PEDIDO_ACEITO',
  /** O hotel alocou outra acomodação ou mexeu um dia nas datas. */
  'RESERVA_PEDIDO_ALOCADO',
  'RESERVA_PEDIDO_RECUSADO',
] as const
export type TipoDeNotificacaoDaReserva = (typeof TIPOS_DE_NOTIFICACAO_DA_RESERVA)[number]

export const ROTA_DA_NOTIFICACAO_DA_RESERVA = '/screens/hotel/pedido'

/** "14/10" — o dia, sem conversão de fuso: o horário é o do hotel. */
function dia(iso: DataHoraIso): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function nomesDosPets(nomes: string[]): string {
  return nomes.length <= 1
    ? (nomes[0] ?? '')
    : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/** Texto em português do push — o que o backend põe no catálogo. Sem preposição antes do nome. */
export function textoPtDaNotificacaoDaReserva(dados: {
  tipo: TipoDeNotificacaoDaReserva
  petNomes: string[]
  hotelNome: string
  entrada: DataHoraIso | null
  saida: DataHoraIso | null
  acomodacao: string | null
}): { titulo: string; corpo: string } {
  const periodo = dados.entrada && dados.saida ? `${dia(dados.entrada)} a ${dia(dados.saida)}` : ''

  switch (dados.tipo) {
    case 'RESERVA_PEDIDO_ACEITO':
      return {
        titulo: `Hospedagem aceita: ${nomesDosPets(dados.petNomes)}`,
        corpo: `${periodo} · ${dados.acomodacao ?? ''} · ${dados.hotelNome}. Falta o sinal para confirmar.`,
      }
    case 'RESERVA_PEDIDO_ALOCADO':
      return {
        titulo: `O hotel reservou para ${nomesDosPets(dados.petNomes)}`,
        corpo: `${periodo} · ${dados.acomodacao ?? ''} · ${dados.hotelNome}. Confira e envie o sinal.`,
      }
    default:
      return {
        titulo: `O hotel não conseguiu reservar para ${nomesDosPets(dados.petNomes)}`,
        corpo: `${dados.hotelNome}. Toque para ver a mensagem.`,
      }
  }
}
