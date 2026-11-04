/**
 * O cenário da adesão ao tratamento: o remédio de casa, dose a dose, com quem deu.
 *
 * Cada tratamento plantado existe por um caso difícil do requisito:
 *
 * - **Pérola · meloxicam, uso contínuo.** Duas pessoas cuidando: a Fátima dá de manhã durante a
 *   semana e o filho, **Rafael**, aos sábados. Nas primeiras semanas os domingos ficaram **sem
 *   registro** — a gata recebeu o remédio, ninguém marcou. É a casa que dá e não registra, e a
 *   tela não pode ler isso como falta. No retorno de hoje, o vet vê que o anti-inflamatório foi
 *   dado quase todo dia por três meses, numa gata idosa que está perdendo peso e bebendo mais
 *   água — a adesão vira dado clínico.
 * - **Pérola · omeprazol, catorze dias, já terminou.** No mesmo horário do meloxicam: é o aviso
 *   agrupado ("2 remédios às 8h"), e é um tratamento encerrado na ficha.
 * - **Duna · furosemida, de 12 em 12 horas, crítico.** Cavalier com doença de válvula mitral em
 *   insuficiência cardíaca: a Helena marcou como crítico ao prescrever, na consulta de 60 dias
 *   atrás. Dois meses de doses em dia — Lúcia de manhã, Eduardo à noite — e, nos últimos dias, uma
 *   noite sem registro seguida de duas doses puladas: **acabou**. É o alerta da clínica, e o
 *   motivo diz o que fazer: receita nova, não sermão.
 *
 *   A Duna é plantada, e não um paciente da fixture, pelo mesmo motivo da Pérola: o sorteio da
 *   agenda dá consultas recentes aos pacientes da fixture. O caso começou no Nero, e uma consulta
 *   sorteada na véspera fazia a ficha dizer "desde a consulta de ontem: 0 dadas" ao lado de um
 *   alerta de dois dias — a história do caso precisa de uma última consulta desenhada.
 * - **Cacau · tramadol, de 8 em 8 horas por dez dias.** Várias vezes ao dia, por muitos dias —
 *   trinta doses. A dose das 23h quase nunca aparece como dada: o padrão que o vet procura, e a
 *   conversa é trocar o horário.
 * - **Chico · prednisolona.** O responsável que registra tudo: nenhuma dose sem registro. É o
 *   contraste que faz os outros serem lidos.
 *
 * **A dose da vez fica aberta.** Em todo tratamento em curso, a dose cujo horário acabou de
 * chegar (ou chega na próxima hora) não recebe registro: é ela que a demonstração marca, no
 * celular ao lado, em um toque. As de antes recebem o que o roteiro de cada um diz.
 *
 * As datas andam com o relógio, como no resto do dataset, e o ruído dos horários de registro sai
 * de `hashSeed` — não consome os geradores do `seed.ts`.
 */

import {
  dosesDoTratamento,
  emCurso,
  ANTECEDENCIA_DO_REGISTRO_MIN,
  type MotivoDaDosePulada,
  type RegistroDeDose,
} from '../domain/adesao'
import {
  addDays,
  createClinicClock,
  diffDays,
  epochToWall,
  wallToIso,
  weekdayOf,
} from '../domain/clinic-time'
import { calcularDose } from '../domain/dose'

import { CLINIC_UTC_OFFSET, medicationsFixture } from './fixtures'
import { hashSeed } from './mock-runtime'
import type { CasoDificil } from './seed'
import type { ConsultaPlantada } from './seed-resumo'
import type {
  Cuidador,
  Encounter,
  ISODate,
  ISODateTime,
  Pet,
  Prescription,
  TratamentoEmCasa,
  Tutor,
} from './types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

export const TRATAMENTO_DA_DEMONSTRACAO = 'trat-perola-meloxicam'
export const TRATAMENTO_CRITICO = 'trat-duna-furosemida'
export const TRATAMENTO_VARIAS_VEZES_AO_DIA = 'trat-cacau-tramadol'
export const FAMILIAR_DA_DEMONSTRACAO = 'membro-rafael'
export const PET_CARDIOPATA = 'pet-duna'

/** O nascimento anda com o relógio: dez anos e meio, hoje e na semana que vem. */
export function petsDaAdesao(hoje: ISODate): Pet[] {
  return [
    {
      id: PET_CARDIOPATA,
      nome: 'Duna',
      especie: 'canina',
      raca: 'Cavalier King Charles Spaniel',
      sexo: 'femea',
      nascimento: addDays(hoje, -(10 * 365 + 180)),
      castrado: true,
      porte: 'pequeno',
      pesoKg: 9.8,
      microchip: '900215000731166',
      pelagem: 'Blenheim, pelo longo',
      tutorId: 'tutor-eduardo',
      iniciais: 'DU',
      fotoUrl: '/demo/pacientes/duna.jpg',
      alertas: [
        {
          id: 'alerta-duna-1',
          kind: 'cronico',
          severidade: 'atencao',
          detalhe: 'Insuficiência cardíaca congestiva',
        },
      ],
    },
  ]
}

/**
 * A consulta em que a furosemida da Duna nasceu, 60 dias atrás, com a Helena.
 *
 * Entra pelo mesmo caminho das consultas antigas da Pérola (`CONSULTAS_DO_RESUMO`): atendimento
 * finalizado, receita no prontuário e resumo liberado. A prescrição sai **crítica** — é a marca
 * que o vet põe na receita, e é dela que o alerta vive.
 */
export const CONSULTAS_DA_ADESAO: ConsultaPlantada[] = [
  {
    id: 'apt-adesao-duna-1',
    petId: PET_CARDIOPATA,
    diasAtras: 60,
    inicio: '10:00',
    typeId: 'tipo-consulta',
    professionalId: 'prof-helena',
    pesoKg: 9.8,
    queixa: 'Tosse à noite e cansaço no passeio',
    diagnostico: {
      codigo: 'CV-02',
      descricao: 'Doença mixomatosa da valva mitral',
      kind: 'definitivo',
    },
    /* Meio comprimido de 40 mg: 20 mg para 9,8 kg, a dose que a Helena arredondou ao comprimido. */
    prescricao: {
      medicamentoId: 'med-furosemida',
      mgPorKg: 2.04,
      frequenciaHoras: 12,
      duracaoDias: null,
      critico: true,
    },
  },
]

/**
 * A família de quem tem família no cenário. O dono de cada conta entra sozinho, a partir do
 * cadastro; aqui ficam só os convidados.
 *
 * A **Clara** tem acesso de leitura: vê os remédios da Pérola no celular dela, não registra. É o
 * terceiro jeito de estar na casa, e o celular da prévia precisa saber dizer por que o botão não
 * está ali.
 */
const FAMILIA: Cuidador[] = [
  {
    id: FAMILIAR_DA_DEMONSTRACAO,
    tutorId: 'tutor-fatima',
    nome: 'Rafael Gonçalves',
    papel: 'familia',
    acesso: 'edicao',
    petIds: ['pet-perola', 'pet-biscoito'],
  },
  {
    id: 'membro-clara',
    tutorId: 'tutor-fatima',
    nome: 'Clara Gonçalves',
    papel: 'familia',
    acesso: 'leitura',
    petIds: ['pet-perola'],
  },
  {
    id: 'membro-lucia',
    tutorId: 'tutor-eduardo',
    nome: 'Lúcia Bittencourt',
    papel: 'familia',
    acesso: 'edicao',
    petIds: [PET_CARDIOPATA, 'pet-nero', 'pet-thor'],
  },
]

export function cuidadoresDoDataset(tutores: Tutor[], pets: Pet[]): Cuidador[] {
  const donos: Cuidador[] = tutores.map((tutor) => ({
    id: tutor.id,
    tutorId: tutor.id,
    nome: tutor.nome,
    papel: 'dono',
    acesso: 'edicao',
    petIds: pets.filter((pet) => pet.tutorId === tutor.id).map((pet) => pet.id),
  }))

  return [...donos, ...FAMILIA.map((membro) => ({ ...membro, petIds: [...membro.petIds] }))]
}

// ---------------------------------------------------------------------------
// O roteiro de cada tratamento
// ---------------------------------------------------------------------------

type Plano =
  | { situacao: 'dada'; cuidadorId: string; atrasoMin: number }
  | { situacao: 'pulada'; cuidadorId: string; atrasoMin: number; motivo: MotivoDaDosePulada }
  /** Sem registro: a dose passa sem ninguém marcar. */
  | null

type DoseDoRoteiro = {
  numero: number
  previstaEm: ISODateTime
  dia: ISODate
  /** Minutos do dia da dose, na parede da clínica. */
  minuto: number
  diasAtras: number
  /** 0 é a dose mais recente que recebe roteiro; 1, a anterior; e assim por diante. */
  posicaoDoFim: number
}

const dada = (cuidadorId: string, atrasoMin: number): Plano => ({
  situacao: 'dada',
  cuidadorId,
  atrasoMin,
})

const pulada = (cuidadorId: string, atrasoMin: number, motivo: MotivoDaDosePulada): Plano => ({
  situacao: 'pulada',
  cuidadorId,
  atrasoMin,
  motivo,
})

function somarMinutos(iso: ISODateTime, minutos: number): ISODateTime {
  return wallToIso(
    epochToWall(Date.parse(iso) + minutos * 60_000, clock.utcOffset),
    clock.utcOffset,
  )
}

/**
 * Os registros que o roteiro manda, para as doses que já passaram — menos a da vez.
 *
 * A da vez é a última dose cujo registro já abriu. Num tratamento que terminou, não há dose da
 * vez: tudo recebe roteiro.
 */
function plantar(
  tratamento: TratamentoEmCasa,
  agora: ISODateTime,
  hoje: ISODate,
  roteiro: (dose: DoseDoRoteiro) => Plano,
): RegistroDeDose[] {
  const doses = dosesDoTratamento(
    tratamento,
    [],
    agora,
    somarMinutos(agora, ANTECEDENCIA_DO_REGISTRO_MIN),
  )
  const daVez = emCurso(tratamento, agora) ? doses[doses.length - 1] : undefined
  const comRoteiro = doses.filter(
    (dose) => dose !== daVez && Date.parse(dose.previstaEm) <= Date.parse(agora),
  )

  return comRoteiro.flatMap((dose, indice) => {
    const dia = clock.dateOf(dose.previstaEm)
    const plano = roteiro({
      numero: dose.numero,
      previstaEm: dose.previstaEm,
      dia,
      minuto: clock.minutesOf(dose.previstaEm),
      diasAtras: diffDays(dia, hoje),
      posicaoDoFim: comRoteiro.length - 1 - indice,
    })

    if (!plano) {
      return []
    }

    const registradaEm = somarMinutos(dose.previstaEm, plano.atrasoMin)

    return [
      {
        id: `dose-${tratamento.id}-${dose.numero}`,
        tratamentoId: tratamento.id,
        numero: dose.numero,
        situacao: plano.situacao,
        motivo: plano.situacao === 'pulada' ? plano.motivo : null,
        /* Nunca no futuro: a dose anterior à da vez pode ter sido marcada há pouco. */
        registradaEm: Date.parse(registradaEm) <= Date.parse(agora) ? registradaEm : agora,
        cuidadorId: plano.cuidadorId,
      },
    ]
  })
}

/** Um número estável de 0 a `teto - 1` para a mesma chave — o "quanto depois" de cada registro. */
function ruido(chave: string, teto: number): number {
  return hashSeed(chave) % teto
}

// ---------------------------------------------------------------------------
// Os tratamentos
// ---------------------------------------------------------------------------

type Contexto = {
  encounters: Encounter[]
  hoje: ISODate
  agora: ISODateTime
}

function medicamento(id: string) {
  return medicationsFixture.find((item) => item.id === id)!
}

type CamposDoLembrete = {
  id: string
  inicioEm: ISODateTime
  lembreteCriadoEm: ISODateTime
  lembreteCriadoPor: string
  compartilhadoComAClinica?: boolean
}

/**
 * O tratamento que nasce quando alguém da casa cria o lembrete de um item da receita.
 *
 * A posologia é a da prescrição, copiada — como o lembrete do app copia o item da receita. O
 * horário da primeira dose é o que a pessoa escolheu. É a mesma função para o cenário plantado e
 * para o "Criar lembretes" da prévia do celular: um tratamento só tem um jeito de nascer.
 */
export function tratamentoDaPrescricao(
  encounter: Encounter,
  prescricao: Prescription,
  campos: CamposDoLembrete,
): TratamentoEmCasa {
  const remedio = medicamento(prescricao.medicamentoId)

  return {
    id: campos.id,
    petId: encounter.petId,
    tutorId: encounter.tutorId,
    encounterId: encounter.id,
    prescricaoId: prescricao.id,
    medicamentoId: remedio.id,
    medicamento: remedio.nome,
    quantidade: prescricao.calculo.quantidadeApresentacao,
    unidade: remedio.unidadeApresentacao,
    via: prescricao.via,
    instrucoes: prescricao.observacao,
    frequenciaHoras: prescricao.calculo.frequenciaHoras,
    duracaoDias: prescricao.calculo.duracaoDias,
    inicioEm: campos.inicioEm,
    encerradoEm: null,
    critico: prescricao.critico ?? false,
    prescritoPor: encounter.professionalId,
    prescritoEm: encounter.finalizadoEm ?? encounter.abertoEm,
    lembreteCriadoEm: campos.lembreteCriadoEm,
    lembreteCriadoPor: campos.lembreteCriadoPor,
    compartilhadoComAClinica: campos.compartilhadoComAClinica ?? true,
    contato: null,
  }
}

/** O plantado: a primeira prescrição de um atendimento do cenário. */
function daPrescricao(
  ctx: Contexto,
  encounterId: string,
  campos: CamposDoLembrete,
): TratamentoEmCasa | null {
  const encounter = ctx.encounters.find((item) => item.id === encounterId)
  const prescricao = encounter?.conduta.prescricoes[0]

  return encounter && prescricao ? tratamentoDaPrescricao(encounter, prescricao, campos) : null
}

/**
 * O tratamento de antes deste protótipo guardar o atendimento — a receita existe, o prontuário
 * dela não. A dose é calculada como a tela de conduta calcularia.
 */
function semAtendimento(
  campos: Omit<
    TratamentoEmCasa,
    | 'encounterId'
    | 'prescricaoId'
    | 'medicamento'
    | 'quantidade'
    | 'unidade'
    | 'encerradoEm'
    | 'compartilhadoComAClinica'
    | 'contato'
  > & { medicamentoId: string; pesoKg: number; mgPorKg: number },
): TratamentoEmCasa {
  const { pesoKg, mgPorKg, ...resto } = campos
  const remedio = medicamento(campos.medicamentoId)
  const calculo = calcularDose({
    medicamento: remedio,
    pesoKg,
    mgPorKg,
    frequenciaHoras: campos.frequenciaHoras,
    duracaoDias: campos.duracaoDias,
  })

  return {
    ...resto,
    encounterId: null,
    prescricaoId: null,
    medicamento: remedio.nome,
    quantidade: calculo?.quantidadeApresentacao ?? 1,
    unidade: remedio.unidadeApresentacao,
    encerradoEm: null,
    compartilhadoComAClinica: true,
    contato: null,
  }
}

/** Os três casos difíceis do requisito, com a rota que o painel abre. */
export function casosDaAdesao(): CasoDificil[] {
  return (
    [
      ['adesao-sem-registro', 'pet-perola'],
      ['adesao-critico', PET_CARDIOPATA],
      ['adesao-varias-vezes', 'pet-cacau'],
    ] as const
  ).map(([id, petId]) => ({
    id,
    rota: `/clinica/paciente/${petId}/tratamento`,
    appointmentId: null,
    encounterId: null,
  }))
}

export type AdesaoDoDataset = {
  tratamentos: TratamentoEmCasa[]
  registrosDeDose: RegistroDeDose[]
}

export function gerarAdesao(entrada: {
  encounters: Encounter[]
  hoje: ISODate
  agora: ISODateTime
}): AdesaoDoDataset {
  const ctx: Contexto = entrada
  const { hoje, agora } = ctx
  const iso = (diasAtras: number, hora: string) => {
    const [h, m] = hora.split(':').map(Number)

    return clock.toIso(addDays(hoje, -diasAtras), (h ?? 0) * 60 + (m ?? 0))
  }

  const tratamentos: TratamentoEmCasa[] = []
  const registrosDeDose: RegistroDeDose[] = []

  const acrescentar = (
    tratamento: TratamentoEmCasa | null,
    roteiro: (dose: DoseDoRoteiro) => Plano,
  ) => {
    if (tratamento) {
      tratamentos.push(tratamento)
      registrosDeDose.push(...plantar(tratamento, agora, hoje, roteiro))
    }
  }

  /*
   * Pérola. A consulta da displasia foi às 15h30 de 95 dias atrás; a Fátima criou o lembrete à
   * noite, com a primeira dose para as 8h do dia seguinte. O omeprazol veio na consulta de 42
   * dias atrás, no mesmo horário das 8h: um toque só, "dei os dois".
   */
  const toqueDaManha = ({ dia }: DoseDoRoteiro): Plano =>
    weekdayOf(dia) === 6
      ? dada(FAMILIAR_DA_DEMONSTRACAO, 70 + ruido(`perola|${dia}`, 40))
      : dada('tutor-fatima', 3 + ruido(`perola|${dia}`, 35))

  acrescentar(
    daPrescricao(ctx, 'enc-apt-resumo-perola-2', {
      id: TRATAMENTO_DA_DEMONSTRACAO,
      inicioEm: iso(94, '08:00'),
      lembreteCriadoEm: iso(95, '19:40'),
      lembreteCriadoPor: 'tutor-fatima',
    }),
    (dose) => {
      if (dose.diasAtras === 61) {
        return pulada(FAMILIAR_DA_DEMONSTRACAO, 95, 'cuspiu')
      }

      if (dose.diasAtras === 33) {
        return pulada('tutor-fatima', 12, 'acabou')
      }

      /* Domingo nas primeiras semanas: deram, ninguém marcou. E um dia qualquer, mês passado. */
      if ((weekdayOf(dose.dia) === 0 && dose.diasAtras >= 60) || dose.diasAtras === 20) {
        return null
      }

      return toqueDaManha(dose)
    },
  )

  acrescentar(
    daPrescricao(ctx, 'enc-apt-resumo-perola-3', {
      id: 'trat-perola-omeprazol',
      inicioEm: iso(41, '08:00'),
      lembreteCriadoEm: iso(42, '11:05'),
      lembreteCriadoPor: 'tutor-fatima',
    }),
    (dose) => (dose.diasAtras === 38 ? pulada('tutor-fatima', 9, 'cuspiu') : toqueDaManha(dose)),
  )

  /*
   * Duna. A consulta com a Helena foi às 10h de 60 dias atrás; o Eduardo criou o lembrete à tarde,
   * com a primeira dose para as 20h daquela noite. Lúcia de manhã, Eduardo à noite.
   */
  acrescentar(
    daPrescricao(ctx, `enc-${CONSULTAS_DA_ADESAO[0]!.id}`, {
      id: TRATAMENTO_CRITICO,
      inicioEm: iso(60, '20:00'),
      lembreteCriadoEm: iso(60, '13:10'),
      lembreteCriadoPor: 'tutor-eduardo',
    }),
    (dose) => {
      const quem = dose.minuto < 12 * 60 ? 'membro-lucia' : 'tutor-eduardo'

      if (dose.posicaoDoFim <= 1) {
        return pulada(quem, 20 + ruido(`duna|${dose.numero}`, 25), 'acabou')
      }

      /* A noite em que o último comprimido saiu da cartela — e ninguém marcou. */
      if (dose.posicaoDoFim === 2) {
        return null
      }

      if (quem === 'tutor-eduardo' && [47, 30, 19].includes(dose.diasAtras)) {
        return null
      }

      return dada(quem, (quem === 'membro-lucia' ? 4 : 12) + ruido(`duna|${dose.numero}`, 30))
    },
  )

  /*
   * Cacau. Crise de discopatia há seis dias: tramadol de 8 em 8 horas por dez dias, por cima da
   * gabapentina que ela já toma. A responsável escolheu 15h para a primeira — e a grade caiu em
   * 15h, 23h e 7h.
   */
  acrescentar(
    semAtendimento({
      id: TRATAMENTO_VARIAS_VEZES_AO_DIA,
      petId: 'pet-cacau',
      tutorId: 'tutor-ana-lu',
      medicamentoId: 'med-tramadol',
      pesoKg: 9,
      mgPorKg: 2,
      via: 'oral',
      instrucoes: '',
      frequenciaHoras: 8,
      duracaoDias: 10,
      inicioEm: iso(6, '15:00'),
      critico: false,
      prescritoPor: 'prof-caio',
      prescritoEm: iso(6, '10:40'),
      lembreteCriadoEm: iso(6, '12:15'),
      lembreteCriadoPor: 'tutor-ana-lu',
    }),
    (dose) => {
      if (dose.minuto === 23 * 60) {
        return dose.diasAtras === 4 ? dada('tutor-ana-lu', 18) : null
      }

      if (dose.minuto === 15 * 60 && dose.diasAtras === 2) {
        return pulada('tutor-ana-lu', 40, 'esqueci')
      }

      const base = dose.minuto === 7 * 60 ? 5 : 20

      return dada('tutor-ana-lu', base + ruido(`cacau|${dose.numero}`, 30))
    },
  )

  /* Chico: prednisolona por 45 dias, e a Luciana marca tudo, poucos minutos depois das 9h. */
  acrescentar(
    daPrescricao(ctx, 'enc-apt-resumo-chico-2', {
      id: 'trat-chico-prednisolona',
      inicioEm: iso(30, '09:00'),
      lembreteCriadoEm: iso(31, '18:20'),
      lembreteCriadoPor: 'tutor-luciana',
    }),
    (dose) => dada('tutor-luciana', 1 + ruido(`chico|${dose.numero}`, 10)),
  )

  return { tratamentos, registrosDeDose }
}
