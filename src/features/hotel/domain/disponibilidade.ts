/**
 * Regra R2 — duas estadias não ocupam a mesma acomodação, e entre elas existe higienização.
 *
 * Sobreposição de reserva é o defeito que destrói a confiança num sistema de hospedagem, e ele
 * quase nunca é "duas reservas exatamente no mesmo dia": é a saída do dia 20 às 18h contra a
 * entrada do dia 20 às 8h. Por isso a checagem é por **instante** e soma a janela de higienização
 * da acomodação — o tempo que a baia leva para ser lavada e secar.
 *
 * A vaga oferecida ao telefone é a vaga que o mapa mostra. Não há segunda fonte: as duas telas
 * chamam a mesma função deste arquivo.
 */

import type {
  Acomodacao,
  AcomodacaoKind,
  ISODateTime,
  PetPorte,
  PetSpecies,
  Reserva,
} from '../data/types'

import { cruzam, maisMinutos } from './hotel-time'

/** Ordem de porte, para "cabe em". Índice, nunca comparação de texto. */
const ORDEM_DE_PORTE: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']

export function portesAte(maximo: PetPorte): PetPorte[] {
  return ORDEM_DE_PORTE.slice(0, ORDEM_DE_PORTE.indexOf(maximo) + 1)
}

export function porteCabe(porte: PetPorte | null, maximo: PetPorte): boolean {
  /*
   * Porte não informado **cabe em qualquer lugar**, e é a resposta certa: recusar a reserva de um
   * animal cujo cadastro não tem porte mandaria a recepção inventar um valor para poder vender —
   * e o valor inventado fica no cadastro para sempre.
   */
  if (porte === null) {
    return true
  }

  return ORDEM_DE_PORTE.indexOf(porte) <= ORDEM_DE_PORTE.indexOf(maximo)
}

/**
 * Por que uma acomodação não serve.
 *
 * `kind` e não texto: é o que permite a tela dizer "não aceita gatos" em seis idiomas, e o que
 * permite contar quantas buscas por vaga morrem por porte — que é a pergunta que decide se a casa
 * precisa de mais baia grande.
 */
export type ImpedimentoDeVaga =
  | 'inativa'
  | 'porte'
  | 'especie'
  | 'capacidade'
  | 'ocupada'
  | 'higienizacao'

export type SituacaoNoPeriodo =
  | 'livre'
  | 'ocupada'
  | 'reservada'
  | 'higienizacao'
  | 'fora-de-operacao'

/** Uma acomodação vista através de um período. */
export type VagaNoPeriodo = {
  acomodacao: Acomodacao
  situacao: SituacaoNoPeriodo
  /** Vazio quando serve. A ordem é a da checagem, e a primeira é a que a tela mostra. */
  impedimentos: ImpedimentoDeVaga[]
  /** As reservas que ocupam o período, para a tela poder levar a elas. */
  conflitos: Reserva[]
}

/** Reservas que de fato seguram uma vaga. Cancelada e não comparecida liberaram o lugar. */
export function reservaSegura(reserva: Reserva): boolean {
  return (
    reserva.status === 'pendente' ||
    reserva.status === 'confirmada' ||
    reserva.status === 'hospedado'
  )
}

/**
 * As reservas que cruzam um período numa acomodação, já com a higienização somada.
 *
 * A janela é somada ao **fim** da reserva existente e não ao início da nova: é a acomodação que
 * precisa de tempo depois de ser desocupada, e somar dos dois lados cobraria a higienização duas
 * vezes, tirando do mapa uma vaga que existe.
 */
export function reservasQueCruzam(
  reservas: Reserva[],
  acomodacao: Acomodacao,
  inicio: ISODateTime,
  fim: ISODateTime,
  ignorarReservaId?: string,
): Reserva[] {
  return reservas.filter((reserva) => {
    if (reserva.acomodacaoId !== acomodacao.id || !reservaSegura(reserva)) {
      return false
    }

    if (ignorarReservaId && reserva.id === ignorarReservaId) {
      return false
    }

    const liberaEm = maisMinutos(reserva.saidaPrevista, acomodacao.higienizacaoMinutos)

    return cruzam(inicio, fim, reserva.entradaPrevista, liberaEm)
  })
}

/**
 * A acomodação serve para este hóspede, neste período?
 *
 * Devolve **todos** os impedimentos e não só o primeiro. Uma tela que diz "não aceita gatos" e,
 * corrigido isso, diz "porte" e depois "ocupada" faz a recepção tentar três vezes ao telefone —
 * e a terceira acontece com o cliente já irritado.
 */
export function avaliarVaga(entrada: {
  acomodacao: Acomodacao
  reservas: Reserva[]
  inicio: ISODateTime
  fim: ISODateTime
  porte?: PetPorte | null
  especie?: PetSpecies | null
  /** Quantos animais vão ocupar. Dois da mesma casa exigem capacidade 2. */
  ocupantes?: number
  ignorarReservaId?: string
}): VagaNoPeriodo {
  const { acomodacao } = entrada
  const impedimentos: ImpedimentoDeVaga[] = []

  if (!acomodacao.ativa) {
    impedimentos.push('inativa')
  }

  if (entrada.porte !== undefined && !porteCabe(entrada.porte ?? null, acomodacao.porteMaximo)) {
    impedimentos.push('porte')
  }

  if (
    entrada.especie &&
    acomodacao.especiesAceitas.length > 0 &&
    !acomodacao.especiesAceitas.includes(entrada.especie)
  ) {
    impedimentos.push('especie')
  }

  if ((entrada.ocupantes ?? 1) > acomodacao.capacidade) {
    impedimentos.push('capacidade')
  }

  const conflitos = reservasQueCruzam(
    entrada.reservas,
    acomodacao,
    entrada.inicio,
    entrada.fim,
    entrada.ignorarReservaId,
  )

  /*
   * Ocupada e "em higienização" são o mesmo conflito com consequências diferentes para quem lê:
   * a primeira diz "tem alguém lá", a segunda diz "vai estar livre, só não nessa hora". Sem a
   * distinção, a recepção ofereceria o dia seguinte quando bastava oferecer a tarde.
   */
  if (conflitos.length > 0) {
    const emHigienizacao = conflitos.every(
      (reserva) => Date.parse(reserva.saidaPrevista) <= Date.parse(entrada.inicio),
    )

    impedimentos.push(emHigienizacao ? 'higienizacao' : 'ocupada')
  }

  return {
    acomodacao,
    situacao: situacaoDe(acomodacao, impedimentos, conflitos),
    impedimentos,
    conflitos,
  }
}

function situacaoDe(
  acomodacao: Acomodacao,
  impedimentos: ImpedimentoDeVaga[],
  conflitos: Reserva[],
): SituacaoNoPeriodo {
  if (!acomodacao.ativa) {
    return 'fora-de-operacao'
  }

  if (impedimentos.includes('higienizacao')) {
    return 'higienizacao'
  }

  if (conflitos.length > 0) {
    return conflitos.some((reserva) => reserva.status === 'hospedado') ? 'ocupada' : 'reservada'
  }

  return 'livre'
}

/**
 * O mapa inteiro visto através de um período.
 *
 * Ordena por bloco e por nome — a casa tem uma ordem física e a tela a respeita. Quem procura a
 * suíte 3 procura entre a 2 e a 4, não no meio de uma lista ordenada por disponibilidade.
 */
export function mapaDoPeriodo(entrada: {
  acomodacoes: Acomodacao[]
  reservas: Reserva[]
  inicio: ISODateTime
  fim: ISODateTime
  porte?: PetPorte | null
  especie?: PetSpecies | null
  ocupantes?: number
  kinds?: AcomodacaoKind[]
  ignorarReservaId?: string
}): VagaNoPeriodo[] {
  const filtradas = entrada.kinds?.length
    ? entrada.acomodacoes.filter((item) => entrada.kinds?.includes(item.kind))
    : entrada.acomodacoes

  return filtradas.map((acomodacao) =>
    avaliarVaga({
      acomodacao,
      reservas: entrada.reservas,
      inicio: entrada.inicio,
      fim: entrada.fim,
      porte: entrada.porte,
      especie: entrada.especie,
      ocupantes: entrada.ocupantes,
      ignorarReservaId: entrada.ignorarReservaId,
    }),
  )
}

/** As que servem, na ordem em que a recepção deveria oferecê-las. */
export function vagasLivres(vagas: VagaNoPeriodo[]): VagaNoPeriodo[] {
  /*
   * Serve = nenhum impedimento. Ordenar por `kind` aqui seria adivinhar a política comercial da
   * casa (oferecer a suíte primeiro? a mais barata?); a ordem física já é uma resposta defensável
   * e não inventa uma regra que ninguém pediu.
   */
  return vagas.filter((vaga) => vaga.impedimentos.length === 0)
}

/** Taxa de ocupação do período: quantas das que operam estão comprometidas. */
export function taxaDeOcupacao(vagas: VagaNoPeriodo[]): number {
  const operando = vagas.filter((vaga) => vaga.acomodacao.ativa)

  if (operando.length === 0) {
    return 0
  }

  const comprometidas = operando.filter(
    (vaga) => vaga.situacao === 'ocupada' || vaga.situacao === 'reservada',
  )

  return comprometidas.length / operando.length
}
