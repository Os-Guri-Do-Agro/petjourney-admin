/**
 * Repositório das reservas — e é aqui que moram R1 e R2.
 *
 * Elas moram aqui **de propósito**. Se a checagem de vaga vivesse na tela do mapa, bastaria a tela
 * de reservas para vender duas vezes a mesma baia; se a checagem de carteira vivesse no formulário
 * de check-in, bastaria uma rota de API amanhã para um hóspede com a antirrábica vencida entrar.
 * Regra que decide quem entra na casa é regra de servidor.
 */

import { diffDays } from '@/features/clinico/domain/clinic-time'

import {
  avaliarAdmissao,
  situacaoParaSelo,
  validadeDe,
  type AvaliacaoDeAdmissao,
} from '../../domain/admissao'
import {
  avaliarVaga,
  mapaDoPeriodo,
  reservaSegura,
  taxaDeOcupacao,
  type VagaNoPeriodo,
} from '../../domain/disponibilidade'
import { contarDiarias, dataDe, datasEntre } from '../../domain/hotel-time'
import { montarOrcamento, sinalReembolsavel } from '../../domain/tarifas'
import { simularChamada } from '../mock-runtime'
import { agoraIso, getDataset, hojeIso, novoId } from '../store'
import type {
  Acomodacao,
  AcomodacaoKind,
  Comprovante,
  DispensaDeExigencia,
  ExigenciaKind,
  ISODate,
  ISODateTime,
  MotivoDeCancelamento,
  PetPorte,
  PetSpecies,
  Reserva,
  ReservaOrigem,
  ServicoContratado,
  SituacaoDaExigencia,
} from '../types'

function base() {
  return getDataset()
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

/**
 * Vaga recusada, com o motivo legível.
 *
 * O `kind` viaja e a tela traduz — mesma disciplina do resto do portal. Sem ele, a interface só
 * saberia dizer "não deu", e "não deu" numa tela de venda faz a recepção tentar de novo exatamente
 * do mesmo jeito, com o cliente na linha.
 */
export class VagaIndisponivelError extends Error {
  readonly kind: string

  constructor(kind: string) {
    super(`[mock] vaga recusada: ${kind}`)
    this.name = 'VagaIndisponivelError'
    this.kind = kind
  }
}

/** Check-in recusado por exigência de admissão. Carrega **quais**, para a tela listar. */
export class AdmissaoBloqueadaError extends Error {
  readonly kinds: ExigenciaKind[]

  constructor(kinds: ExigenciaKind[]) {
    super(`[mock] admissão bloqueada: ${kinds.join(', ')}`)
    this.name = 'AdmissaoBloqueadaError'
    this.kinds = kinds
  }
}

// ---------------------------------------------------------------------------
// Envelopes de leitura
// ---------------------------------------------------------------------------

/** Uma reserva com tudo o que a lista precisa, para a tela não buscar de novo. */
export type ReservaNaLista = {
  reserva: Reserva
  petNome: string
  petIniciais: string
  /** O retrato, quando a API o tiver. O avatar do hóspede acompanha o nome em toda lista. */
  petFotoUrl: string
  petPorte: PetPorte | null
  petEspecie: PetSpecies
  tutorNome: string
  tutorTelefone: string
  acomodacaoNome: string
  blocoId: string
  /** A pior situação das exigências — a coluna pela qual a recepção trabalha na véspera. */
  admissao: SituacaoDaExigencia
  /** Quantos dias faltam para a entrada. Negativo é passado. */
  diasAteEntrada: number
}

export type ReservaDetalhada = {
  reserva: Reserva
  admissao: AvaliacaoDeAdmissao
  comprovantes: Comprovante[]
  /** Vaga reavaliada agora: a acomodação pode ter saído de operação depois da venda. */
  vaga: VagaNoPeriodo
  /** `null` quando a reserva ainda não virou estadia. */
  hospedagemId: string | null
  sinalDevolve: boolean
}

/**
 * Uma estadia desenhada como barra na grade de ocupação.
 *
 * Os índices são **de dia**, já recortados ao intervalo pedido, e `ate` é **exclusivo**: uma
 * estadia que entra no dia 22 e sai no dia 30 ocupa oito noites — a do dia 30 não, porque a
 * acomodação fica livre ao meio-dia e pode ser vendida naquela mesma tarde. Desenhar nove
 * células mostraria à recepção uma noite cheia que está à venda.
 */
export type FaixaNaGrade = {
  reservaId: string
  petNome: string
  petIniciais: string
  /** Espécie e retrato: o avatar do hóspede acompanha o nome em toda lista. */
  petEspecie: PetSpecies | null
  petFotoUrl: string
  acompanhanteNome: string
  tutorNome: string
  status: Reserva['status']
  de: number
  ate: number
  /** A estadia começa antes do intervalo, ou termina depois: a barra ganha seta na ponta. */
  entraAntes: boolean
  saiDepois: boolean
  entradaPrevista: ISODateTime
  saidaPrevista: ISODateTime
  /** Situação da documentação, para a barra avisar antes de o carro chegar. */
  admissao: SituacaoDaExigencia
}

export type LinhaDaGrade = {
  acomodacao: Acomodacao
  faixas: FaixaNaGrade[]
  /** Noites livres no intervalo. É o número que a recepção procura, e por isso vem pronto. */
  noitesLivres: number
}

/**
 * A casa inteira ao longo do tempo.
 *
 * É a leitura que o mapa de verdade usa: linhas são acomodações, colunas são noites. Um painel
 * de "vaga hoje" responde a pergunta que ninguém faz ao telefone — a venda de hotel é futura, e o
 * que se procura é o **buraco** entre duas estadias.
 */
export type GradeDeOcupacao = {
  dias: ISODate[]
  linhas: LinhaDaGrade[]
  /** Quantas acomodações têm hóspede em cada noite, com o denominador do dia. */
  porDia: { data: ISODate; ocupadas: number; operando: number }[]
  /** Acomodações sem nenhuma reserva no intervalo inteiro. */
  totalmenteLivres: number
}

export type MapaDoPeriodo = {
  inicio: ISODateTime
  fim: ISODateTime
  vagas: VagaNoPeriodo[]
  ocupacao: number
  livres: number
  operando: number
  foraDeOperacao: number
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

function decorar(reserva: Reserva): ReservaNaLista {
  const dataset = base()
  const pet = dataset.pets.find((item) => item.id === reserva.petId)
  const tutor = dataset.tutores.find((item) => item.id === reserva.tutorId)
  const acomodacao = dataset.acomodacoes.find((item) => item.id === reserva.acomodacaoId)

  const admissao = pet
    ? avaliarAdmissao({
        exigencias: dataset.exigencias,
        comprovantes: dataset.comprovantes,
        petId: pet.id,
        especie: pet.especie,
        saidaPrevista: dataDe(reserva.saidaPrevista),
        hoje: hojeIso(),
        dispensas: reserva.dispensas,
      })
    : null

  return {
    reserva,
    petNome: pet?.nome ?? '',
    petIniciais: pet?.iniciais ?? '',
    petFotoUrl: pet?.fotoUrl ?? '',
    petPorte: pet?.porte ?? null,
    petEspecie: pet?.especie ?? 'canina',
    tutorNome: tutor?.nome ?? '',
    tutorTelefone: tutor?.telefone ?? '',
    acomodacaoNome: acomodacao?.nome ?? '',
    blocoId: acomodacao?.blocoId ?? '',
    admissao: admissao ? situacaoParaSelo(admissao) : 'ausente',
    diasAteEntrada: diffDays(hojeIso(), dataDe(reserva.entradaPrevista)),
  }
}

export const reservaRepository = {
  /**
   * As reservas, opcionalmente recortadas por período.
   *
   * O recorte é por **cruzamento** e não por data de entrada: quem pergunta "o que tenho nesta
   * semana" quer ver também a estadia que começou domingo e termina quinta — e uma lista que a
   * escondesse faria a casa achar que tem vaga onde não tem.
   */
  listar(filtro?: { de?: ISODate; ate?: ISODate }): Promise<ReservaNaLista[]> {
    return simularChamada('reserva.listar', () => {
      const dataset = base()

      const recortadas = dataset.reservas.filter((reserva) => {
        if (!filtro?.de && !filtro?.ate) {
          return true
        }

        const entrada = dataDe(reserva.entradaPrevista)
        const saida = dataDe(reserva.saidaPrevista)

        return (!filtro.ate || entrada <= filtro.ate) && (!filtro.de || saida >= filtro.de)
      })

      return recortadas
        .map(decorar)
        .sort((um, outro) =>
          um.reserva.entradaPrevista.localeCompare(outro.reserva.entradaPrevista),
        )
    })
  },

  abrir(reservaId: string): Promise<ReservaDetalhada | null> {
    return simularChamada('reserva.abrir', () => {
      const dataset = base()
      const reserva = dataset.reservas.find((item) => item.id === reservaId)

      if (!reserva) {
        return null
      }

      const pet = dataset.pets.find((item) => item.id === reserva.petId)
      const acomodacao = dataset.acomodacoes.find((item) => item.id === reserva.acomodacaoId)

      const admissao = avaliarAdmissao({
        exigencias: dataset.exigencias,
        comprovantes: dataset.comprovantes,
        petId: reserva.petId,
        especie: pet?.especie ?? 'canina',
        saidaPrevista: dataDe(reserva.saidaPrevista),
        hoje: hojeIso(),
        dispensas: reserva.dispensas,
      })

      const vaga = acomodacao
        ? avaliarVaga({
            acomodacao,
            reservas: dataset.reservas,
            inicio: reserva.entradaPrevista,
            fim: reserva.saidaPrevista,
            porte: pet?.porte ?? null,
            especie: pet?.especie ?? null,
            ocupantes: reserva.acompanhantePetId ? 2 : 1,
            /* A própria reserva não conflita consigo mesma. */
            ignorarReservaId: reserva.id,
          })
        : null

      return {
        reserva,
        admissao,
        comprovantes: dataset.comprovantes.filter((item) => item.petId === reserva.petId),
        vaga: vaga ?? {
          acomodacao: acomodacao ?? dataset.acomodacoes[0]!,
          situacao: 'fora-de-operacao',
          impedimentos: ['inativa'],
          conflitos: [],
        },
        hospedagemId: dataset.hospedagens.find((item) => item.reservaId === reserva.id)?.id ?? null,
        sinalDevolve: sinalReembolsavel(
          dataDe(reserva.entradaPrevista),
          hojeIso(),
          dataset.hotel.politica,
        ),
      }
    })
  },

  /**
   * O mapa visto através de um período.
   *
   * Mesma função de domínio que a criação de reserva usa para recusar — é o que garante que a vaga
   * oferecida ao telefone seja a vaga que existe. Duas implementações da mesma pergunta divergem no
   * primeiro feriado.
   */
  mapa(entrada: {
    inicio: ISODateTime
    fim: ISODateTime
    porte?: PetPorte | null
    especie?: PetSpecies | null
    ocupantes?: number
    kinds?: AcomodacaoKind[]
  }): Promise<MapaDoPeriodo> {
    return simularChamada('mapa.periodo', () => {
      const dataset = base()

      const vagas = mapaDoPeriodo({
        acomodacoes: dataset.acomodacoes,
        reservas: dataset.reservas,
        inicio: entrada.inicio,
        fim: entrada.fim,
        porte: entrada.porte,
        especie: entrada.especie,
        ocupantes: entrada.ocupantes,
        kinds: entrada.kinds,
      })

      return {
        inicio: entrada.inicio,
        fim: entrada.fim,
        vagas,
        ocupacao: taxaDeOcupacao(vagas),
        livres: vagas.filter((vaga) => vaga.impedimentos.length === 0).length,
        operando: vagas.filter((vaga) => vaga.acomodacao.ativa).length,
        foraDeOperacao: vagas.filter((vaga) => !vaga.acomodacao.ativa).length,
      }
    })
  },

  /** Simula o orçamento sem criar nada. É o número que o balcão diz antes de cadastrar. */
  simular(entrada: {
    acomodacaoId: string
    petId: string
    acompanhantePetId?: string | null
    inicio: ISODateTime
    fim: ISODateTime
    servicos?: ServicoContratado[]
  }) {
    const dataset = base()
    const acomodacao = dataset.acomodacoes.find((item) => item.id === entrada.acomodacaoId)
    const tarifa = dataset.tarifas.find((item) => item.id === acomodacao?.tarifaId)
    const pet = dataset.pets.find((item) => item.id === entrada.petId)
    const acompanhante = entrada.acompanhantePetId
      ? dataset.pets.find((item) => item.id === entrada.acompanhantePetId)
      : null

    if (!acomodacao || !tarifa) {
      return null
    }

    return montarOrcamento({
      entrada: entrada.inicio,
      saida: entrada.fim,
      tarifa,
      porte: pet?.porte ?? null,
      porteAcompanhante: acompanhante?.porte ?? null,
      temporadas: dataset.temporadas,
      servicos: entrada.servicos ?? [],
      catalogoDeServicos: dataset.servicos,
      politica: dataset.hotel.politica,
    })
  },

  /**
   * A vaga existe para este período, nesta acomodação?
   *
   * Síncrona e sem envelope de latência, como a `simular` ao lado e pela mesma razão: quem mexe no
   * número de noites precisa ver a resposta **enquanto** mexe. A alternativa era descobrir no
   * clique de confirmar que a baia está ocupada a partir de quinta — depois de escolher o hóspede,
   * os serviços e quem pode retirar.
   *
   * Usa a mesma função que pinta o mapa e que recusa a criação. Uma segunda implementação aqui
   * divergiria da que grava, e a divergência apareceria como um aviso verde seguido de uma recusa.
   */
  vaga(entrada: {
    acomodacaoId: string
    inicio: ISODateTime
    fim: ISODateTime
    petId?: string
    ocupantes?: number
  }) {
    const dataset = base()
    const acomodacao = dataset.acomodacoes.find((item) => item.id === entrada.acomodacaoId)

    if (!acomodacao) {
      return null
    }

    const pet = dataset.pets.find((item) => item.id === entrada.petId)

    return avaliarVaga({
      acomodacao,
      reservas: dataset.reservas,
      inicio: entrada.inicio,
      fim: entrada.fim,
      porte: pet?.porte ?? null,
      especie: pet?.especie ?? null,
      ocupantes: entrada.ocupantes ?? 1,
    })
  },

  // -------------------------------------------------------------------------
  // Escrita
  // -------------------------------------------------------------------------

  /**
   * Cria uma reserva, recusando a vaga que não existe.
   *
   * A recusa acontece **antes** de qualquer gravação e usa a mesma função que pinta o mapa. É o
   * ponto em que a regra R2 deixa de ser uma intenção e vira uma garantia.
   */
  criar(entrada: {
    petId: string
    acompanhantePetId?: string | null
    acomodacaoId: string
    inicio: ISODateTime
    fim: ISODateTime
    origem: ReservaOrigem
    servicos?: ServicoContratado[]
    observacao?: string
    /** Quem, além do responsável, pode retirar o animal. Conferido no check-out. */
    autorizadosARetirar?: string[]
  }): Promise<Reserva> {
    return simularChamada('reserva.criar', () => {
      const dataset = base()
      const acomodacao = dataset.acomodacoes.find((item) => item.id === entrada.acomodacaoId)
      const pet = dataset.pets.find((item) => item.id === entrada.petId)

      if (!acomodacao || !pet) {
        throw new VagaIndisponivelError('inativa')
      }

      if (Date.parse(entrada.fim) <= Date.parse(entrada.inicio)) {
        throw new VagaIndisponivelError('periodo-invalido')
      }

      const vaga = avaliarVaga({
        acomodacao,
        reservas: dataset.reservas,
        inicio: entrada.inicio,
        fim: entrada.fim,
        porte: pet.porte,
        especie: pet.especie,
        ocupantes: entrada.acompanhantePetId ? 2 : 1,
      })

      if (vaga.impedimentos.length > 0) {
        throw new VagaIndisponivelError(vaga.impedimentos[0]!)
      }

      const tarifa = dataset.tarifas.find((item) => item.id === acomodacao.tarifaId)!
      const acompanhante = entrada.acompanhantePetId
        ? dataset.pets.find((item) => item.id === entrada.acompanhantePetId)
        : null

      const orcamento = montarOrcamento({
        entrada: entrada.inicio,
        saida: entrada.fim,
        tarifa,
        porte: pet.porte,
        porteAcompanhante: acompanhante?.porte ?? null,
        temporadas: dataset.temporadas,
        servicos: entrada.servicos ?? [],
        catalogoDeServicos: dataset.servicos,
        politica: dataset.hotel.politica,
      })

      const agora = agoraIso()
      const reserva: Reserva = {
        id: novoId('res'),
        petId: pet.id,
        tutorId: pet.tutorId,
        acompanhantePetId: acompanhante?.id ?? null,
        acomodacaoId: acomodacao.id,
        entradaPrevista: entrada.inicio,
        saidaPrevista: entrada.fim,
        diarias: contarDiarias(entrada.inicio, entrada.fim),
        /*
         * Nasce `pendente` e não `confirmada`: reserva sem sinal é intenção, e tratá-la como
         * confirmada faria a alta temporada lotar de quem nunca vem.
         */
        status: 'pendente',
        origem: entrada.origem,
        servicos: entrada.servicos ?? [],
        orcamento,
        pagoCentavos: 0,
        observacao: entrada.observacao ?? '',
        autorizadosARetirar: entrada.autorizadosARetirar ?? [],
        dispensas: [],
        criadoEm: agora,
        atualizadoEm: agora,
        canceladaEm: null,
        motivoCancelamento: null,
      }

      dataset.reservas.push(reserva)

      return reserva
    })
  },

  /**
   * Move ou estende uma reserva.
   *
   * Prorrogar é a operação que mais acontece — o voo atrasou — e a que menos costuma estar
   * prevista. Passa pela mesma checagem de vaga, ignorando a própria reserva: sem isso, estender em
   * um dia seria recusado pela reserva que se está estendendo.
   */
  editar(entrada: {
    reservaId: string
    inicio?: ISODateTime
    fim?: ISODateTime
    acomodacaoId?: string
    servicos?: ServicoContratado[]
    observacao?: string
  }): Promise<Reserva> {
    return simularChamada('reserva.editar', () => {
      const dataset = base()
      const reserva = dataset.reservas.find((item) => item.id === entrada.reservaId)

      if (!reserva) {
        throw new VagaIndisponivelError('inativa')
      }

      const inicio = entrada.inicio ?? reserva.entradaPrevista
      const fim = entrada.fim ?? reserva.saidaPrevista
      const acomodacao = dataset.acomodacoes.find(
        (item) => item.id === (entrada.acomodacaoId ?? reserva.acomodacaoId),
      )
      const pet = dataset.pets.find((item) => item.id === reserva.petId)

      if (!acomodacao || !pet) {
        throw new VagaIndisponivelError('inativa')
      }

      if (Date.parse(fim) <= Date.parse(inicio)) {
        throw new VagaIndisponivelError('periodo-invalido')
      }

      const vaga = avaliarVaga({
        acomodacao,
        reservas: dataset.reservas,
        inicio,
        fim,
        porte: pet.porte,
        especie: pet.especie,
        ocupantes: reserva.acompanhantePetId ? 2 : 1,
        ignorarReservaId: reserva.id,
      })

      if (vaga.impedimentos.length > 0) {
        throw new VagaIndisponivelError(vaga.impedimentos[0]!)
      }

      const tarifa = dataset.tarifas.find((item) => item.id === acomodacao.tarifaId)!
      const acompanhante = reserva.acompanhantePetId
        ? dataset.pets.find((item) => item.id === reserva.acompanhantePetId)
        : null

      const servicos = entrada.servicos ?? reserva.servicos
      const orcamento = montarOrcamento({
        entrada: inicio,
        saida: fim,
        tarifa,
        porte: pet.porte,
        porteAcompanhante: acompanhante?.porte ?? null,
        temporadas: dataset.temporadas,
        servicos,
        catalogoDeServicos: dataset.servicos,
        politica: dataset.hotel.politica,
        pagoCentavos: reserva.pagoCentavos,
      })

      reserva.entradaPrevista = inicio
      reserva.saidaPrevista = fim
      reserva.acomodacaoId = acomodacao.id
      reserva.diarias = contarDiarias(inicio, fim)
      reserva.servicos = servicos
      reserva.orcamento = orcamento
      reserva.observacao = entrada.observacao ?? reserva.observacao
      reserva.atualizadoEm = agoraIso()

      /*
       * A estadia em curso acompanha a reserva. Prorrogar sem mover a saída prevista da hospedagem
       * produziria um hóspede que "deveria ter saído ontem" no painel do dia seguinte.
       */
      const hospedagem = dataset.hospedagens.find((item) => item.reservaId === reserva.id)

      if (hospedagem && hospedagem.status === 'hospedado') {
        hospedagem.saidaPrevistaEm = fim
        hospedagem.acomodacaoId = acomodacao.id
      }

      return reserva
    })
  },

  /** Confirma a reserva e registra o que entrou. É o sinal que separa reserva de intenção. */
  confirmar(reservaId: string, pagoCentavos: number): Promise<Reserva> {
    return simularChamada('reserva.confirmar', () => {
      const dataset = base()
      const reserva = dataset.reservas.find((item) => item.id === reservaId)!

      reserva.pagoCentavos += Math.max(0, pagoCentavos)
      reserva.orcamento = {
        ...reserva.orcamento,
        saldoCentavos: reserva.orcamento.totalCentavos - reserva.pagoCentavos,
      }
      reserva.status = reserva.status === 'pendente' ? 'confirmada' : reserva.status
      reserva.atualizadoEm = agoraIso()

      return reserva
    })
  },

  cancelar(
    reservaId: string,
    motivo: MotivoDeCancelamento,
    naoCompareceu = false,
  ): Promise<Reserva> {
    return simularChamada('reserva.cancelar', () => {
      const dataset = base()
      const reserva = dataset.reservas.find((item) => item.id === reservaId)!

      /*
       * Não comparecimento é um estado próprio, e não um cancelamento com etiqueta. Só ele tem
       * política de sinal, e juntá-los tornaria impossível saber quanto a casa perde por ano com
       * quem simplesmente não aparece.
       */
      reserva.status = naoCompareceu ? 'nao-compareceu' : 'cancelada'
      reserva.motivoCancelamento = motivo
      reserva.canceladaEm = agoraIso()
      reserva.atualizadoEm = reserva.canceladaEm

      return reserva
    })
  },

  /** Registra um comprovante. A validade é calculada da apresentação — o balcão não faz conta. */
  registrarComprovante(entrada: {
    petId: string
    kind: ExigenciaKind
    apresentadoEm: ISODate
    documento: string
    observacao?: string
  }): Promise<Comprovante> {
    return simularChamada('reserva.comprovante', () => {
      const dataset = base()
      const exigencia = dataset.exigencias.find((item) => item.kind === entrada.kind)

      const comprovante: Comprovante = {
        id: novoId('comp'),
        petId: entrada.petId,
        kind: entrada.kind,
        apresentadoEm: entrada.apresentadoEm,
        validoAte: validadeDe(entrada.apresentadoEm, exigencia?.validadeMeses ?? null),
        documento: entrada.documento,
        observacao: entrada.observacao ?? '',
      }

      dataset.comprovantes.push(comprovante)

      return comprovante
    })
  },

  /**
   * Dispensa uma exigência para uma reserva, com nome e motivo.
   *
   * O ponto da dispensa nominal: sem ela, a casa que decide aceitar um hóspede sem o papel faz isso
   * fora do sistema, e some o registro de que alguém decidiu. Exigir motivo é o que a mantém rara.
   */
  dispensar(entrada: {
    reservaId: string
    kind: ExigenciaKind
    motivo: string
    autorizadaPor: string
  }): Promise<Reserva> {
    return simularChamada('reserva.dispensar', () => {
      const dataset = base()
      const reserva = dataset.reservas.find((item) => item.id === entrada.reservaId)!

      const dispensa: DispensaDeExigencia = {
        kind: entrada.kind,
        motivo: entrada.motivo,
        autorizadaPor: entrada.autorizadaPor,
        autorizadaEm: agoraIso(),
      }

      reserva.dispensas = [
        ...reserva.dispensas.filter((item) => item.kind !== entrada.kind),
        dispensa,
      ]
      reserva.atualizadoEm = dispensa.autorizadaEm

      return reserva
    })
  },

  /**
   * A grade: acomodações no eixo vertical, noites no horizontal.
   *
   * Recorta as estadias ao intervalo em vez de descartá-las: quem já está hospedado desde a
   * semana passada precisa aparecer com a barra entrando pela esquerda, senão a linha parece
   * livre justamente onde há bicho dentro.
   */
  grade(de: ISODate, ate: ISODate): Promise<GradeDeOcupacao> {
    return simularChamada('mapa.periodo', () => {
      const dataset = base()
      const dias = datasEntre(de, ate)
      const hoje = hojeIso()

      const linhas = dataset.acomodacoes.map<LinhaDaGrade>((acomodacao) => {
        const faixas = dataset.reservas
          .filter((reserva) => reserva.acomodacaoId === acomodacao.id && reservaSegura(reserva))
          .flatMap<FaixaNaGrade>((reserva) => {
            const entrada = dataDe(reserva.entradaPrevista)
            const saida = dataDe(reserva.saidaPrevista)

            const bruto = { de: diffDays(de, entrada), ate: diffDays(de, saida) }

            /* Fora do intervalo por inteiro: nem entra na grade. */
            if (bruto.ate <= 0 || bruto.de >= dias.length) {
              return []
            }

            const pet = dataset.pets.find((item) => item.id === reserva.petId)
            const acompanhante = reserva.acompanhantePetId
              ? dataset.pets.find((item) => item.id === reserva.acompanhantePetId)
              : null

            const admissao = pet
              ? situacaoParaSelo(
                  avaliarAdmissao({
                    exigencias: dataset.exigencias,
                    comprovantes: dataset.comprovantes,
                    petId: pet.id,
                    especie: pet.especie,
                    saidaPrevista: saida,
                    hoje,
                    dispensas: reserva.dispensas,
                  }),
                )
              : 'ausente'

            return [
              {
                reservaId: reserva.id,
                petNome: pet?.nome ?? '',
                petIniciais: pet?.iniciais ?? '',
                petEspecie: pet?.especie ?? null,
                petFotoUrl: pet?.fotoUrl ?? '',
                acompanhanteNome: acompanhante?.nome ?? '',
                tutorNome: dataset.tutores.find((item) => item.id === reserva.tutorId)?.nome ?? '',
                status: reserva.status,
                de: Math.max(0, bruto.de),
                ate: Math.min(dias.length, bruto.ate),
                entraAntes: bruto.de < 0,
                saiDepois: bruto.ate > dias.length,
                entradaPrevista: reserva.entradaPrevista,
                saidaPrevista: reserva.saidaPrevista,
                admissao,
              },
            ]
          })
          .sort((um, outro) => um.de - outro.de)

        const ocupadas = faixas.reduce((total, faixa) => total + (faixa.ate - faixa.de), 0)

        return {
          acomodacao,
          faixas,
          noitesLivres: acomodacao.ativa ? Math.max(0, dias.length - ocupadas) : 0,
        }
      })

      const operando = linhas.filter((linha) => linha.acomodacao.ativa).length

      return {
        dias,
        linhas,
        porDia: dias.map((data, indice) => ({
          data,
          operando,
          ocupadas: linhas.filter(
            (linha) =>
              linha.acomodacao.ativa &&
              linha.faixas.some((faixa) => faixa.de <= indice && indice < faixa.ate),
          ).length,
        })),
        totalmenteLivres: linhas.filter(
          (linha) => linha.acomodacao.ativa && linha.faixas.length === 0,
        ).length,
      }
    })
  },

  /** A fila de quem quer um intervalo que está lotado. */
  espera() {
    return simularChamada('espera.listar', () => {
      const dataset = base()

      return dataset.espera
        .filter((item) => item.status === 'aguardando' || item.status === 'ofertada')
        .map((entrada) => {
          const pet = dataset.pets.find((item) => item.id === entrada.petId)

          return {
            entrada,
            petNome: pet?.nome ?? '',
            petIniciais: pet?.iniciais ?? '',
            petEspecie: pet?.especie ?? null,
            petFotoUrl: pet?.fotoUrl ?? '',
            tutorNome: dataset.tutores.find((item) => item.id === entrada.tutorId)?.nome ?? '',
            /* Quantos dias a pessoa está esperando: é o que ordena a fila. */
            esperandoHaDias: diffDays(dataDe(entrada.criadoEm), hojeIso()),
          }
        })
        .sort((um, outro) => outro.esperandoHaDias - um.esperandoHaDias)
    })
  },
}
