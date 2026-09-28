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
 * **O diário tem a forma do app.** Cada registro é um `DiarioPet` como a clínica o recebe
 * (`EntradaDoDiarioParaClinica`, do contrato), com os enums do Prisma literais, e o peso é um
 * `PesoRegistro` à parte — é assim que o app grava. Não existe "desmaio" em `SintomaPet`: o
 * desmaio do Chico chega como falta de ar e fraqueza, com o relato em `sintomasOutros`, que é o
 * que o responsável faria no app de verdade.
 *
 * O diário dos demais pacientes é sorteado por hash do id — sem consumir os geradores do
 * `seed.ts`, pelo mesmo motivo.
 */

import type { SintomaPet, VitalidadePet } from '../contrato/responsavel'
import { addDays, createClinicClock } from '../domain/clinic-time'

import { CLINIC_UTC_OFFSET } from './fixtures'
import { createPrng, hashSeed, intBetween, pickFrom } from './mock-runtime'
import type {
  AppointmentOrigin,
  Diagnosis,
  ISODate,
  PesagemDeCasa,
  Pet,
  RegistroDoDiario,
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
  origem: AppointmentOrigin
  observacao: string
}> = [
  {
    /*
     * Marcado pelo app: é o horário que a demonstração do lado do responsável mostra como
     * "consulta hoje", com a pré-consulta aberta e ainda sem resposta.
     */
    id: 'apt-resumo-perola',
    petId: PET_PERDA_DE_PESO,
    inicio: '10:00',
    typeId: 'tipo-consulta',
    origem: 'app',
    observacao: 'Acho que ela está mais magra e bebendo muita água.',
  },
  {
    id: 'apt-resumo-chico',
    petId: PET_DIARIO_CHEIO,
    inicio: '10:30',
    typeId: 'tipo-retorno',
    origem: 'telefone',
    observacao: 'Retorno da síndrome braquicefálica.',
  },
  {
    id: 'apt-resumo-pacoca',
    petId: PET_NOVO,
    inicio: '11:00',
    typeId: 'tipo-consulta',
    origem: 'recepcao',
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
    /** `null` é uso contínuo. */
    duracaoDias: number | null
  } | null
}

/**
 * As consultas antigas da Pérola e do Chico.
 *
 * Mais antigas que a janela de três semanas do sorteio da agenda: a perda de peso só aparece
 * em meses, e a pergunta "o que aconteceu desde a última vez" precisa de uma última vez longe
 * o bastante para ter acontecido alguma coisa.
 *
 * O meloxicam contínuo da Pérola é de propósito o detalhe que o vet precisa cruzar: gata idosa,
 * anti-inflamatório sem data para parar, perdendo peso e bebendo mais água. Cada fato mora numa
 * tela diferente do prontuário; o resumo põe os três na mesma.
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
    typeId: 'tipo-consulta',
    professionalId: 'prof-helena',
    pesoKg: 4.7,
    queixa: 'Não consegue mais pular no sofá',
    diagnostico: { codigo: 'LO-05', descricao: 'Displasia coxofemoral', kind: 'definitivo' },
    prescricao: {
      medicamentoId: 'med-meloxicam',
      mgPorKg: 0.05,
      frequenciaHoras: 24,
      duracaoDias: null,
    },
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

type Registro = Omit<RegistroDoDiario, 'id' | 'petId' | 'data'>

const NADA: Registro = {
  vitalidade: null,
  alimentacao: null,
  hidratacao: null,
  fezes: null,
  urina: null,
  sintomas: [],
  sintomasOutros: null,
  doencas: [],
  observacoes: null,
  remedios: null,
  nota: null,
  fotoIds: [],
}

function quando(hoje: ISODate, diasAtras: number, hora: string) {
  const [h, m] = hora.split(':').map(Number)

  return clock.toIso(addDays(hoje, -diasAtras), (h ?? 0) * 60 + (m ?? 0))
}

function registro(
  petId: string,
  hoje: ISODate,
  diasAtras: number,
  hora: string,
  valor: Partial<Registro>,
): RegistroDoDiario {
  return {
    id: `diario-${petId}-${diasAtras}-${hora.replace(':', '')}`,
    petId,
    data: quando(hoje, diasAtras, hora),
    ...NADA,
    ...valor,
  }
}

function pesagem(
  petId: string,
  hoje: ISODate,
  diasAtras: number,
  hora: string,
  pesoKg: number,
): PesagemDeCasa {
  return {
    id: `peso-${petId}-${diasAtras}`,
    petId,
    data: quando(hoje, diasAtras, hora),
    pesoKg,
  }
}

export type DiarioDoDataset = {
  registros: RegistroDoDiario[]
  pesagens: PesagemDeCasa[]
}

/**
 * Pérola: a perda que nenhum registro isolado denuncia.
 *
 * 4,9 kg na primeira consulta, 4,1 kg na balança de casa ontem — 16% em cinco meses, com a
 * comida caindo e a água subindo nas últimas semanas. É o quadro que o vet reconhece na hora,
 * **se** alguém puser os números lado a lado.
 */
function diarioDaPerola(hoje: ISODate): DiarioDoDataset {
  const id = PET_PERDA_DE_PESO
  const r = (dias: number, hora: string, valor: Partial<Registro>) =>
    registro(id, hoje, dias, hora, valor)
  const p = (dias: number, pesoKg: number) => pesagem(id, hoje, dias, '20:00', pesoKg)

  return {
    registros: [
      r(132, '20:10', { alimentacao: 'NORMAL', vitalidade: 'NORMAL' }),
      r(117, '19:40', { alimentacao: 'NORMAL', vitalidade: 'ATIVO' }),
      r(80, '21:05', { alimentacao: 'NORMAL', vitalidade: 'NORMAL' }),
      r(66, '20:30', { alimentacao: 'NORMAL', vitalidade: 'CALMO' }),
      r(54, '19:55', {
        alimentacao: 'POUCO',
        sintomas: ['VOMITO'],
        observacoes: 'Vomitou um pouco de ração depois do jantar.',
      }),
      /* Desde a última consulta. */
      r(38, '20:15', { alimentacao: 'NORMAL', hidratacao: 'NORMAL', vitalidade: 'NORMAL' }),
      r(34, '08:20', { alimentacao: 'POUCO' }),
      r(31, '21:00', { alimentacao: 'NORMAL', hidratacao: 'MUITO' }),
      r(27, '19:30', {
        alimentacao: 'POUCO',
        hidratacao: 'MUITO',
        vitalidade: 'DESANIMADO',
        observacoes: 'Bebendo muita água. Enchi o pote duas vezes hoje.',
      }),
      r(24, '20:45', { alimentacao: 'POUCO' }),
      r(20, '07:50', { alimentacao: 'POUCO', sintomas: ['VOMITO'] }),
      r(17, '20:10', { alimentacao: 'POUCO', hidratacao: 'MUITO', urina: 'MUITO' }),
      r(13, '21:20', {
        alimentacao: 'POUCO',
        vitalidade: 'CALMO',
        observacoes: 'Deixou metade da ração. Só come se for sachê.',
      }),
      r(10, '20:05', { alimentacao: 'POUCO', hidratacao: 'MUITO' }),
      r(6, '19:45', { alimentacao: 'NORMAL', vitalidade: 'NORMAL' }),
      r(3, '20:30', {
        alimentacao: 'POUCO',
        hidratacao: 'MUITO',
        vitalidade: 'DESANIMADO',
        sintomas: ['PERDA_DE_PESO'],
        observacoes: 'Parece mais magra nas costas, dá para sentir os ossos.',
      }),
      /* Dentro dos três dias que a pré-consulta usa para abrir preenchida. */
      r(1, '21:10', {
        alimentacao: 'POUCO',
        hidratacao: 'MUITO',
        fezes: 'NORMAL',
        urina: 'MUITO',
        vitalidade: 'CALMO',
      }),
    ],
    pesagens: [
      p(132, 4.85),
      p(117, 4.8),
      p(80, 4.65),
      p(66, 4.6),
      p(54, 4.55),
      p(38, 4.45),
      p(31, 4.4),
      p(24, 4.35),
      p(17, 4.3),
      p(10, 4.2),
      p(3, 4.1),
    ],
  }
}

const OBSERVACOES_DO_CHICO = [
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

const VITALIDADES_DO_CHICO: VitalidadePet[] = ['NORMAL', 'NORMAL', 'ATIVO', 'CALMO']

/**
 * Chico: noventa registros, quase todos iguais — e o desmaio de nove dias atrás no meio deles.
 *
 * É o caso que decide se o resumo resume. Listar tudo esconde o desmaio pela quantidade;
 * contar só as médias esconde pela média. O resumo precisa mostrar o que é raro **porque** é
 * raro.
 */
function diarioDoChico(hoje: ISODate): DiarioDoDataset {
  const id = PET_DIARIO_CHEIO
  const rng = createPrng(hashSeed(`diario|${id}`))
  const registros: RegistroDoDiario[] = []
  const pesagens: PesagemDeCasa[] = []

  for (let dias = 30; dias >= 0; dias -= 1) {
    for (const hora of ['07:40', '13:10', '21:30']) {
      /* Hoje ainda não chegou a noite. */
      if (dias === 0 && hora !== '07:40') {
        continue
      }

      const observacao = pickFrom(rng, OBSERVACOES_DO_CHICO, '')

      registros.push(
        registro(id, hoje, dias, hora, {
          alimentacao: hora === '13:10' ? null : 'NORMAL',
          vitalidade: pickFrom(rng, VITALIDADES_DO_CHICO, 'NORMAL'),
          observacoes: observacao || null,
        }),
      )
    }

    if (dias % 7 === 2) {
      pesagens.push(pesagem(id, hoje, dias, '07:45', pickFrom(rng, [9.2, 9.3, 9.2, 9.1], 9.2)))
    }
  }

  const trocar = (dias: number, hora: string, valor: Partial<Registro>) => {
    const alvo = registro(id, hoje, dias, hora, {})
    const indice = registros.findIndex((item) => item.id === alvo.id)

    if (indice >= 0) {
      registros[indice] = { ...registros[indice]!, ...valor }
    }
  }

  trocar(9, '13:10', {
    vitalidade: 'APATICO',
    sintomas: ['FALTA_DE_AR', 'FRAQUEZA'],
    sintomasOutros: 'Desmaiou por alguns segundos',
    observacoes:
      'Depois do passeio no calor ficou com a língua roxa e desmaiou por uns segundos. Voltou sozinho, mas ficou cansado o resto do dia.',
  })
  trocar(9, '21:30', {
    vitalidade: 'SONOLENTO',
    observacoes: 'Mais quieto que o normal.',
  })
  trocar(8, '07:40', { alimentacao: 'POUCO', observacoes: 'Comeu metade.' })
  trocar(6, '21:30', { sintomas: ['TOSSE'], observacoes: 'Tosse seca depois de beber água.' })
  /* A observação sorteada sai junto: "tudo certo hoje" ao lado de uma tosse é o dado desmentindo a si. */
  trocar(4, '13:10', { sintomas: ['TOSSE'], observacoes: null })
  trocar(2, '21:30', { sintomas: ['TOSSE'], observacoes: null })
  trocar(1, '07:40', { sintomas: ['TOSSE'], observacoes: 'Tossiu de novo ao acordar.' })

  return { registros, pesagens }
}

const OBSERVACOES_COMUNS = ['Tudo certo.', 'Comeu bem.', 'Passeio normal.', '', '', '']
const SINTOMAS_COMUNS: SintomaPet[] = ['VOMITO', 'DIARREIA', 'COCEIRA', 'ESPIRRO', 'TOSSE']
const VITALIDADES_COMUNS: VitalidadePet[] = [
  'NORMAL',
  'NORMAL',
  'NORMAL',
  'ATIVO',
  'CALMO',
  'SONOLENTO',
]

/**
 * Diário sorteado dos demais pacientes.
 *
 * Um terço fica sem diário nenhum, de propósito: é o responsável que não usa o app, e a tela
 * precisa dizer isso sem parecer quebrada. Equino fica de fora — ninguém pesa cavalo na
 * balança do banheiro.
 */
function diarioSorteado(pet: Pet, hoje: ISODate): DiarioDoDataset {
  const hash = hashSeed(`diario|${pet.id}`)

  if (hash % 3 === 0 || pet.especie === 'equina') {
    return { registros: [], pesagens: [] }
  }

  const rng = createPrng(hash)
  const registros: RegistroDoDiario[] = []
  const pesagens: PesagemDeCasa[] = []

  for (let dias = 40 - intBetween(rng, 0, 4); dias >= 1; dias -= intBetween(rng, 2, 6)) {
    const comPeso = pet.pesoKg !== null && rng() < 0.35
    const casas = pet.pesoKg !== null && pet.pesoKg < 2 ? 100 : 10
    const sintoma = rng() < 0.12 ? pickFrom(rng, SINTOMAS_COMUNS, 'VOMITO') : null
    const hora = pickFrom(rng, ['08:10', '12:40', '19:50', '21:15'], '19:50')
    const observacao = pickFrom(rng, OBSERVACOES_COMUNS, '')

    registros.push(
      registro(pet.id, hoje, dias, hora, {
        alimentacao: rng() < 0.9 ? 'NORMAL' : 'POUCO',
        hidratacao: rng() < 0.5 ? 'NORMAL' : null,
        fezes: rng() < 0.4 ? 'NORMAL' : null,
        vitalidade: pickFrom(rng, VITALIDADES_COMUNS, 'NORMAL'),
        sintomas: sintoma ? [sintoma] : [],
        observacoes: observacao || null,
      }),
    )

    if (comPeso) {
      pesagens.push(
        pesagem(
          pet.id,
          hoje,
          dias,
          hora,
          Math.round(pet.pesoKg! * (1 + (rng() - 0.5) * 0.03) * casas) / casas,
        ),
      )
    }
  }

  return { registros, pesagens }
}

export function gerarDiario(pets: Pet[], hoje: ISODate): DiarioDoDataset {
  const partes = pets.map((pet) => {
    if (pet.id === PET_PERDA_DE_PESO) {
      return diarioDaPerola(hoje)
    }

    if (pet.id === PET_DIARIO_CHEIO) {
      return diarioDoChico(hoje)
    }

    /* A filhote nunca veio e o app ainda não foi aberto: o vazio é o caso. */
    if (pet.id === PET_NOVO) {
      return { registros: [], pesagens: [] }
    }

    return diarioSorteado(pet, hoje)
  })

  const maisRecentePrimeiro = (a: { data: string }, b: { data: string }) =>
    Date.parse(b.data) - Date.parse(a.data)

  return {
    registros: partes.flatMap((parte) => parte.registros).sort(maisRecentePrimeiro),
    pesagens: partes.flatMap((parte) => parte.pesagens).sort(maisRecentePrimeiro),
  }
}
