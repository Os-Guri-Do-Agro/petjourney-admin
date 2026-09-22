/**
 * Gerador determinístico do dataset do hotel.
 *
 * Mesma semente, mesmo dia âncora, mesma casa. O dia âncora é **hoje**, sem empurrar para dia
 * útil: hotel não fecha no domingo, e um dataset que pulasse o fim de semana mostraria uma casa
 * vazia justamente no dia mais cheio do ano.
 *
 * ## O que este arquivo garante
 *
 * Não é "dados plausíveis": é um conjunto de **casos plantados** que exercem as quatro regras do
 * requisito 01 sem que ninguém precise criá-los à mão antes de demonstrar. Um protótipo em que o
 * caso difícil só aparece se o apresentador souber montá-lo é um protótipo que nunca mostra o caso
 * difícil.
 *
 * Os casos estão listados em `CASOS` e aparecem no painel de desenvolvimento.
 *
 * ## A armadilha que custou tempo no módulo clínico, e que aqui já está resolvida
 *
 * **O sorteio que depende do relógio usa um gerador separado do que não depende.** O status de uma
 * tarefa depende da hora em que a página abriu (o que já passou está feito); consumindo do mesmo
 * fluxo, a hora do dia deslocaria o sorteio dos hóspedes e o dia âncora deixaria de ter sempre a
 * mesma casa.
 */

import { addDays, createClinicClock, diffDays } from '@/features/clinico/domain/clinic-time'
import type { Pet, Tutor } from '@/features/clinico/data/types'

import { porteCabe } from '../domain/disponibilidade'
import { instante } from '../domain/hotel-time'
import { planejarDia } from '../domain/rotina'
import { montarOrcamento } from '../domain/tarifas'

import {
  HOTEL_UTC_OFFSET,
  acomodacoesFixture,
  blocosFixture,
  cuidadoresFixture,
  exigenciasFixture,
  hotelFixture,
  petsFixture,
  servicosFixture,
  tarifasFixture,
  temporadasFixture,
  tutorsFixture,
  type TemporadaSazonal,
} from './fixtures'
import { createPrng, hashSeed, intBetween, pickFrom } from './mock-runtime'
import type {
  Acomodacao,
  Bloco,
  Boletim,
  Comprovante,
  Cuidador,
  EntradaDeEspera,
  Exigencia,
  Hospedagem,
  Hotel,
  ISODate,
  ISODateTime,
  MedicacaoDaEstadia,
  Ocorrencia,
  PreferenciaDeBoletim,
  RegistroDoDiario,
  Reserva,
  Servico,
  TarefaDeRotina,
  Tarifa,
  Temporada,
  Turno,
} from './types'

export const SEMENTE_PADRAO = 0x40_7e_15

const clock = createClinicClock(HOTEL_UTC_OFFSET)

/**
 * Um caso plantado, com o caminho até ele.
 *
 * `rota` existe porque um caso que o apresentador não acha é um caso que não existe — foi a lição
 * do painel de casos difíceis do módulo clínico.
 */
export type CasoDoHotel = {
  id: string
  titulo: string
  descricao: string
  rota: string
}

export type SeedResult = {
  semente: number
  /** Dia de referência de todo o dataset. */
  ancora: ISODate
  hotel: Hotel
  blocos: Bloco[]
  acomodacoes: Acomodacao[]
  tarifas: Tarifa[]
  temporadas: Temporada[]
  /**
   * As temporadas como a operação as define: `20/12 a 05/01`, todo ano.
   *
   * Andam junto das materializadas porque as duas respondem perguntas diferentes. O preço precisa
   * de datas comparáveis, e a virada do ano vira duas faixas; a tela de configuração precisa da
   * faixa que a pessoa cadastrou, e mostrar as três pontas ali faria a mesma temporada aparecer
   * repetida, com intervalos que parecem se contradizer.
   */
  temporadasSazonais: TemporadaSazonal[]
  servicos: Servico[]
  exigencias: Exigencia[]
  cuidadores: Cuidador[]
  comprovantes: Comprovante[]
  reservas: Reserva[]
  hospedagens: Hospedagem[]
  medicacoes: MedicacaoDaEstadia[]
  tarefas: TarefaDeRotina[]
  diario: RegistroDoDiario[]
  ocorrencias: Ocorrencia[]
  boletins: Boletim[]
  preferencias: PreferenciaDeBoletim[]
  turnos: Turno[]
  espera: EntradaDeEspera[]
  /**
   * Cópia dos pacientes e responsáveis do cadastro.
   *
   * Ficam no dataset e não na fixture porque a partir da reserva com cadastro novo eles
   * **crescem**: fixture é constante de módulo, e empurrar um hóspede novo para dentro dela vazaria
   * entre regenerações do seed e entre testes.
   */
  pets: Pet[]
  tutores: Tutor[]
  casos: CasoDoHotel[]
}

function iso(data: ISODate, hora: string): ISODateTime {
  return instante(data, hora, HOTEL_UTC_OFFSET)
}

/**
 * Materializa as faixas sazonais para o ano do dia âncora.
 *
 * Quebra a virada do ano em duas de propósito: "20 de dezembro a 5 de janeiro" não é um intervalo
 * comparável por texto, e um `inicio > fim` faria a contagem de diárias em temporada devolver zero
 * exatamente no período mais caro do ano.
 */
export function materializarTemporadas(sazonais: TemporadaSazonal[], ancora: ISODate): Temporada[] {
  const ano = Number(ancora.slice(0, 4))

  return sazonais.flatMap<Temporada>((sazonal) => {
    const atravessaOAno = sazonal.fimMesDia < sazonal.inicioMesDia
    const base = {
      nome: sazonal.nome,
      acrescimoPercentual: sazonal.acrescimoPercentual,
    }

    if (!atravessaOAno) {
      return [
        {
          ...base,
          id: sazonal.id,
          inicio: `${ano}-${sazonal.inicioMesDia}`,
          fim: `${ano}-${sazonal.fimMesDia}`,
        },
      ]
    }

    return [
      /* A ponta que fecha o ano corrente, e a que abre o seguinte. */
      {
        ...base,
        id: `${sazonal.id}-fim`,
        inicio: `${ano}-${sazonal.inicioMesDia}`,
        fim: `${ano}-12-31`,
      },
      {
        ...base,
        id: `${sazonal.id}-inicio`,
        inicio: `${ano + 1}-01-01`,
        fim: `${ano + 1}-${sazonal.fimMesDia}`,
      },
      /* E a ponta do ano anterior que ainda alcança janeiro de hoje. */
      {
        ...base,
        id: `${sazonal.id}-anterior`,
        inicio: `${ano - 1}-${sazonal.inicioMesDia}`,
        fim: `${ano}-${sazonal.fimMesDia}`,
      },
    ]
  })
}

type RoteiroDeReserva = {
  id: string
  petId: string
  acompanhantePetId?: string
  acomodacaoId: string
  /** Dias a partir do âncora. Negativo é passado. */
  entradaEmDias: number
  saidaEmDias: number
  horaEntrada: string
  horaSaida: string
  status: Reserva['status']
  origem: Reserva['origem']
  servicos?: { servicoId: string; quantidade: number }[]
  observacao?: string
  /** Percentual já pago. 0 é reserva sem sinal; 100 é quitada. */
  pagoPercentual: number
}

/**
 * O roteiro da casa.
 *
 * Escrito à mão e não sorteado: **os casos que importam não sobrevivem a um sorteio**. Uma carteira
 * que vence no meio da estadia, uma saída às 16h30 e um pertence esquecido são combinações raras
 * o bastante para nunca caírem juntas num dataset aleatório — e são exatamente as três que a tela
 * precisa mostrar.
 *
 * O que é sorteado é o recheio: as reservas de fundo que dão volume ao mapa.
 */
const ROTEIRO: RoteiroDeReserva[] = [
  // --------------------------------------------------------------- hospedados agora
  {
    id: 'res-thor',
    petId: 'pet-thor',
    acomodacaoId: 'acom-s1',
    entradaEmDias: -2,
    saidaEmDias: 3,
    horaEntrada: '09:00',
    horaSaida: '11:00',
    status: 'hospedado',
    origem: 'app',
    servicos: [{ servicoId: 'servico-banho', quantidade: 1 }],
    observacao: 'Tem medo de trovão. Se chover à noite, deixar a luz do corredor acesa.',
    pagoPercentual: 30,
  },
  {
    /* Caso C1 · sai hoje às 16h30 — depois do horário de saída, meia diária na conta. */
    id: 'res-bento',
    petId: 'pet-bento',
    acomodacaoId: 'acom-a1',
    entradaEmDias: -4,
    saidaEmDias: 0,
    horaEntrada: '08:30',
    horaSaida: '16:30',
    status: 'hospedado',
    origem: 'telefone',
    pagoPercentual: 30,
  },
  {
    /* Caso C2 · ocorrência grave sem contato registrado — trava a passagem de turno. */
    id: 'res-tofu',
    petId: 'pet-tofu',
    acomodacaoId: 'acom-g1',
    entradaEmDias: -3,
    saidaEmDias: 2,
    horaEntrada: '10:00',
    horaSaida: '10:00',
    status: 'hospedado',
    origem: 'balcao',
    servicos: [{ servicoId: 'servico-medicacao', quantidade: 1 }],
    observacao: 'Doença renal crônica. Ração terapêutica própria, sem exceção.',
    pagoPercentual: 100,
  },
  {
    id: 'res-nina',
    petId: 'pet-nina',
    acomodacaoId: 'acom-b1',
    entradaEmDias: -1,
    saidaEmDias: 5,
    horaEntrada: '14:00',
    horaSaida: '10:00',
    status: 'hospedado',
    origem: 'retorno',
    pagoPercentual: 30,
  },
  {
    /* Dois da mesma casa dividindo acomodação: é o que a capacidade 2 existe para permitir. */
    id: 'res-mel-amora',
    petId: 'pet-mel',
    acompanhantePetId: 'pet-amora',
    acomodacaoId: 'acom-a3',
    entradaEmDias: -2,
    saidaEmDias: 1,
    horaEntrada: '11:00',
    horaSaida: '09:30',
    status: 'hospedado',
    origem: 'whatsapp',
    servicos: [{ servicoId: 'servico-passeio', quantidade: 1 }],
    pagoPercentual: 30,
  },

  // --------------------------------------------------------------- chegam hoje
  {
    /* Caso C3 · chega hoje **sem** comprovante de tosse dos canis: check-in bloqueado. */
    id: 'res-zeus',
    petId: 'pet-zeus',
    acomodacaoId: 'acom-a4',
    entradaEmDias: 0,
    saidaEmDias: 6,
    horaEntrada: '15:00',
    horaSaida: '11:00',
    status: 'confirmada',
    origem: 'telefone',
    pagoPercentual: 30,
  },
  {
    id: 'res-sushi',
    petId: 'pet-sushi',
    acomodacaoId: 'acom-g2',
    entradaEmDias: 0,
    saidaEmDias: 4,
    horaEntrada: '09:30',
    horaSaida: '10:00',
    status: 'confirmada',
    origem: 'app',
    pagoPercentual: 30,
  },

  // --------------------------------------------------------------- futuras
  {
    /* Caso C4 · antirrábica vence **durante** a estadia. O aviso nasce com a reserva. */
    id: 'res-bidu',
    petId: 'pet-bidu',
    acomodacaoId: 'acom-a5',
    entradaEmDias: 3,
    saidaEmDias: 12,
    horaEntrada: '10:00',
    horaSaida: '11:00',
    status: 'confirmada',
    origem: 'balcao',
    servicos: [
      { servicoId: 'servico-banho', quantidade: 1 },
      { servicoId: 'servico-transporte', quantidade: 2 },
    ],
    pagoPercentual: 30,
  },
  {
    id: 'res-luna',
    petId: 'pet-luna',
    acomodacaoId: 'acom-b2',
    entradaEmDias: 5,
    saidaEmDias: 9,
    horaEntrada: '08:00',
    horaSaida: '12:00',
    status: 'pendente',
    origem: 'whatsapp',
    observacao: 'Aguardando o sinal. Responsável pediu para segurar até sexta.',
    pagoPercentual: 0,
  },
  {
    id: 'res-maximiliano',
    petId: 'pet-maximiliano',
    acomodacaoId: 'acom-s2',
    entradaEmDias: 8,
    saidaEmDias: 15,
    horaEntrada: '09:00',
    horaSaida: '10:00',
    status: 'confirmada',
    origem: 'indicacao',
    servicos: [{ servicoId: 'servico-adestramento', quantidade: 1 }],
    observacao: 'Contenção dupla na saída para passeio. Cardiopata — sem esforço prolongado.',
    pagoPercentual: 30,
  },
  {
    id: 'res-pandora',
    petId: 'pet-pandora',
    acomodacaoId: 'acom-g3',
    entradaEmDias: 10,
    saidaEmDias: 17,
    horaEntrada: '11:00',
    horaSaida: '11:00',
    status: 'confirmada',
    origem: 'retorno',
    pagoPercentual: 30,
  },

  // --------------------------------------------------------------- encerradas e perdidas
  {
    id: 'res-oliver',
    petId: 'pet-oliver',
    acomodacaoId: 'acom-g4',
    entradaEmDias: -12,
    saidaEmDias: -6,
    horaEntrada: '10:00',
    horaSaida: '10:30',
    status: 'encerrada',
    origem: 'balcao',
    pagoPercentual: 100,
  },
  {
    id: 'res-lola',
    petId: 'pet-lola',
    acomodacaoId: 'acom-b3',
    entradaEmDias: -9,
    saidaEmDias: -5,
    horaEntrada: '09:00',
    horaSaida: '11:00',
    status: 'encerrada',
    origem: 'app',
    pagoPercentual: 100,
  },
  {
    /* Não comparecimento: vaga queimada, e é isto que o distingue de um cancelamento. */
    id: 'res-cacau',
    petId: 'pet-cacau',
    acomodacaoId: 'acom-b4',
    entradaEmDias: -3,
    saidaEmDias: -1,
    horaEntrada: '09:00',
    horaSaida: '10:00',
    status: 'nao-compareceu',
    origem: 'telefone',
    pagoPercentual: 30,
  },
  {
    id: 'res-nero',
    petId: 'pet-nero',
    acomodacaoId: 'acom-a6',
    entradaEmDias: 4,
    saidaEmDias: 8,
    horaEntrada: '09:00',
    horaSaida: '10:00',
    status: 'cancelada',
    origem: 'balcao',
    pagoPercentual: 0,
  },
]

/**
 * Plano alimentar por espécie, para a ficha não nascer vazia.
 *
 * A porção segue a regra que a nutrição veterinária usa: a necessidade energética não é linear
 * com o peso, cresce com `peso^0,75`. A primeira versão multiplicava o peso por um número fixo, e
 * a prancheta saía dizendo **796 g numa refeição** para um cão de 44 kg — quase o dobro do que ele
 * come num dia inteiro. Num protótipo de demonstração, um número assim não é um detalhe: é o que
 * faz quem entende do assunto parar de acreditar no resto da tela.
 */
function planoDe(pet: Pet | undefined) {
  const felino = pet?.especie === 'felina'
  const peso = pet?.pesoKg ?? 10
  const refeicoes = felino ? 3 : 2

  /* ~30 g de ração seca por dia para cada unidade de peso metabólico, dividido nas refeições. */
  const porDia = 30 * peso ** 0.75

  return {
    racaoPropria: true,
    marca: felino ? 'Ração terapêutica renal' : 'Premier Formula',
    porcaoGramas: Math.max(20, Math.round(porDia / refeicoes / 5) * 5),
    horarios: felino ? ['07:00', '13:00', '19:00'] : ['08:00', '18:00'],
    restricoes: felino ? 'Sem petisco industrializado' : '',
    petiscos: felino ? '' : 'Um biscoito após o passeio da tarde',
  }
}

export function gerarDataset(semente: number = SEMENTE_PADRAO): SeedResult {
  const ancora = clock.today()
  const agora = clock.nowIso()

  /*
   * Dois geradores, e a razão está no cabeçalho do arquivo: `rngCasa` monta o que não depende do
   * relógio (recheio do mapa, fila de espera), `rngDia` decide o que já aconteceu hoje. Juntos,
   * a hora em que a página abre deslocaria o primeiro.
   */
  const rngCasa = createPrng(semente)
  const rngDia = createPrng(semente ^ 0x9e37)

  const pets = petsFixture.map((pet) => ({ ...pet }))
  const tutores = tutorsFixture.map((tutor) => ({ ...tutor }))
  const petPorId = new Map(pets.map((pet) => [pet.id, pet]))

  const temporadas = materializarTemporadas(temporadasFixture, ancora)

  const acomodacoes = acomodacoesFixture.map<Acomodacao>((acomodacao) =>
    acomodacao.ativa
      ? { ...acomodacao }
      : {
          ...acomodacao,
          /* Caso C5 · parada há três semanas. O número é a informação, não o rótulo. */
          inativaDesde: iso(addDays(ancora, -21), '08:00'),
        },
  )

  const acomodacaoPorId = new Map(acomodacoes.map((item) => [item.id, item]))
  const tarifaPorId = new Map(tarifasFixture.map((item) => [item.id, item]))

  // -------------------------------------------------------------------------
  // Comprovantes
  // -------------------------------------------------------------------------

  const comprovantes: Comprovante[] = []
  let sequenciaDeComprovante = 0

  function comprovante(
    petId: string,
    kind: Comprovante['kind'],
    apresentadoEm: ISODate,
    validoAte: ISODate | null,
    documento: string,
  ) {
    sequenciaDeComprovante += 1

    comprovantes.push({
      id: `comp-${sequenciaDeComprovante.toString(36)}`,
      petId,
      kind,
      apresentadoEm,
      validoAte,
      documento,
      observacao: '',
    })
  }

  for (const pet of pets) {
    if (pet.especie !== 'canina' && pet.especie !== 'felina') {
      continue
    }

    /*
     * Cada animal tem a carteira em dia, com folga sorteada — e três exceções escritas à mão logo
     * abaixo. Sortear a exceção faria o caso mais importante do módulo aparecer ou não conforme a
     * semente.
     */
    const folga = intBetween(rngCasa, 60, 300)
    const aplicada = addDays(ancora, -(365 - folga))

    comprovante(pet.id, 'vacina-antirrabica', aplicada, addDays(aplicada, 365), 'Lote 24B-1180')
    comprovante(
      pet.id,
      'vacina-polivalente',
      addDays(aplicada, -20),
      addDays(aplicada, 345),
      'Lote 24A-9042',
    )
    comprovante(pet.id, 'termo-responsabilidade', addDays(ancora, -200), null, 'Termo assinado')

    if (pet.especie === 'canina') {
      comprovante(
        pet.id,
        'vacina-tosse-canis',
        addDays(aplicada, 10),
        addDays(aplicada, 375),
        'Lote 24C-3311',
      )
    }

    /*
     * Os não bloqueantes existem para quase todo mundo.
     *
     * Na primeira rodada eles simplesmente não eram criados, e o resultado apareceu na primeira
     * captura de tela: **toda** reserva saía marcada como documentação pendente, porque faltava o
     * antipulgas de todo mundo. O defeito real era de semântica — o selo somava o que não decide
     * nada —, e está corrigido em `situacaoParaSelo`. Mas um dataset em que ninguém tem os papéis
     * opcionais também não é uma casa plausível: hotel que opera tem a ficha dos hóspedes completa.
     */
    comprovante(
      pet.id,
      'vermifugo',
      addDays(ancora, -intBetween(rngCasa, 10, 120)),
      addDays(ancora, intBetween(rngCasa, 40, 150)),
      'Receita 8821',
    )

    comprovante(
      pet.id,
      'antipulgas',
      addDays(ancora, -intBetween(rngCasa, 2, 20)),
      addDays(ancora, intBetween(rngCasa, 10, 25)),
      'Aplicação registrada',
    )

    /* O parasitológico é o único que fica faltando em parte da casa: nem todo hotel o exige. */
    if (rngCasa() > 0.3) {
      comprovante(
        pet.id,
        'exame-parasitologico',
        addDays(ancora, -intBetween(rngCasa, 10, 100)),
        addDays(ancora, intBetween(rngCasa, 40, 120)),
        'Laudo 4471',
      )
    }
  }

  /*
   * Caso C3 · o Zeus chega hoje sem tosse dos canis. O comprovante é **removido** em vez de nunca
   * ser criado para que a regra seja exercida contra um cadastro normal: é assim que ela vai
   * encontrar o problema na casa de verdade.
   */
  const semTosseDeCanis = comprovantes.findIndex(
    (item) => item.petId === 'pet-zeus' && item.kind === 'vacina-tosse-canis',
  )

  if (semTosseDeCanis >= 0) {
    comprovantes.splice(semTosseDeCanis, 1)
  }

  /* Caso C4 · a antirrábica do Bidu vence entre a entrada (dia +3) e a saída (dia +12). */
  for (const item of comprovantes) {
    if (item.petId === 'pet-bidu' && item.kind === 'vacina-antirrabica') {
      item.apresentadoEm = addDays(ancora, -358)
      item.validoAte = addDays(ancora, 7)
    }
  }

  // -------------------------------------------------------------------------
  // Reservas
  // -------------------------------------------------------------------------

  const reservas: Reserva[] = []

  function montarReserva(roteiro: RoteiroDeReserva): Reserva | null {
    const pet = petPorId.get(roteiro.petId)
    const acomodacao = acomodacaoPorId.get(roteiro.acomodacaoId)
    const tarifa = acomodacao ? tarifaPorId.get(acomodacao.tarifaId) : undefined

    if (!pet || !acomodacao || !tarifa) {
      return null
    }

    const entradaPrevista = iso(addDays(ancora, roteiro.entradaEmDias), roteiro.horaEntrada)
    const saidaPrevista = iso(addDays(ancora, roteiro.saidaEmDias), roteiro.horaSaida)
    const acompanhante = roteiro.acompanhantePetId
      ? petPorId.get(roteiro.acompanhantePetId)
      : undefined

    const servicos = (roteiro.servicos ?? []).map((contratado) => {
      const servico = servicosFixture.find((item) => item.id === contratado.servicoId)

      return {
        servicoId: contratado.servicoId,
        quantidade: contratado.quantidade,
        precoUnitarioCentavos: servico?.precoCentavos ?? 0,
        observacao: '',
      }
    })

    const orcamento = montarOrcamento({
      entrada: entradaPrevista,
      saida: saidaPrevista,
      tarifa,
      porte: pet.porte,
      porteAcompanhante: acompanhante?.porte ?? null,
      temporadas,
      servicos,
      catalogoDeServicos: servicosFixture,
      politica: hotelFixture.politica,
    })

    const pagoCentavos = Math.round((orcamento.totalCentavos * roteiro.pagoPercentual) / 100)
    const criadoEm = iso(
      addDays(ancora, roteiro.entradaEmDias - intBetween(rngCasa, 5, 40)),
      '10:20',
    )

    return {
      id: roteiro.id,
      petId: pet.id,
      tutorId: pet.tutorId,
      acompanhantePetId: acompanhante?.id ?? null,
      acomodacaoId: acomodacao.id,
      entradaPrevista,
      saidaPrevista,
      diarias: Math.max(
        1,
        diffDays(addDays(ancora, roteiro.entradaEmDias), addDays(ancora, roteiro.saidaEmDias)),
      ),
      status: roteiro.status,
      origem: roteiro.origem,
      servicos,
      orcamento: { ...orcamento, saldoCentavos: orcamento.totalCentavos - pagoCentavos },
      pagoCentavos,
      observacao: roteiro.observacao ?? '',
      /* Uma parte das reservas combina quem mais pode buscar — é o caso comum da família. */
      autorizadosARetirar:
        hashSeed(roteiro.id) % 3 === 0
          ? [
              pickFrom(
                rngCasa,
                ['Marcos Fontenelle', 'Clara Okamoto', 'Vovó Sueli'],
                'Clara Okamoto',
              ),
            ]
          : [],
      dispensas: [],
      criadoEm,
      atualizadoEm: criadoEm,
      /*
       * Cancelamento acontece **antes da entrada**, nunca depois.
       * Com o roteiro escrito à mão, que só cancela reserva futura, uma data fixa dois dias atrás
       * bastava. O recheio histórico quebrou isso: uma estadia de quarenta dias atrás cancelada
       * anteontem é uma linha do tempo impossível.
       */
      canceladaEm:
        roteiro.status === 'cancelada'
          ? iso(addDays(ancora, Math.min(-2, roteiro.entradaEmDias - 2)), '16:40')
          : null,
      motivoCancelamento: roteiro.status === 'cancelada' ? 'viagem-cancelada' : null,
    }
  }

  for (const roteiro of ROTEIRO) {
    const reserva = montarReserva(roteiro)

    if (reserva) {
      reservas.push(reserva)
    }
  }

  /**
   * O recheio: as estadias que **já aconteceram**.
   *
   * Sem elas o hotel nasce sem passado, e a única tela que olha para trás mostra o que se viu na
   * captura de apresentação: ocupação média de 5%, gráfico chapado e "retorno 0%". Nenhum desses
   * números estava errado — o mês simplesmente não existia.
   *
   * O recheio fica **só no passado**, de propósito. Encher também o futuro tiraria do mapa os
   * vazios entre as barras, que são a informação que aquela tela existe para dar: quem atende o
   * telefone procura o buraco, não a barra.
   */
  const DIAS_DE_HISTORIA = 45

  /**
   * A janela que o resumo abre por padrão. O recheio começa **antes** dela de propósito.
   *
   * O retorno é medido contra quem já tinha vindo antes do início do período. Sem nada anterior à
   * janela, a taxa nasce zero; com o cadastro inteiro circulando desde sempre, nasce 100%. Os dois
   * extremos são igualmente inúteis para quem abre a tela.
   */
  const JANELA_DO_RESUMO = 30

  /**
   * Um terço dos responsáveis é **novo**: só aparece dentro da janela do resumo.
   *
   * É o que dá ao retorno um número no meio da escada. Escolhido pelo hash do id, e não sorteado,
   * para que o mesmo responsável seja novo em toda regeneração do dataset.
   */
  const tutoresNovos = new Set(
    [...new Set(pets.map((pet) => pet.tutorId))].filter((id) => hashSeed(id) % 3 === 0),
  )

  /**
   * Onde cada animal já esteve, para que ele não esteja em dois lugares ao mesmo tempo.
   *
   * A invariante de sobreposição do módulo é por **acomodação** — ela protege a venda, que é o que
   * a regra R2 existe para proteger. Gerando o recheio acomodação por acomodação, essa invariante
   * continua satisfeita enquanto o mesmo cachorro aparece em quatro baias no mesmo dia, que foi
   * exatamente o que a captura da lista de reservas mostrou.
   *
   * O roteiro escrito à mão entra aqui antes de tudo: o recheio não pode marcar um animal que já
   * está hospedado ou que chega amanhã.
   */
  const agendaDoPet = new Map<string, { de: number; ate: number }[]>()

  for (const roteiro of ROTEIRO) {
    const agenda = agendaDoPet.get(roteiro.petId) ?? []

    agenda.push({ de: roteiro.entradaEmDias, ate: roteiro.saidaEmDias })
    agendaDoPet.set(roteiro.petId, agenda)

    if (roteiro.acompanhantePetId) {
      const doAcompanhante = agendaDoPet.get(roteiro.acompanhantePetId) ?? []

      doAcompanhante.push({ de: roteiro.entradaEmDias, ate: roteiro.saidaEmDias })
      agendaDoPet.set(roteiro.acompanhantePetId, doAcompanhante)
    }
  }

  /* Livre no período, com um dia de folga de cada lado: ninguém sai de manhã e entra de tarde. */
  function petEstaLivre(petId: string, de: number, ate: number): boolean {
    return (agendaDoPet.get(petId) ?? []).every((faixa) => ate + 1 < faixa.de || de - 1 > faixa.ate)
  }

  for (const acomodacao of acomodacoes.filter((item) => item.ativa)) {
    const cabem = pets.filter(
      (pet) =>
        porteCabe(pet.porte, acomodacao.porteMaximo) &&
        (acomodacao.especiesAceitas.length === 0 ||
          acomodacao.especiesAceitas.includes(pet.especie)),
    )

    if (cabem.length === 0) {
      continue
    }

    let dia = -DIAS_DE_HISTORIA

    while (dia < -1) {
      const noites = intBetween(rngCasa, 2, 7)
      const saida = dia + noites

      /*
       * Para de encostar no presente. Uma estadia de fundo que terminasse hoje disputaria a
       * acomodação com o roteiro escrito à mão — e o roteiro é que carrega os casos plantados.
       */
      if (saida > -1) {
        break
      }

      /* Antes da janela do resumo, só quem já era cliente da casa — e sempre, só quem está livre. */
      const elegiveis = cabem.filter(
        (pet) =>
          petEstaLivre(pet.id, dia, saida) &&
          (dia >= -JANELA_DO_RESUMO || !tutoresNovos.has(pet.tutorId)),
      )

      if (elegiveis.length === 0) {
        dia = saida + intBetween(rngCasa, 1, 5)

        continue
      }

      const pet = pickFrom(rngCasa, elegiveis, elegiveis[0]!)

      /*
       * O desfecho. A maioria aconteceu; o resto é o que a tela de resumo chama de perda, e
       * precisa existir para o cartão não mostrar dois zeros.
       */
      const sorte = rngCasa()
      const status: Reserva['status'] =
        sorte > 0.94 ? 'nao-compareceu' : sorte > 0.88 ? 'cancelada' : 'encerrada'

      const roteiro: RoteiroDeReserva = {
        id: `res-fundo-${acomodacao.id}-${dia + DIAS_DE_HISTORIA}`,
        petId: pet.id,
        acomodacaoId: acomodacao.id,
        entradaEmDias: dia,
        saidaEmDias: saida,
        horaEntrada: pickFrom(rngCasa, ['08:30', '09:00', '10:00', '14:00'], '09:00'),
        horaSaida: pickFrom(rngCasa, ['10:00', '11:00', '16:00'], '11:00'),
        status,
        origem: pickFrom(
          rngCasa,
          ['balcao', 'telefone', 'whatsapp', 'app', 'retorno', 'indicacao'],
          'balcao',
        ),
        servicos: rngCasa() > 0.55 ? [{ servicoId: 'servico-banho', quantidade: 1 }] : undefined,
        pagoPercentual: status === 'encerrada' ? 100 : 50,
      }

      const reserva = montarReserva(roteiro)

      if (reserva) {
        reservas.push(reserva)
        agendaDoPet.set(pet.id, [...(agendaDoPet.get(pet.id) ?? []), { de: dia, ate: saida }])
      }

      /* A folga entre uma estadia e a seguinte, que é o que impede a casa de parecer 100% cheia. */
      dia = saida + intBetween(rngCasa, 1, 5)
    }
  }

  // -------------------------------------------------------------------------
  // Hospedagens
  // -------------------------------------------------------------------------

  const hospedagens: Hospedagem[] = []
  const medicacoes: MedicacaoDaEstadia[] = []
  const preferencias: PreferenciaDeBoletim[] = []

  for (const reserva of reservas.filter((item) => item.status === 'hospedado')) {
    const pet = petPorId.get(reserva.petId)

    if (!pet) {
      continue
    }

    const hospedagemId = `hosp-${reserva.id.replace('res-', '')}`
    const saiHoje = reserva.saidaPrevista.slice(0, 10) === ancora

    hospedagens.push({
      id: hospedagemId,
      reservaId: reserva.id,
      petId: pet.id,
      tutorId: pet.tutorId,
      acomodacaoId: reserva.acomodacaoId,
      entradaEm: reserva.entradaPrevista,
      saidaPrevistaEm: reserva.saidaPrevista,
      saidaEm: null,
      status: 'hospedado',
      pesoEntradaKg: pet.pesoKg ?? 10,
      /*
       * Caso C1 · quem sai hoje ainda **não foi pesado**. É o impedimento de saída mais fácil de
       * resolver e o mais esquecido — trinta segundos de balança que deixam de existir no instante
       * em que o carro sai.
       */
      pesoSaidaKg: null,
      inspecaoDeEntrada:
        pet.id === 'pet-bento'
          ? 'Carrapato na orelha direita, removido na chegada.'
          : 'Sem alterações.',
      pertences: pertencesDe(hospedagemId, pet, saiHoje),
      planoAlimentar: planoDe(pet),
      autorizacoes: [
        {
          kind: 'banho',
          concedida: true,
          limiteCentavos: null,
          registradaEm: reserva.entradaPrevista,
        },
        {
          kind: 'passeio-externo',
          concedida: pet.especie === 'canina',
          limiteCentavos: null,
          registradaEm: reserva.entradaPrevista,
        },
        {
          kind: 'recreacao-em-grupo',
          concedida: pet.especie === 'canina' && pet.id !== 'pet-maximiliano',
          limiteCentavos: null,
          registradaEm: reserva.entradaPrevista,
        },
        {
          kind: 'foto-em-rede-social',
          concedida: rngCasa() > 0.3,
          limiteCentavos: null,
          registradaEm: reserva.entradaPrevista,
        },
        {
          kind: 'atendimento-veterinario',
          concedida: true,
          limiteCentavos: 50_000,
          registradaEm: reserva.entradaPrevista,
        },
      ],
      contatoEmergencia: tutores.find((item) => item.id === pet.tutorId)?.telefoneSecundario ?? '',
      veterinarioDeConfianca: 'Clínica PetJourney — (11) 3555-0142',
      adaptacao:
        pet.id === 'pet-tofu' ? 'estressado' : pet.id === 'pet-nina' ? 'em-adaptacao' : 'tranquilo',
      observacao: reserva.observacao,
      recebidoPor: pickFrom(rngCasa, ['eq-bruna', 'eq-helena'], 'eq-bruna'),
      entreguePor: null,
      retiradoPor: '',
    })

    preferencias.push({
      hospedagemId,
      frequenciaHoras: pet.id === 'pet-tofu' ? 12 : 24,
      fotoSempre: true,
    })

    /* Só o Tofu tem medicação em curso — e é ela que dá conteúdo à aba de medicação. */
    if (pet.id === 'pet-tofu') {
      medicacoes.push({
        id: `med-${hospedagemId}-1`,
        hospedagemId,
        descricao: 'Benazepril 5 mg',
        via: 'oral',
        doseTexto: '1/2 comprimido',
        horarios: ['08:00', '20:00'],
        inicio: reserva.entradaPrevista.slice(0, 10),
        fim: null,
        receita: 'Receita 2026-0441 · Dra. Paula Ramos',
        observacao: 'Dar com comida.',
        suspensaEm: null,
      })
    }
  }

  // -------------------------------------------------------------------------
  // Rotina do dia
  // -------------------------------------------------------------------------

  const tarefas: TarefaDeRotina[] = []
  let sequenciaDeTarefa = 0

  for (const hospedagem of hospedagens) {
    const passeioAutorizado = hospedagem.autorizacoes.some(
      (item) => item.kind === 'passeio-externo' && item.concedida,
    )

    /* A reserva é quem sabe o que foi vendido — e é o que vira banho e passeio extra na prancheta. */
    const reservaDaHospedagem = reservas.find((item) => item.id === hospedagem.reservaId)

    /* Ontem e hoje: a prancheta precisa de história para que "o que ficou" exista. */
    for (const dia of [addDays(ancora, -1), ancora]) {
      const planejadas = planejarDia({
        hospedagemId: hospedagem.id,
        dia,
        utcOffset: HOTEL_UTC_OFFSET,
        planoAlimentar: hospedagem.planoAlimentar,
        medicacoes: medicacoes.filter((item) => item.hospedagemId === hospedagem.id),
        passeioAutorizado,
        entradaEm: hospedagem.entradaEm,
        saidaPrevistaEm: hospedagem.saidaPrevistaEm,
        servicos: reservaDaHospedagem?.servicos ?? [],
        catalogoDeServicos: servicosFixture,
      })

      for (const planejada of planejadas) {
        sequenciaDeTarefa += 1

        const jaPassou = planejada.previstaPara < agora
        /*
         * O que passou está feito — quase tudo. A fatia que fica pendente é o que dá à prancheta
         * uma linha atrasada de verdade, e ela vem de `rngDia` justamente porque depende do
         * relógio.
         */
        const feita = jaPassou && rngDia() > 0.12

        tarefas.push({
          id: `tarefa-${sequenciaDeTarefa.toString(36)}`,
          ...planejada,
          status: feita ? 'feita' : 'pendente',
          executadaEm: feita ? planejada.previstaPara : null,
          executadaPor: feita
            ? pickFrom(rngDia, ['eq-rafael', 'eq-tais', 'eq-caio'], 'eq-rafael')
            : null,
          turnoId: null,
          observacao: '',
        })
      }
    }
  }

  /*
   * Caso C2 · o Tofu recusou as refeições de hoje. Escrito à mão porque é a origem da ocorrência
   * grave logo abaixo: recusa alimentar de um renal crônico não é uma linha do diário.
   */
  for (const tarefa of tarefas) {
    if (
      tarefa.kind === 'refeicao' &&
      tarefa.hospedagemId === 'hosp-tofu' &&
      tarefa.previstaPara < agora
    ) {
      tarefa.status = 'recusada'
      tarefa.executadaEm = tarefa.previstaPara
      tarefa.executadaPor = 'eq-tais'
      tarefa.observacao = 'Cheirou e saiu. Não encostou na ração.'
    }
  }

  // -------------------------------------------------------------------------
  // Diário, ocorrências e boletins
  // -------------------------------------------------------------------------

  const diario: RegistroDoDiario[] = []
  let sequenciaDeRegistro = 0

  /**
   * Os momentos que viram diário.
   *
   * Cada um tem variantes, escolhidas por uma semente derivada do **animal e do dia** — não por
   * sorteio livre. A primeira versão filtrava os momentos com `rng() > 0,62` e, na captura de
   * tela, o Tofu apareceu com o diário **vazio**. O diário é o que o responsável de fato compra;
   * um protótipo que o mostra vazio vende a parte errada do produto.
   */
  const MOMENTOS: {
    kind: RegistroDoDiario['kind']
    hora: string
    variantes: readonly string[]
  }[] = [
    {
      kind: 'passeio',
      hora: '10:15',
      variantes: [
        'Passeou no gramado por vinte minutos. Voltou cansado e bebeu água.',
        'Deu duas voltas na área externa e parou para cheirar cada canteiro.',
        'Preferiu andar devagar hoje. Voltou tranquilo e deitou na sombra.',
      ],
    },
    {
      kind: 'brincadeira',
      hora: '14:40',
      variantes: [
        'Brincou de bolinha com o grupo da tarde. Nenhum atrito.',
        'Passou a tarde com o brinquedo de corda, sozinho e contente.',
        'Correu atrás da bola até cansar. Bebeu bastante água depois.',
      ],
    },
    {
      kind: 'carinho',
      hora: '17:00',
      variantes: [
        'Ficou vinte minutos no colo. Ronronou o tempo todo.',
        'Pediu carinho na grade assim que a gente passou.',
        'Dormiu encostado na mão da Taís durante a escovação.',
      ],
    },
    {
      kind: 'sono',
      hora: '22:30',
      variantes: [
        'Dormiu a noite inteira sem chorar.',
        'Demorou a se acomodar, mas dormiu direto depois das onze.',
        'Dormiu enroscado no cobertor que veio de casa.',
      ],
    },
  ]

  for (const hospedagem of hospedagens) {
    for (const dia of [addDays(ancora, -1), ancora]) {
      for (const momento of MOMENTOS) {
        const registradoEm = iso(dia, momento.hora)

        /* Nada antes da entrada nem depois de agora: o diário é registro, não previsão. */
        if (registradoEm > agora || registradoEm < hospedagem.entradaEm) {
          continue
        }

        sequenciaDeRegistro += 1

        /*
         * A variante e a foto saem de uma semente do par animal-dia: o mesmo hóspede não repete o
         * mesmo texto dois dias seguidos, e dois hóspedes não contam a mesma tarde.
         */
        const semente = hashSeed(`${hospedagem.petId}-${dia}-${momento.kind}`)
        const variante = momento.variantes[semente % momento.variantes.length]!

        diario.push({
          id: `diario-${sequenciaDeRegistro.toString(36)}`,
          hospedagemId: hospedagem.id,
          kind: momento.kind,
          texto: variante,
          foto: semente % 3 === 0 ? (petPorId.get(hospedagem.petId)?.iniciais ?? null) : null,
          registradoEm,
          registradoPor: pickFrom(rngCasa, ['eq-rafael', 'eq-tais', 'eq-caio'], 'eq-tais'),
          turnoId: null,
        })
      }
    }
  }

  const ocorrencias: Ocorrencia[] = (
    [
      {
        /* Caso C2 · grave e sem contato. Trava a passagem de turno e o check-out. */
        id: 'ocor-tofu-1',
        hospedagemId: 'hosp-tofu',
        kind: 'recusa-alimentar',
        gravidade: 'grave',
        descricao: 'Não come desde ontem à noite. Quatro refeições recusadas seguidas.',
        conduta:
          'Ração aquecida e oferecida à mão. Água aceita. Veterinária de retaguarda avisada.',
        registradaEm: iso(ancora, '07:40'),
        registradaPor: 'eq-tais',
        exigeContato: true,
        contatoEm: null,
        contatoPor: null,
        encaminhadaAoVeterinario: true,
      },
      {
        id: 'ocor-nina-1',
        hospedagemId: 'hosp-nina',
        kind: 'estresse',
        gravidade: 'leve',
        descricao: 'Chorou na primeira noite, entre 23h e 1h.',
        conduta: 'Cobertor de casa colocado na cama. Dormiu depois disso.',
        registradaEm: iso(ancora, '01:20'),
        registradaPor: 'eq-caio',
        exigeContato: false,
        contatoEm: null,
        contatoPor: null,
        encaminhadaAoVeterinario: false,
      },
      {
        /* Uma grave **já comunicada**: sem ela, a tela nunca mostraria o estado resolvido. */
        id: 'ocor-bento-1',
        hospedagemId: 'hosp-bento',
        kind: 'briga',
        gravidade: 'grave',
        descricao: 'Atrito com outro cão na área de recreação. Arranhão superficial no focinho.',
        conduta: 'Separados. Limpeza com clorexidina. Recreação individual desde então.',
        registradaEm: iso(addDays(ancora, -2), '15:10'),
        registradaPor: 'eq-rafael',
        exigeContato: true,
        contatoEm: iso(addDays(ancora, -2), '15:35'),
        contatoPor: 'eq-helena',
        encaminhadaAoVeterinario: false,
      },
    ] satisfies Ocorrencia[]
  ).filter((ocorrencia) => hospedagens.some((item) => item.id === ocorrencia.hospedagemId))

  const boletins: Boletim[] = hospedagens.flatMap<Boletim>((hospedagem) => {
    const ontem = iso(addDays(ancora, -1), '19:00')

    if (ontem < hospedagem.entradaEm) {
      return []
    }

    const pet = petPorId.get(hospedagem.petId)
    const travado = ocorrencias.some(
      (item) => item.hospedagemId === hospedagem.id && item.exigeContato && !item.contatoEm,
    )

    return [
      {
        id: `bol-${hospedagem.id}-1`,
        hospedagemId: hospedagem.id,
        status: travado ? 'retido' : 'enviado',
        texto: travado
          ? `${pet?.nome ?? ''} recusou as refeições de hoje. Precisamos falar com você antes de mandar o boletim.`
          : `${pet?.nome ?? ''} comeu bem, passeou e dormiu a noite inteira. Está tranquilo.`,
        fotos: pet?.iniciais ? [pet.iniciais] : [],
        geradoEm: ontem,
        autorId: 'eq-helena',
        enviadoEm: travado ? null : ontem,
        exigeContato: travado,
        contatoEm: null,
      },
    ]
  })

  // -------------------------------------------------------------------------
  // Turnos
  // -------------------------------------------------------------------------

  const turnos: Turno[] = [
    {
      id: `turno-${ancora}-manha`,
      kind: 'manha',
      inicio: iso(ancora, '06:00'),
      fim: iso(ancora, '14:00'),
      responsavelId: 'eq-rafael',
      entregueEm: null,
      recebidoPor: null,
      notaDePassagem: '',
      pendenciasEntregues: [],
    },
    {
      id: `turno-${ancora}-tarde`,
      kind: 'tarde',
      inicio: iso(ancora, '14:00'),
      fim: iso(ancora, '22:00'),
      responsavelId: 'eq-tais',
      entregueEm: null,
      recebidoPor: null,
      notaDePassagem: '',
      pendenciasEntregues: [],
    },
    {
      id: `turno-${ancora}-noite`,
      kind: 'noite',
      inicio: iso(ancora, '22:00'),
      fim: iso(addDays(ancora, 1), '06:00'),
      responsavelId: 'eq-caio',
      entregueEm: null,
      recebidoPor: null,
      notaDePassagem: '',
      pendenciasEntregues: [],
    },
  ]

  // -------------------------------------------------------------------------
  // Lista de espera
  // -------------------------------------------------------------------------

  const espera: EntradaDeEspera[] = [
    {
      id: 'espera-1',
      petId: 'pet-jack',
      tutorId: 'tutor-daniel',
      entradaDesejada: addDays(ancora, 3),
      saidaDesejada: addDays(ancora, 10),
      kindsAceitos: ['baia', 'suite'],
      status: 'aguardando',
      criadoEm: iso(addDays(ancora, -4), '11:00'),
      ofertadaEm: null,
      ofertaExpiraEm: null,
      observacao: 'Aceita qualquer bloco. Precisa de vaga no mesmo período da irmã.',
    },
    {
      id: 'espera-2',
      petId: 'pet-simba',
      tutorId: 'tutor-heitor',
      entradaDesejada: addDays(ancora, 10),
      saidaDesejada: addDays(ancora, 17),
      kindsAceitos: ['gatil'],
      status: 'aguardando',
      criadoEm: iso(addDays(ancora, -2), '16:30'),
      ofertadaEm: null,
      ofertaExpiraEm: null,
      observacao: '',
    },
  ]

  return {
    semente,
    ancora,
    hotel: hotelFixture,
    blocos: blocosFixture,
    acomodacoes,
    tarifas: tarifasFixture,
    temporadas,
    temporadasSazonais: temporadasFixture,
    servicos: servicosFixture,
    exigencias: exigenciasFixture,
    cuidadores: cuidadoresFixture,
    comprovantes,
    reservas,
    hospedagens,
    medicacoes,
    tarefas,
    diario,
    ocorrencias,
    boletins,
    preferencias,
    turnos,
    espera,
    pets,
    tutores,
    casos: CASOS,
  }
}

/**
 * Pertences de uma estadia.
 *
 * Quem sai hoje leva um item **sem conferência**, de propósito: é o caso C1, e é o impedimento de
 * check-out que a regra R4 existe para produzir.
 */
function pertencesDe(hospedagemId: string, pet: Pet, saiHoje: boolean) {
  const base = [
    { descricao: 'Coleira e guia', quantidade: 1 },
    { descricao: 'Caminha', quantidade: 1 },
    { descricao: 'Pote de ração identificado', quantidade: 1 },
  ]

  if (pet.especie === 'felina') {
    base.push({ descricao: 'Caixa de transporte', quantidade: 1 })
  } else {
    base.push({ descricao: 'Brinquedo de corda', quantidade: 1 })
  }

  return base.map((item, indice) => ({
    id: `pert-${hospedagemId}-${indice}`,
    descricao: item.descricao,
    quantidade: item.quantidade,
    /* Só quem sai hoje tem conferência começada — e ela está pela metade. */
    devolvido: saiHoje && indice < base.length - 1,
    observacao: '',
  }))
}

/**
 * Os casos plantados, com o caminho até cada um.
 *
 * Existe porque um caso que o apresentador não acha é um caso que não existe. Esta lista é o que o
 * painel de desenvolvimento mostra.
 */
export const CASOS: CasoDoHotel[] = [
  {
    id: 'c1',
    titulo: 'Saída tardia com pertence pendente e sem pesagem',
    descricao:
      'O Bento sai hoje às 16h30 — depois do horário de saída, meia diária na conta. E o check-out não fecha: falta conferir um pertence e falta a pesagem de saída.',
    rota: '/hotel/hospedes',
  },
  {
    id: 'c2',
    titulo: 'Ocorrência grave sem contato',
    descricao:
      'O Tofu recusou quatro refeições seguidas. A ocorrência é grave, ninguém ligou ainda, e por isso o boletim está retido e a passagem de turno está travada.',
    rota: '/hotel/painel',
  },
  {
    id: 'c3',
    titulo: 'Chega hoje sem tosse dos canis',
    descricao:
      'O Zeus chega às 15h e não tem comprovante de tosse dos canis. O check-in está bloqueado — ou alguém dispensa a exigência, com nome e motivo.',
    rota: '/hotel/reservas',
  },
  {
    id: 'c4',
    titulo: 'Carteira que vence durante a estadia',
    descricao:
      'A antirrábica do Bidu vale hoje e vence antes da saída. O aviso nasce com a reserva, não no dia da entrada.',
    rota: '/hotel/reservas',
  },
  {
    id: 'c5',
    titulo: 'Acomodação parada há três semanas',
    descricao:
      'A baia A7 está em reforma desde o mês passado. Parada há duas horas é manutenção; parada há três semanas é uma vaga esquecida.',
    rota: '/hotel/acomodacoes',
  },
]
