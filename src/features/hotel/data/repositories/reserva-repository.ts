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
  reservaDoAnimalNoPeriodo,
  reservaSegura,
  taxaDeOcupacao,
  type VagaNoPeriodo,
} from '../../domain/disponibilidade'
import { contatosDe, incorporarAoCadastro } from '../../domain/contatos'
import { contarDiarias, dataDe, datasEntre } from '../../domain/hotel-time'
import { montarOrcamento, sinalReembolsavel } from '../../domain/tarifas'
import { simularChamada } from '../mock-runtime'
import { agoraIso, getDataset, hojeIso, novoId } from '../store'
import type {
  Acomodacao,
  Comprovante,
  DispensaDeExigencia,
  ExigenciaKind,
  ISODate,
  ISODateTime,
  MotivoDeCancelamento,
  PessoaAutorizada,
  PetPorte,
  PetSpecies,
  Reserva,
  ReservaOrigem,
  ServicoContratado,
  SituacaoDaExigencia,
  VeterinarioDoPet,
} from '../types'

function base() {
  return getDataset()
}

/**
 * Grava no cadastro da família quem acabou de ser autorizado, e devolve a lista com os ids finais.
 *
 * Mora aqui, e não em cada repositório que autoriza, porque **reserva e check-in gravam o mesmo
 * cadastro**: duas cópias desta função discordariam sobre quando duas pessoas são a mesma, e a
 * vizinha cadastrada na reserva reapareceria em dobro no check-in.
 */
export function registrarAutorizados(tutorId: string, pessoas: PessoaAutorizada[]) {
  const dataset = base()
  const { cadastro, confirmadas } = incorporarAoCadastro({
    cadastro: dataset.contatosDaFamilia,
    tutorId,
    pessoas,
    novoId: () => novoId('pessoa'),
  })

  dataset.contatosDaFamilia = cadastro

  return confirmadas
}

/** O último veterinário conhecido do animal, como cópia — a tela edita sem mexer no cadastro. */
function veterinarioConhecido(petId: string): VeterinarioDoPet | null {
  const conhecido = base().veterinariosDosPets.find((item) => item.petId === petId)

  return conhecido
    ? { nome: conhecido.nome, clinica: conhecido.clinica, telefone: conhecido.telefone }
    : null
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
  /**
   * O hóspede passou da hora prevista de saída e ainda está na casa: `reserva.orcamento` é a conta
   * da entrega agora, a mesma da estadia e do check-out, e não a da saída prevista.
   */
  contaDaEntregaAgora: boolean
  /**
   * Quando o animal saiu de fato, depois do check-out. A reserva guarda a saída **prevista**; a
   * estadia encerrada antes (ou depois) da data mostrava no quadro um dia em que ele já não estava.
   */
  saidaReal: ISODateTime | null
  admissao: AvaliacaoDeAdmissao
  comprovantes: Comprovante[]
  /** Vaga reavaliada agora: a acomodação pode ter saído de operação depois da venda. */
  vaga: VagaNoPeriodo
  /** `null` quando a reserva ainda não virou estadia. */
  hospedagemId: string | null
  sinalDevolve: boolean
  /**
   * Quem a família já cadastrou para buscar, autorizado ou não nesta estadia.
   *
   * Vem com o detalhe porque o check-in é feito **desta** tela, e é lá que a recepção marca quem
   * vale desta vez. Sem o cadastro, ela só veria os autorizados da reserva e teria de redigitar o
   * vizinho que buscou da última vez.
   */
  contatosDaFamilia: PessoaAutorizada[]
  /** O último veterinário conhecido do animal. Preenche o check-in; `null` se nunca informado. */
  veterinarioDoPet: VeterinarioDoPet | null
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

/** Animal que o hotel ainda não conhece, cadastrado na venda de balcão. */
export type HospedeNovo = {
  petNome: string
  especie: PetSpecies
  /** Só cão tem porte; gato vai sem. */
  porte: PetPorte | null
  tutorNome: string
  telefone: string
}

/**
 * O cadastro mínimo de quem chega pelo telefone: o responsável e o animal, com o que decide onde
 * ele cabe. O resto (raça, nascimento, carteira) vem no check-in, como no pedido pelo link.
 */
function cadastrarHospedeNovo(novo: HospedeNovo) {
  const dataset = base()
  const tutorId = novoId('tutor')
  const nome = novo.petNome.trim()

  dataset.tutores.push({
    id: tutorId,
    nome: novo.tutorNome.trim(),
    telefone: novo.telefone.trim(),
    telefoneSecundario: '',
    email: '',
    documento: '',
    preferenciaContato: 'whatsapp',
    endereco: null,
  })

  const pet = {
    id: novoId('pet'),
    nome,
    especie: novo.especie,
    raca: '',
    sexo: null,
    nascimento: null,
    castrado: false,
    porte: novo.porte,
    pesoKg: null,
    microchip: '',
    pelagem: '',
    tutorId,
    alertas: [],
    iniciais: nome.slice(0, 2).toUpperCase(),
    fotoUrl: '',
  }

  dataset.pets.push(pet)

  return pet
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * A conta de uma estadia que vai de `entrada` a `saida`, com a tarifa, as temporadas, os serviços
 * e a política da casa. É a que o check-out grava quando `saida` é a hora real da entrega.
 */
export function contaDaEstadia(reserva: Reserva, entrada: ISODateTime, saida: ISODateTime) {
  const dataset = base()
  const acomodacao = dataset.acomodacoes.find((item) => item.id === reserva.acomodacaoId)
  const tarifa = dataset.tarifas.find((item) => item.id === acomodacao?.tarifaId)

  if (!tarifa) {
    return null
  }

  const pet = dataset.pets.find((item) => item.id === reserva.petId)
  const acompanhante = reserva.acompanhantePetId
    ? dataset.pets.find((item) => item.id === reserva.acompanhantePetId)
    : null

  return montarOrcamento({
    entrada,
    saida,
    tarifa,
    porte: pet?.porte ?? null,
    porteAcompanhante: acompanhante?.porte ?? null,
    temporadas: dataset.temporadas,
    servicos: reserva.servicos,
    catalogoDeServicos: dataset.servicos,
    politica: dataset.hotel.politica,
    pagoCentavos: reserva.pagoCentavos,
  })
}

/**
 * O hóspede ainda na casa depois da hora prevista de saída: a conta que vale é a da entrega agora.
 *
 * A estadia e o check-out já cobravam assim (R$ 507,35 do Bento às 20h), e a reserva e a lista
 * seguiam com a conta da saída prevista (R$ 437,85): a recepção via dois saldos para o mesmo
 * hóspede. A reserva gravada não muda; só a resposta.
 */
function comContaDeAgora(reserva: Reserva): { reserva: Reserva; contaDeAgora: boolean } {
  if (reserva.status !== 'hospedado') {
    return { reserva, contaDeAgora: false }
  }

  const hospedagem = base().hospedagens.find(
    (item) => item.reservaId === reserva.id && item.status === 'hospedado',
  )
  const agora = agoraIso()

  if (!hospedagem || Date.parse(agora) <= Date.parse(hospedagem.saidaPrevistaEm)) {
    return { reserva, contaDeAgora: false }
  }

  const orcamento = contaDaEstadia(reserva, hospedagem.entradaEm, agora)

  return orcamento
    ? { reserva: { ...reserva, orcamento }, contaDeAgora: true }
    : { reserva, contaDeAgora: false }
}

function decorar(gravada: Reserva): ReservaNaLista {
  const { reserva } = comContaDeAgora(gravada)
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

      const naResposta = comContaDeAgora(reserva)
      const estadia = dataset.hospedagens.find((item) => item.reservaId === reserva.id)

      return {
        /* Sai como cópia pelo `simularChamada` (ver `comoResposta` no mock-runtime). */
        reserva: naResposta.reserva,
        contaDaEntregaAgora: naResposta.contaDeAgora,
        saidaReal: estadia?.saidaEm ?? null,
        admissao,
        comprovantes: dataset.comprovantes.filter((item) => item.petId === reserva.petId),
        vaga: vaga ?? {
          acomodacao: acomodacao ?? dataset.acomodacoes[0]!,
          situacao: 'fora-de-operacao',
          impedimentos: ['inativa'],
          conflitos: [],
        },
        hospedagemId: estadia?.id ?? null,
        sinalDevolve: sinalReembolsavel(
          dataDe(reserva.entradaPrevista),
          hojeIso(),
          dataset.hotel.politica,
        ),
        contatosDaFamilia: contatosDe(dataset.contatosDaFamilia, reserva.tutorId),
        veterinarioDoPet: veterinarioConhecido(reserva.petId),
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
    tipos?: string[]
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
        tipos: entrada.tipos,
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
    /** Animal novo, ainda sem cadastro: o porte vem do formulário. */
    porte?: PetPorte | null
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
      porte: pet?.porte ?? entrada.porte ?? null,
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
    /** Animal novo, ainda sem cadastro: porte e espécie vêm do formulário. */
    porte?: PetPorte | null
    especie?: PetSpecies | null
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
      porte: pet?.porte ?? entrada.porte ?? null,
      especie: pet?.especie ?? entrada.especie ?? null,
      ocupantes: entrada.ocupantes ?? 1,
    })
  },

  /**
   * Para onde a reserva pode ir, num período novo: o mapa visto **sem ela**.
   *
   * Síncrona como a `vaga`: a lista de acomodações se refaz enquanto a recepção mexe nas datas. A
   * própria reserva não conflita consigo mesma, e o animal não pode estar em outra reserva viva
   * no período novo (devolvido em `animal`).
   */
  vagasParaMover(entrada: { reservaId: string; inicio: ISODateTime; fim: ISODateTime }): {
    vagas: VagaNoPeriodo[]
    animal: Reserva | null
  } {
    const dataset = base()
    const reserva = dataset.reservas.find((item) => item.id === entrada.reservaId)

    if (!reserva) {
      return { vagas: [], animal: null }
    }

    const pet = dataset.pets.find((item) => item.id === reserva.petId)

    return {
      vagas: mapaDoPeriodo({
        acomodacoes: dataset.acomodacoes,
        reservas: dataset.reservas,
        inicio: entrada.inicio,
        fim: entrada.fim,
        porte: pet?.porte ?? null,
        especie: pet?.especie ?? null,
        ocupantes: reserva.acompanhantePetId ? 2 : 1,
        ignorarReservaId: reserva.id,
      }),
      animal: reservaDoAnimalNoPeriodo(
        dataset.reservas,
        [reserva.petId, reserva.acompanhantePetId ?? ''],
        entrada.inicio,
        entrada.fim,
        reserva.id,
      ),
    }
  },

  /**
   * A reserva viva que já segura este animal (ou o acompanhante) no período, se houver.
   *
   * Síncrona como a `vaga`, e pela mesma razão: o aviso aparece quando o hóspede é escolhido, e não
   * na recusa do clique de confirmar.
   */
  reservaDoAnimal(entrada: {
    petIds: string[]
    inicio: ISODateTime
    fim: ISODateTime
    ignorarReservaId?: string
  }): Reserva | null {
    return reservaDoAnimalNoPeriodo(
      base().reservas,
      entrada.petIds,
      entrada.inicio,
      entrada.fim,
      entrada.ignorarReservaId,
    )
  },

  /**
   * Quem a família já cadastrou para buscar.
   *
   * Síncrona como a `vaga`, e pela mesma razão: a lista aparece no instante em que o hóspede é
   * escolhido na reserva nova, e um carregamento ali faria a recepção começar a ditar nomes que já
   * estão no cadastro.
   */
  contatosDaFamilia(tutorId: string): PessoaAutorizada[] {
    return contatosDe(base().contatosDaFamilia, tutorId)
  },

  /** O último veterinário conhecido do animal. `null` quando ninguém nunca informou. */
  veterinarioDoPet(petId: string): VeterinarioDoPet | null {
    return veterinarioConhecido(petId)
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
    /**
     * Quem, além do responsável, pode retirar o animal. Conferido no check-out.
     *
     * Quem vem com id vazio — ou com um id que o cadastro da família não conhece — é gente nova:
     * ganha id aqui e entra no cadastro, para a próxima estadia já oferecê-la.
     */
    autorizadosARetirar?: PessoaAutorizada[]
    /**
     * O animal que o hotel ainda não conhece, cadastrado na própria venda (tutor novo ao telefone).
     * Com ele, `petId` é ignorado.
     */
    hospedeNovo?: HospedeNovo | null
  }): Promise<Reserva> {
    return simularChamada('reserva.criar', () => {
      const dataset = base()
      const acomodacao = dataset.acomodacoes.find((item) => item.id === entrada.acomodacaoId)
      const novo = entrada.hospedeNovo ?? null
      const conhecido = novo ? null : dataset.pets.find((item) => item.id === entrada.petId)

      if (!acomodacao || (!conhecido && !novo)) {
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
        porte: conhecido ? conhecido.porte : (novo?.porte ?? null),
        especie: conhecido ? conhecido.especie : (novo?.especie ?? null),
        ocupantes: entrada.acompanhantePetId ? 2 : 1,
      })

      if (vaga.impedimentos.length > 0) {
        throw new VagaIndisponivelError(vaga.impedimentos[0]!)
      }

      /* O mesmo animal não dorme em duas baias: a segunda venda prenderia uma vaga vazia. */
      if (
        conhecido &&
        reservaDoAnimalNoPeriodo(
          dataset.reservas,
          [conhecido.id, entrada.acompanhantePetId ?? ''],
          entrada.inicio,
          entrada.fim,
        )
      ) {
        throw new VagaIndisponivelError('animal-ja-reservado')
      }

      /*
       * O animal novo entra no cadastro só agora, com a vaga garantida: uma venda recusada não
       * deixa para trás um hóspede sem reserva. Mesmo cadastro mínimo do pedido pelo link.
       */
      const pet = conhecido ?? cadastrarHospedeNovo(novo!)

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

      /*
       * O cadastro da família só cresce **depois** de a vaga passar: uma venda recusada não pode
       * deixar para trás uma pessoa autorizada a buscar um animal que nem tem reserva.
       */
      const autorizados = registrarAutorizados(pet.tutorId, entrada.autorizadosARetirar ?? [])

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
        autorizadosARetirar: autorizados,
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

      if (
        reservaDoAnimalNoPeriodo(
          dataset.reservas,
          [reserva.petId, reserva.acompanhantePetId ?? ''],
          inicio,
          fim,
          reserva.id,
        )
      ) {
        throw new VagaIndisponivelError('animal-ja-reservado')
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
