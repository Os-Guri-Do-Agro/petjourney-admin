/**
 * O diário do responsável e os três pacientes plantados do resumo "Este pet em 30 segundos".
 *
 * O resumo é a demonstração do diferencial do produto — o vet chega à consulta sabendo o que
 * aconteceu em casa —, e ele só convence se os casos difíceis estiverem no dataset:
 *
 * - **Pérola**, a gata que perde peso devagar, consulta após consulta. Nenhum registro sozinho
 *   assusta; a sequência é que é o achado.
 * - **Chico**, o pug do responsável que registra tudo, três vezes por dia. Noventa registros,
 *   quase todos "tudo certo" — e um desmaio no meio deles, que o resumo não pode esconder.
 * - **Paçoca**, a filhote que nunca veio. Sem histórico nenhum, a tela tem que continuar útil.
 *
 * Os três vivem **só no dataset**, não na fixture de pessoas. A fixture é compartilhada com o
 * hotel e alimenta o sorteio da agenda: um paciente a mais ali deslocaria todos os sorteios do
 * módulo e daria histórico aleatório justamente a quem precisa de um histórico desenhado.
 *
 * O diário dos demais pacientes é sorteado por hash do id — sem consumir os geradores do
 * `seed.ts`, pelo mesmo motivo.
 */

import { addDays, createClinicClock } from '../domain/clinic-time'

import { CLINIC_UTC_OFFSET } from './fixtures'
import { createPrng, hashSeed, intBetween, pickFrom } from './mock-runtime'
import type {
  ComportamentoNoDiario,
  Diagnosis,
  EntradaDoDiario,
  ISODate,
  Pet,
  SintomaNoDiario,
} from './types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

export const PET_PERDA_DE_PESO = 'pet-perola'
export const PET_DIARIO_CHEIO = 'pet-chico'
export const PET_NOVO = 'pet-pacoca'

/** O nascimento da filhote anda com o relógio: filhote de data fixa envelhece na demonstração. */
export function petsDoResumo(hoje: ISODate): Pet[] {
  return [
    {
      id: PET_PERDA_DE_PESO,
      nome: 'Pérola',
      especie: 'felina',
      raca: 'SRD',
      sexo: 'femea',
      nascimento: '2014-05-02',
      castrado: true,
      porte: null,
      /* O último peso aferido na clínica. O de casa já está abaixo dele — é o caso. */
      pesoKg: 4.5,
      microchip: '900215000512907',
      pelagem: 'Tricolor, pelo curto',
      tutorId: 'tutor-fatima',
      iniciais: 'PE',
      fotoUrl: '',
      alertas: [],
    },
    {
      id: PET_DIARIO_CHEIO,
      nome: 'Chico',
      especie: 'canina',
      raca: 'Pug',
      sexo: 'macho',
      nascimento: '2021-08-19',
      castrado: true,
      porte: 'pequeno',
      pesoKg: 9.3,
      microchip: '900215000630418',
      pelagem: 'Abricó com máscara preta, pelo curto',
      tutorId: 'tutor-luciana',
      iniciais: 'CH',
      fotoUrl: '',
      alertas: [
        {
          id: 'alerta-chico-1',
          kind: 'cronico',
          severidade: 'atencao',
          detalhe: 'Síndrome braquicefálica',
        },
      ],
    },
    {
      id: PET_NOVO,
      nome: 'Paçoca',
      especie: 'canina',
      raca: 'SRD',
      sexo: 'femea',
      nascimento: addDays(hoje, -75),
      castrado: false,
      porte: null,
      /* Ninguém pesou ainda. É uma das coisas que o vazio precisa lembrar. */
      pesoKg: null,
      microchip: '',
      pelagem: 'Caramelo com peito branco',
      tutorId: 'tutor-daniel',
      iniciais: 'PA',
      fotoUrl: '',
      alertas: [],
    },
  ]
}

/** O horário de hoje de cada um: é dele que sai o botão "abrir o atendimento". */
export const HORARIOS_DE_HOJE: Array<{
  id: string
  petId: string
  inicio: string
  typeId: string
  observacao: string
}> = [
  {
    id: 'apt-resumo-perola',
    petId: PET_PERDA_DE_PESO,
    inicio: '10:00',
    typeId: 'tipo-consulta',
    observacao: 'Responsável acha que ela está mais magra.',
  },
  {
    id: 'apt-resumo-chico',
    petId: PET_DIARIO_CHEIO,
    inicio: '10:30',
    typeId: 'tipo-retorno',
    observacao: 'Retorno da síndrome braquicefálica.',
  },
  {
    id: 'apt-resumo-pacoca',
    petId: PET_NOVO,
    inicio: '11:00',
    typeId: 'tipo-consulta',
    observacao: 'Primeira consulta. Adotada na semana passada.',
  },
]

export type ConsultaPlantada = {
  id: string
  petId: string
  diasAtras: number
  inicio: string
  typeId: string
  professionalId: string
  pesoKg: number
  queixa: string
  diagnostico: Omit<Diagnosis, 'id'> | null
  prescricao: {
    medicamentoId: string
    mgPorKg: number
    frequenciaHoras: number
    duracaoDias: number
  } | null
}

/**
 * As consultas antigas da Pérola e do Chico.
 *
 * Mais antigas que a janela de três semanas do sorteio da agenda: a perda de peso só aparece
 * em meses, e a pergunta "o que aconteceu desde a última vez" precisa de uma última vez longe
 * o bastante para ter acontecido alguma coisa.
 */
export const CONSULTAS_DO_RESUMO: ConsultaPlantada[] = [
  {
    id: 'apt-resumo-perola-1',
    petId: PET_PERDA_DE_PESO,
    diasAtras: 150,
    inicio: '10:00',
    typeId: 'tipo-consulta',
    professionalId: 'prof-ana',
    pesoKg: 4.9,
    queixa: 'Check-up anual',
    diagnostico: { codigo: 'GN-00', descricao: 'Check-up sem alterações', kind: 'definitivo' },
    prescricao: null,
  },
  {
    id: 'apt-resumo-perola-2',
    petId: PET_PERDA_DE_PESO,
    diasAtras: 95,
    inicio: '15:30',
    typeId: 'tipo-retorno',
    professionalId: 'prof-helena',
    pesoKg: 4.7,
    queixa: 'Revisão de tártaro',
    diagnostico: { codigo: 'GN-00', descricao: 'Check-up sem alterações', kind: 'definitivo' },
    prescricao: null,
  },
  {
    id: 'apt-resumo-perola-3',
    petId: PET_PERDA_DE_PESO,
    diasAtras: 42,
    inicio: '09:30',
    typeId: 'tipo-consulta',
    professionalId: 'prof-ana',
    pesoKg: 4.5,
    queixa: 'Vômito ocasional e menos apetite',
    diagnostico: { codigo: 'GE-01', descricao: 'Gastroenterite aguda', kind: 'presuntivo' },
    prescricao: {
      medicamentoId: 'med-omeprazol',
      mgPorKg: 1,
      frequenciaHoras: 24,
      duracaoDias: 14,
    },
  },
  {
    id: 'apt-resumo-chico-1',
    petId: PET_DIARIO_CHEIO,
    diasAtras: 120,
    inicio: '11:00',
    typeId: 'tipo-consulta',
    professionalId: 'prof-tiago',
    pesoKg: 9.1,
    queixa: 'Check-up e vacinas em dia',
    diagnostico: { codigo: 'GN-00', descricao: 'Check-up sem alterações', kind: 'definitivo' },
    prescricao: null,
  },
  {
    id: 'apt-resumo-chico-2',
    petId: PET_DIARIO_CHEIO,
    diasAtras: 31,
    inicio: '14:30',
    typeId: 'tipo-consulta',
    professionalId: 'prof-tiago',
    pesoKg: 9.3,
    queixa: 'Ronco alto e cansaço no passeio',
    diagnostico: { codigo: 'RE-02', descricao: 'Síndrome braquicefálica', kind: 'definitivo' },
    /* Ainda em curso hoje: é a "medicação em uso" que o resumo tem que mostrar. */
    prescricao: {
      medicamentoId: 'med-prednisolona',
      mgPorKg: 0.5,
      frequenciaHoras: 24,
      duracaoDias: 45,
    },
  },
]

// ---------------------------------------------------------------------------
// Diário
// ---------------------------------------------------------------------------

type Registro = Omit<EntradaDoDiario, 'id' | 'petId' | 'registradoEm'>

const NADA: Registro = { pesoKg: null, apetite: null, comportamento: null, sintomas: [], nota: '' }

function registro(
  petId: string,
  hoje: ISODate,
  diasAtras: number,
  hora: string,
  valor: Partial<Registro>,
): EntradaDoDiario {
  const [h, m] = hora.split(':').map(Number)

  return {
    id: `diario-${petId}-${diasAtras}-${hora.replace(':', '')}`,
    petId,
    registradoEm: clock.toIso(addDays(hoje, -diasAtras), (h ?? 0) * 60 + (m ?? 0)),
    ...NADA,
    ...valor,
  }
}

/**
 * Pérola: a perda que nenhum registro isolado denuncia.
 *
 * 4,9 kg na primeira consulta, 4,1 kg na balança de casa ontem — 16% em cinco meses, com o
 * apetite caindo e a sede subindo nas últimas semanas. É o quadro que o vet reconhece na hora,
 * **se** alguém puser os números lado a lado.
 */
function diarioDaPerola(hoje: ISODate): EntradaDoDiario[] {
  const id = PET_PERDA_DE_PESO
  const r = (dias: number, hora: string, valor: Partial<Registro>) =>
    registro(id, hoje, dias, hora, valor)

  return [
    r(132, '20:10', { pesoKg: 4.85, apetite: 'normal', comportamento: 'normal' }),
    r(117, '19:40', { pesoKg: 4.8, apetite: 'normal', comportamento: 'normal' }),
    r(80, '21:05', { pesoKg: 4.65, apetite: 'normal', comportamento: 'normal' }),
    r(66, '20:30', { pesoKg: 4.6, apetite: 'normal', comportamento: 'normal' }),
    r(54, '19:55', {
      pesoKg: 4.55,
      apetite: 'reduzido',
      sintomas: ['vomito'],
      nota: 'Vomitou um pouco de ração depois do jantar.',
    }),
    /* Desde a última consulta. */
    r(38, '20:15', { pesoKg: 4.45, apetite: 'normal', comportamento: 'normal' }),
    r(34, '08:20', { apetite: 'reduzido', comportamento: 'normal' }),
    r(31, '21:00', { pesoKg: 4.4, apetite: 'normal', sintomas: ['sede-aumentada'] }),
    r(27, '19:30', {
      apetite: 'reduzido',
      comportamento: 'quieto',
      sintomas: ['sede-aumentada'],
      nota: 'Bebendo muita água. Enchi o pote duas vezes hoje.',
    }),
    r(24, '20:45', { pesoKg: 4.35, apetite: 'reduzido' }),
    r(20, '07:50', { apetite: 'reduzido', sintomas: ['vomito'] }),
    r(17, '20:10', { pesoKg: 4.3, apetite: 'reduzido', sintomas: ['sede-aumentada'] }),
    r(13, '21:20', {
      apetite: 'reduzido',
      comportamento: 'quieto',
      nota: 'Deixou metade da ração. Só come se for sachê.',
    }),
    r(10, '20:05', { pesoKg: 4.2, apetite: 'reduzido', sintomas: ['sede-aumentada'] }),
    r(6, '19:45', { apetite: 'normal', comportamento: 'normal' }),
    r(3, '20:30', {
      pesoKg: 4.1,
      apetite: 'reduzido',
      comportamento: 'quieto',
      sintomas: ['sede-aumentada'],
      nota: 'Parece mais magra nas costas, dá para sentir os ossos.',
    }),
  ]
}

const NOTAS_DO_CHICO = [
  'Comeu tudo.',
  'Passeio de 20 minutos, tranquilo.',
  'Dormiu bem.',
  'Brincou com a bolinha.',
  'Tudo certo hoje.',
  'Tomou o remédio com petisco.',
  '',
  '',
  '',
]

/**
 * Chico: noventa registros, quase todos iguais — e o desmaio de nove dias atrás no meio deles.
 *
 * É o caso que decide se o resumo resume. Listar tudo esconde o desmaio pela quantidade;
 * contar só as médias esconde pela média. O resumo precisa mostrar o que é raro **porque** é
 * raro.
 */
function diarioDoChico(hoje: ISODate): EntradaDoDiario[] {
  const id = PET_DIARIO_CHEIO
  const rng = createPrng(hashSeed(`diario|${id}`))
  const entradas: EntradaDoDiario[] = []

  for (let dias = 30; dias >= 0; dias -= 1) {
    for (const hora of ['07:40', '13:10', '21:30']) {
      /* Hoje ainda não chegou a noite. */
      if (dias === 0 && hora !== '07:40') {
        continue
      }

      entradas.push(
        registro(id, hoje, dias, hora, {
          apetite: hora === '13:10' ? null : 'normal',
          comportamento: 'normal',
          pesoKg:
            dias % 7 === 2 && hora === '07:40' ? pickFrom(rng, [9.2, 9.3, 9.2, 9.1], 9.2) : null,
          nota: pickFrom(rng, NOTAS_DO_CHICO, ''),
        }),
      )
    }
  }

  const trocar = (dias: number, hora: string, valor: Partial<Registro>) => {
    const alvo = registro(id, hoje, dias, hora, {})
    const indice = entradas.findIndex((item) => item.id === alvo.id)

    if (indice >= 0) {
      entradas[indice] = { ...entradas[indice]!, ...valor }
    }
  }

  trocar(9, '13:10', {
    comportamento: 'apatico',
    sintomas: ['desmaio', 'falta-de-ar'],
    nota: 'Depois do passeio no calor ficou com a língua roxa e desmaiou por uns segundos. Voltou sozinho, mas ficou cansado o resto do dia.',
  })
  trocar(9, '21:30', {
    comportamento: 'quieto',
    sintomas: ['cansaco'],
    nota: 'Mais quieto que o normal.',
  })
  trocar(8, '07:40', { apetite: 'reduzido', nota: 'Comeu metade.' })
  trocar(6, '21:30', { sintomas: ['tosse'], nota: 'Tosse seca depois de beber água.' })
  /* A nota sorteada sai junto: "tudo certo hoje" ao lado de uma tosse é o dado desmentindo a si. */
  trocar(4, '13:10', { sintomas: ['tosse'], nota: '' })
  trocar(2, '21:30', { sintomas: ['tosse'], nota: '' })
  trocar(1, '07:40', { sintomas: ['tosse'], nota: 'Tossiu de novo ao acordar.' })

  return entradas
}

const NOTAS_COMUNS = ['Tudo certo.', 'Comeu bem.', 'Passeio normal.', '', '', '']
const SINTOMAS_COMUNS: SintomaNoDiario[] = ['vomito', 'diarreia', 'coceira', 'espirro', 'tosse']
const COMPORTAMENTOS: ComportamentoNoDiario[] = ['normal', 'normal', 'normal', 'normal', 'quieto']

/**
 * Diário sorteado dos demais pacientes.
 *
 * Um terço fica sem diário nenhum, de propósito: é o responsável que não usa o app, e a tela
 * precisa dizer isso sem parecer quebrada. Equino fica de fora — ninguém pesa cavalo na
 * balança do banheiro.
 */
function diarioSorteado(pet: Pet, hoje: ISODate): EntradaDoDiario[] {
  const hash = hashSeed(`diario|${pet.id}`)

  if (hash % 3 === 0 || pet.especie === 'equina') {
    return []
  }

  const rng = createPrng(hash)
  const entradas: EntradaDoDiario[] = []

  for (let dias = 40 - intBetween(rng, 0, 4); dias >= 1; dias -= intBetween(rng, 2, 6)) {
    const comPeso = pet.pesoKg !== null && rng() < 0.35
    const casas = pet.pesoKg !== null && pet.pesoKg < 2 ? 100 : 10
    const sintoma = rng() < 0.12 ? pickFrom(rng, SINTOMAS_COMUNS, 'vomito') : null

    entradas.push(
      registro(pet.id, hoje, dias, pickFrom(rng, ['08:10', '12:40', '19:50', '21:15'], '19:50'), {
        pesoKg: comPeso
          ? Math.round(pet.pesoKg! * (1 + (rng() - 0.5) * 0.03) * casas) / casas
          : null,
        apetite: rng() < 0.9 ? 'normal' : 'reduzido',
        comportamento: pickFrom(rng, COMPORTAMENTOS, 'normal'),
        sintomas: sintoma ? [sintoma] : [],
        nota: pickFrom(rng, NOTAS_COMUNS, ''),
      }),
    )
  }

  return entradas
}

export function gerarDiario(pets: Pet[], hoje: ISODate): EntradaDoDiario[] {
  return pets
    .flatMap((pet) => {
      if (pet.id === PET_PERDA_DE_PESO) {
        return diarioDaPerola(hoje)
      }

      if (pet.id === PET_DIARIO_CHEIO) {
        return diarioDoChico(hoje)
      }

      /* A filhote nunca veio e o app ainda não foi aberto: o vazio é o caso. */
      if (pet.id === PET_NOVO) {
        return []
      }

      return diarioSorteado(pet, hoje)
    })
    .sort((a, b) => b.registradoEm.localeCompare(a.registradoEm))
}
