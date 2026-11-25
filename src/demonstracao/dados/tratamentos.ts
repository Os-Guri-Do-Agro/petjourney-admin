/**
 * Tratamentos em casa da demonstração (adesão): o remédio que saiu da clínica e as doses que a casa
 * registra no app, dose a dose. Só pets cujo responsável usa o app; os que têm data começam numa
 * consulta da agenda. Três críticos pedem atenção (o Bento parou de registrar; a Lilica e o Rex
 * pularam doses); a Cacau já teve o contato registrado; a Pérola não compartilha as doses.
 *
 * As doses são geradas uma vez, da data de início até a hora em que a página abriu. O alerta, a
 * faixa e o resumo são conta feita na hora (marcar crítico e registrar contato mudam o alerta).
 *
 * O que este arquivo exporta (para as agregadoras e a linha do tempo):
 * - `TRATAMENTOS`: a coleção em memória;
 * - `tratamentosQuePedemAtencao()`: os críticos com alerta aberto (`TratamentoNaListaDto[]`), o
 *   número do selo de Tratamentos;
 * - `tratamentosDoPaciente(id)`: os tratamentos do pet como a ficha lê (`AdesaoParaClinicaDto[]`),
 *   para a linha do tempo (cada um com `inicioEm` e, se acabou, `encerradoEm`);
 * - `listaDeTratamentos`, `adesaoDoPaciente`, `dosesDoTratamento`, `marcarCriticoDe`,
 *   `registrarContatoEm`: as respostas e escritas das rotas.
 */
import type {
  AdesaoDoPaciente,
  DosesDoTratamento,
  FaixaDeDoses,
  ResumoDaAdesao,
  Tratamento,
  TratamentoNaLista,
} from '@/service/parceiro/adesao-service'

import { criarSorteio, idDe } from '../aleatorio'
import { agendamentosDoPaciente } from '../base/agenda'
import { paciente } from '../base/cadastro'
import { agora, agoraIso, diasEntre, hoje, instante, isoDe, somarDias } from '../relogio'

type Motivo = 'ESQUECI' | 'CUSPIU' | 'ACABOU'
type Quem = 'O' | 'F' | 'N'
type Registrada = 'D' | 'P' | 'S'

type Dose = { em: number; estado: Registrada; quem: Quem; motivo: Motivo | null }

export type TratamentoDaDemo = {
  id: string
  pacienteId: string
  medicamento: string
  posologia: Tratamento['posologia']
  inicioEm: string
  situacao: Tratamento['situacao']
  encerradoEm: string | null
  critico: boolean
  /** Minutos entre uma dose e a seguinte: a dose da vez fica aberta até a próxima. */
  intervaloMin: number
  doses: Dose[]
  /** O horário que quase ninguém registra (a conta sai na leitura, no período da faixa). */
  destoa: string | null
  contato: { em: string; nota: string } | null
  /** Desde quando a ficha conta: a última consulta, ou o início. */
  desde: string
}

export const TRATAMENTOS: TratamentoDaDemo[] = []

const MINUTO = 60_000
const HORA = 60 * MINUTO

/* ---------------------------------------------------------------------------- a tabela */

type Perfil = 'boa' | 'media' | 'queda' | 'puladas' | 'contatado'

type Definicao = {
  pacienteId: string
  medicamento: string
  posologia: Omit<Tratamento['posologia'], 'duracaoDias' | 'usoContinuo' | 'unidade'> & {
    unidade?: string
  }
  horarios: string[]
  /** De quantos em quantos dias (padrão: todo dia). */
  aCadaDias?: number
  /** Há quantos dias começou. */
  inicio: number
  /** Nulo: uso contínuo. */
  duracaoDias: number | null
  critico: boolean
  perfil: Perfil
  naoCompartilhado?: boolean
  destoa?: string
  puladas?: Array<{ diasAtras: number; hora: string; motivo: Motivo | null }>
  contato?: { horasAtras: number; nota: string }
}

const TABELA: Definicao[] = [
  {
    pacienteId: 'demo-pac-010',
    medicamento: 'Pimobendan 5 mg',
    posologia: {
      dose: '1/2 comprimido (2,5 mg)',
      via: 'Oral',
      frequencia: 'A cada 12 horas',
      instrucoes: 'Dar uma hora antes da refeição.',
    },
    horarios: ['08:00', '20:00'],
    inicio: 280,
    duracaoDias: null,
    critico: true,
    perfil: 'boa',
    contato: {
      horasAtras: 12 * 24 + 3,
      nota: 'Liguei para o Gustavo: tudo certo com o pimobendan, a Duna está mais disposta nas caminhadas.',
    },
  },
  {
    pacienteId: 'demo-pac-007-2',
    medicamento: 'Benazepril 5 mg',
    posologia: {
      dose: '1/2 comprimido (2,5 mg)',
      via: 'Oral',
      frequencia: 'Uma vez ao dia',
      instrucoes: 'Pode ser misturado ao sachê.',
    },
    horarios: ['09:00'],
    inicio: 190,
    duracaoDias: null,
    critico: true,
    perfil: 'queda',
  },
  {
    pacienteId: 'demo-pac-039',
    medicamento: 'Metimazol 5 mg',
    posologia: {
      dose: '1/2 comprimido (2,5 mg)',
      via: 'Oral',
      frequencia: 'A cada 12 horas',
      instrucoes: 'Usar luvas para partir o comprimido.',
    },
    horarios: ['10:00', '22:00'],
    inicio: 150,
    duracaoDias: null,
    critico: true,
    perfil: 'puladas',
    destoa: '22:00',
    puladas: [
      { diasAtras: 2, hora: '10:00', motivo: 'CUSPIU' },
      { diasAtras: 1, hora: '10:00', motivo: 'ACABOU' },
      { diasAtras: 1, hora: '22:00', motivo: 'ACABOU' },
    ],
  },
  {
    pacienteId: 'demo-pac-026',
    medicamento: 'Carprofeno 75 mg',
    posologia: {
      dose: '1 comprimido',
      via: 'Oral',
      frequencia: 'Uma vez ao dia, depois do jantar',
      instrucoes: 'Suspender e avisar a clínica se houver vômito ou fezes escuras.',
    },
    horarios: ['20:00'],
    inicio: 120,
    duracaoDias: null,
    critico: true,
    perfil: 'puladas',
    puladas: [
      { diasAtras: 2, hora: '20:00', motivo: 'ESQUECI' },
      { diasAtras: 1, hora: '20:00', motivo: null },
    ],
  },
  {
    pacienteId: 'demo-pac-007',
    medicamento: 'Gabapentina 100 mg',
    posologia: {
      dose: '1 cápsula',
      via: 'Oral',
      frequencia: 'A cada 12 horas',
      instrucoes: 'Pode deixar a Cacau mais sonolenta nos primeiros dias.',
    },
    horarios: ['08:00', '20:00'],
    inicio: 18,
    duracaoDias: 30,
    critico: true,
    perfil: 'contatado',
    puladas: [
      { diasAtras: 3, hora: '08:00', motivo: 'ESQUECI' },
      { diasAtras: 2, hora: '20:00', motivo: 'CUSPIU' },
    ],
    contato: {
      horasAtras: 18,
      nota: 'Falei com a Renata: a Cacau estava cuspindo a cápsula. Orientei abrir e misturar no patê; volta a registrar hoje.',
    },
  },
  {
    pacienteId: 'demo-pac-007',
    medicamento: 'Meloxicam 0,5 mg',
    posologia: {
      dose: '1 comprimido',
      via: 'Oral',
      frequencia: 'Uma vez ao dia',
      instrucoes: 'Dar sempre depois da refeição.',
    },
    horarios: ['08:00'],
    inicio: 18,
    duracaoDias: 7,
    critico: false,
    perfil: 'boa',
  },
  {
    pacienteId: 'demo-pac-008',
    medicamento: 'Cefalexina 500 mg',
    posologia: {
      dose: '1/2 comprimido (250 mg)',
      via: 'Oral',
      frequencia: 'A cada 12 horas',
      instrucoes: 'Manter até o fim, mesmo com a pele melhor.',
    },
    horarios: ['08:00', '20:00'],
    inicio: 9,
    duracaoDias: 14,
    critico: false,
    perfil: 'media',
  },
  {
    pacienteId: 'demo-pac-018',
    medicamento: 'Prednisolona 5 mg',
    posologia: {
      dose: '1/2 comprimido',
      via: 'Oral',
      frequencia: 'Uma vez ao dia, pela manhã',
      instrucoes: 'Não suspender de uma vez: seguir o desmame da receita.',
    },
    horarios: ['08:00'],
    inicio: 16,
    duracaoDias: 10,
    critico: false,
    perfil: 'boa',
  },
  {
    pacienteId: 'demo-pac-024',
    medicamento: 'Doxiciclina 50 mg',
    posologia: {
      dose: '1 comprimido',
      via: 'Oral',
      frequencia: 'Uma vez ao dia',
      instrucoes: 'Dar com petisco e oferecer água logo depois.',
    },
    horarios: ['19:00'],
    inicio: 6,
    duracaoDias: 21,
    critico: false,
    perfil: 'boa',
  },
  {
    pacienteId: 'demo-pac-023',
    medicamento: 'Pomada otológica (gentamicina, betametasona e clotrimazol)',
    posologia: {
      dose: '5 gotas em cada orelha',
      unidade: 'gotas',
      via: 'Otológica',
      frequencia: 'A cada 12 horas',
      instrucoes: 'Limpar o excesso com algodão antes de aplicar.',
    },
    horarios: ['08:30', '20:30'],
    inicio: 4,
    duracaoDias: 10,
    critico: false,
    perfil: 'media',
  },
  {
    pacienteId: 'demo-pac-001',
    medicamento: 'Mirtazapina 15 mg',
    posologia: {
      dose: '1/8 de comprimido',
      via: 'Oral',
      frequencia: 'A cada 48 horas',
      instrucoes: null,
    },
    horarios: ['20:00'],
    aCadaDias: 2,
    inicio: 10,
    duracaoDias: 14,
    critico: false,
    perfil: 'boa',
    naoCompartilhado: true,
  },
  {
    pacienteId: 'demo-pac-015',
    medicamento: 'Itraconazol 100 mg',
    posologia: {
      dose: '1 cápsula',
      via: 'Oral',
      frequencia: 'Uma vez ao dia, com a refeição',
      instrucoes: 'Esporotricose: usar luvas ao manusear as lesões.',
    },
    horarios: ['20:00'],
    inicio: 25,
    duracaoDias: 60,
    critico: true,
    perfil: 'boa',
  },
]

/* ----------------------------------------------------------------------------- a geração */

const sorte = criarSorteio('tratamentos')

function minutosDe(hora: string) {
  const [h = 0, m = 0] = hora.split(':').map(Number)
  return h * 60 + m
}

/** A consulta (não vacinação) finalizada do pet mais perto do dia pedido, até `folga` dias. */
function consultaPerto(pacienteId: string, dia: string, folga: number) {
  let melhor: { dia: string; fim: string } | null = null
  for (const a of agendamentosDoPaciente(pacienteId)) {
    if (a.status !== 'FINALIZADO' || a.tipoId === 'demo-tipo-vacina') continue
    const d = a.inicio.slice(0, 10)
    const distancia = Math.abs(diasEntre(dia, d))
    if (distancia > folga) continue
    if (!melhor || distancia < Math.abs(diasEntre(dia, melhor.dia))) {
      melhor = { dia: d, fim: a.finalizadoEm ?? a.fim }
    }
  }
  return melhor
}

function estadoPelo(perfil: Perfil, destoa: boolean): Registrada {
  if (destoa) return sorte.chance(0.25) ? 'D' : 'S'
  const [d, s] =
    perfil === 'boa'
      ? [0.93, 0.06]
      : perfil === 'media'
        ? [0.74, 0.19]
        : perfil === 'queda'
          ? [0.88, 0.09]
          : [0.85, 0.1]
  const n = sorte.numero()
  return n < d ? 'D' : n < d + s ? 'S' : 'P'
}

function gerar() {
  const dia = hoje()
  const agoraMs = agora().getTime()

  TABELA.forEach((def, i) => {
    if (!paciente(def.pacienteId)) return
    let inicioDia = somarDias(dia, -def.inicio)
    let inicioEm = instante(inicioDia, '11:20')
    if (def.duracaoDias !== null) {
      const consulta = consultaPerto(def.pacienteId, inicioDia, 3)
      if (consulta) {
        inicioDia = consulta.dia
        inicioEm = consulta.fim
      }
    }
    const fimDia = def.duracaoDias !== null ? somarDias(inicioDia, def.duracaoDias - 1) : null
    const encerrado = fimDia !== null && fimDia < dia
    const passo = def.aCadaDias ?? 1

    const contatoEm = def.contato ? agoraMs - def.contato.horasAtras * HORA : null
    const explicitas = new Map(
      (def.puladas ?? []).map((p) => [
        Date.parse(instante(somarDias(dia, -p.diasAtras), p.hora)),
        p.motivo,
      ]),
    )

    const doses: Dose[] = []
    const comeco = Math.max(-def.inicio, -100)
    for (let d = comeco; d <= 0; d++) {
      const data = somarDias(dia, d)
      if (data < inicioDia || (fimDia && data > fimDia)) continue
      if (diasEntre(inicioDia, data) % passo) continue
      for (const hora of def.horarios) {
        const em = Date.parse(instante(data, hora))
        if (em < Date.parse(inicioEm) || em > agoraMs) continue
        const recente = em > agoraMs - 72 * HORA
        let estado: Registrada
        let motivo: Motivo | null = null
        if (explicitas.has(em)) {
          estado = 'P'
          motivo = explicitas.get(em) ?? null
        } else if (def.perfil === 'queda' && em > agoraMs - 5 * 24 * HORA) {
          estado = 'S'
        } else if (def.perfil === 'contatado' && contatoEm && em > contatoEm) {
          estado = 'D'
        } else if (recente && def.critico && def.perfil !== 'queda') {
          estado = def.destoa === hora ? estadoPelo(def.perfil, true) : 'D'
        } else {
          estado = estadoPelo(def.perfil, def.destoa === hora)
        }
        if (estado === 'P' && !explicitas.has(em)) {
          motivo = sorte.pesado([
            ['ESQUECI', 6],
            ['CUSPIU', 2],
            ['ACABOU', 1],
            [null, 2],
          ] as const)
        }
        const quem = sorte.pesado([
          ['O', 70],
          ['F', 25],
          ['N', 5],
        ] as const)
        doses.push({ em, estado, quem, motivo })
      }
    }

    const consulta =
      def.duracaoDias === null ? consultaPerto(def.pacienteId, somarDias(dia, -21), 14) : null

    TRATAMENTOS.push({
      id: idDe('demo-trat', i + 1),
      pacienteId: def.pacienteId,
      medicamento: def.medicamento,
      posologia: {
        dose: def.posologia.dose,
        unidade:
          def.posologia.unidade ??
          (def.posologia.dose?.includes('cápsula') ? 'cápsula' : 'comprimido'),
        via: def.posologia.via,
        frequencia: def.posologia.frequencia,
        duracaoDias: def.duracaoDias,
        instrucoes: def.posologia.instrucoes,
        usoContinuo: def.duracaoDias === null,
      },
      inicioEm,
      situacao: def.naoCompartilhado
        ? 'NAO_COMPARTILHADO'
        : encerrado
          ? 'ENCERRADO'
          : 'ACOMPANHANDO',
      encerradoEm:
        encerrado && fimDia
          ? instante(fimDia, def.horarios[def.horarios.length - 1] ?? '20:00')
          : null,
      critico: def.critico,
      intervaloMin: (passo * 24 * 60) / def.horarios.length,
      doses,
      destoa: def.destoa ?? null,
      contato:
        def.contato && contatoEm
          ? { em: isoDe(new Date(contatoEm)), nota: def.contato.nota }
          : null,
      desde: consulta?.fim ?? inicioEm,
    })
  })
}

/** O minuto do dia na hora da clínica (o instante é escrito com o offset dela). */
function minutosDoDia(em: number) {
  const iso = isoDe(new Date(em))
  return minutosDe(iso.slice(11, 16))
}

gerar()

/* ------------------------------------------------------------------------------ a leitura */

type DoseLida = Omit<Dose, 'estado'> & { estado: Registrada | 'A' }

/** As doses até agora; a última sem registro, ainda no prazo, é a dose da vez (aberta). */
function dosesLidas(t: TratamentoDaDemo): DoseLida[] {
  const agoraMs = agora().getTime()
  const lidas: DoseLida[] = t.doses.filter((d) => d.em <= agoraMs).map((d) => ({ ...d }))
  const ultima = lidas[lidas.length - 1]
  if (
    t.situacao === 'ACOMPANHANDO' &&
    ultima &&
    ultima.estado === 'S' &&
    agoraMs - ultima.em < t.intervaloMin * MINUTO
  ) {
    ultima.estado = 'A'
  }
  return lidas
}

function contarMotivos(doses: DoseLida[]) {
  const contas = new Map<Motivo, number>()
  for (const d of doses) {
    if (d.estado === 'P' && d.motivo) contas.set(d.motivo, (contas.get(d.motivo) ?? 0) + 1)
  }
  return [...contas.entries()]
    .map(([motivo, vezes]) => ({ motivo, vezes }))
    .sort((x, y) => y.vezes - x.vezes)
}

export function alertaDe(t: TratamentoDaDemo): Tratamento['alerta'] {
  if (!t.critico || t.situacao !== 'ACOMPANHANDO') return null
  const agoraMs = agora().getTime()
  const depoisDoContato = t.contato ? Date.parse(t.contato.em) : 0
  const fechadas = dosesLidas(t).filter((d) => d.estado !== 'A')
  const janela = fechadas.filter((d) => d.em > agoraMs - 72 * HORA && d.em > depoisDoContato)
  const puladas = janela.filter((d) => d.estado === 'P')
  if (puladas.length >= 2) {
    return {
      motivo: 'PULADAS',
      desde: isoDe(new Date(puladas[0]?.em ?? agoraMs)),
      janela: {
        puladas: puladas.length,
        dadas: janela.filter((d) => d.estado === 'D').length,
        semRegistro: janela.filter((d) => d.estado === 'S').length,
      } as unknown as Record<string, never>,
      motivos: contarMotivos(puladas),
    }
  }

  const seguidas: DoseLida[] = []
  for (let i = fechadas.length - 1; i >= 0; i--) {
    const d = fechadas[i]
    if (!d || d.em <= depoisDoContato || d.estado !== 'S') break
    seguidas.unshift(d)
  }
  const primeira = seguidas[0]
  const registravam = primeira && fechadas.some((d) => d.estado !== 'S' && d.em < primeira.em)
  if (primeira && seguidas.length >= 3 && registravam) {
    return {
      motivo: 'QUEDA',
      desde: isoDe(new Date(primeira.em)),
      janela: { semRegistro: seguidas.length } as unknown as Record<string, never>,
      motivos: [],
    }
  }
  return null
}

/** O horário que quase ninguém registra: quantas dadas em quantas fechadas, no período. */
function destoaEntre(
  t: TratamentoDaDemo,
  desdeMs: number,
  ateMs: number,
): Tratamento['horarioQueDestoa'] {
  if (!t.destoa) return null
  const minuto = minutosDe(t.destoa)
  const doHorario = dosesLidas(t).filter(
    (d) => d.em >= desdeMs && d.em <= ateMs && d.estado !== 'A' && minutosDoDia(d.em) === minuto,
  )
  return {
    horario: t.destoa,
    dadas: doHorario.filter((d) => d.estado === 'D').length,
    fechadas: doHorario.length,
  }
}

function meiaNoite(dia: string) {
  return Date.parse(instante(dia, '00:00'))
}

function faixaEntre(t: TratamentoDaDemo, desdeMs: number, ateMs: number): FaixaDeDoses {
  const doses = dosesLidas(t).filter((d) => d.em >= desdeMs && d.em <= ateMs)
  return {
    desde: isoDe(new Date(desdeMs)),
    minutos: doses.map((d) => Math.round((d.em - desdeMs) / MINUTO)),
    estados: doses.map((d) => d.estado).join(''),
    quem: doses.map((d) => (d.estado === 'S' || d.estado === 'A' ? '-' : d.quem)).join(''),
  }
}

function resumoEntre(
  t: TratamentoDaDemo,
  desde: string,
  desdeMs: number,
  ateMs: number,
): ResumoDaAdesao {
  const doses = dosesLidas(t).filter((d) => d.em >= desdeMs && d.em <= ateMs)
  const registradas = doses.filter((d) => d.estado === 'D' || d.estado === 'P')
  return {
    desde,
    dadas: doses.filter((d) => d.estado === 'D').length,
    puladas: doses.filter((d) => d.estado === 'P').length,
    pulouSemMotivo: doses.filter((d) => d.estado === 'P' && !d.motivo).length,
    semRegistro: doses.filter((d) => d.estado === 'S').length,
    abertas: doses.filter((d) => d.estado === 'A').length,
    motivos: contarMotivos(doses),
    porQuem: {
      DONO: registradas.filter((d) => d.quem === 'O').length,
      FAMILIA: registradas.filter((d) => d.quem === 'F').length,
      NAO_INFORMADO: registradas.filter((d) => d.quem === 'N').length,
    },
  }
}

export function tratamento(id: string) {
  return TRATAMENTOS.find((t) => t.id === id) ?? null
}

/** O tratamento como a ficha lê: a faixa desde a última consulta (ou o início). */
export function adesaoDto(t: TratamentoDaDemo): Tratamento {
  const base = {
    tratamentoId: t.id,
    medicamento: t.medicamento,
    posologia: t.posologia,
    inicioEm: t.inicioEm,
    situacao: t.situacao,
    encerradoEm: t.encerradoEm,
    critico: t.critico,
    contato: t.contato,
    /* A reavaliação do contínuo (PJ-HC2AKL): a demonstração não marca data. */
    reavaliarEm: null,
    reavaliacaoPendente: false,
    ultimaReavaliacao: null,
  }
  if (t.situacao === 'NAO_COMPARTILHADO') {
    return { ...base, faixa: null, resumo: null, horarioQueDestoa: null, alerta: null }
  }
  const desdeMs = meiaNoite(t.desde.slice(0, 10))
  const ateMs = t.encerradoEm ? Date.parse(t.encerradoEm) : agora().getTime()
  return {
    ...base,
    faixa: faixaEntre(t, desdeMs, ateMs),
    resumo: resumoEntre(t, t.desde, desdeMs, ateMs),
    horarioQueDestoa: destoaEntre(t, desdeMs, ateMs),
    alerta: alertaDe(t),
  }
}

/** Os tratamentos do pet: em curso primeiro, depois os encerrados, do mais novo. */
export function tratamentosDoPaciente(pacienteId: string): Tratamento[] {
  return TRATAMENTOS.filter((t) => t.pacienteId === pacienteId)
    .sort(
      (x, y) =>
        Number(x.situacao === 'ENCERRADO') - Number(y.situacao === 'ENCERRADO') ||
        Date.parse(y.inicioEm) - Date.parse(x.inicioEm),
    )
    .map(adesaoDto)
}

export function adesaoDoPaciente(pacienteId: string): AdesaoDoPaciente {
  return { itens: tratamentosDoPaciente(pacienteId).slice(0, 20), truncado: false }
}

function naLista(t: TratamentoDaDemo): TratamentoNaLista {
  const alerta = alertaDe(t)
  return {
    tratamentoId: t.id,
    pacienteId: t.pacienteId,
    pacienteNome: paciente(t.pacienteId)?.nome ?? '',
    medicamento: t.medicamento,
    critico: t.critico,
    situacao: t.situacao,
    inicioEm: t.inicioEm,
    alerta: alerta?.motivo ?? null,
    alertaDesde: alerta?.desde ?? null,
    contatoEm: t.contato?.em ?? null,
    reavaliarEm: null,
    reavaliacaoPendente: false,
    ultimaReavaliacao: null,
  }
}

/** A lista da clínica: os que pedem atenção (do alerta mais antigo) ou todos (do mais novo). */
export function listaDeTratamentos(pedemAtencao: boolean): TratamentoNaLista[] {
  const lista = TRATAMENTOS.map(naLista)
  if (pedemAtencao) {
    return lista
      .filter((t) => t.alerta)
      .sort((x, y) => (x.alertaDesde ?? '').localeCompare(y.alertaDesde ?? ''))
  }
  return lista.sort((x, y) => Date.parse(y.inicioEm) - Date.parse(x.inicioEm))
}

export function tratamentosQuePedemAtencao(): TratamentoNaLista[] {
  return listaDeTratamentos(true)
}

/** A faixa de um período (dias na parede da clínica, até 90); sem período, 42 dias até hoje. */
export function dosesDoTratamento(
  t: TratamentoDaDemo,
  desdePedido: string | null,
  atePedido: string | null,
): DosesDoTratamento | { erro: string } {
  const ate = atePedido ?? hoje()
  const desde = desdePedido ?? somarDias(ate, -41)
  const dias = diasEntre(desde, ate)
  if (dias < 0 || dias > 89) return { erro: 'PERIODO_INVALIDO' }
  const desdeMs = meiaNoite(desde)
  const ateMs = meiaNoite(somarDias(ate, 1)) - 1
  return {
    tratamentoId: t.id,
    desde,
    ate,
    faixa: faixaEntre(t, desdeMs, ateMs),
    resumo: resumoEntre(t, instante(desde, '00:00'), desdeMs, ateMs),
    truncado: false,
  }
}

export function marcarCriticoDe(t: TratamentoDaDemo, critico: boolean) {
  t.critico = critico
  return { tratamentoId: t.id, critico }
}

export function registrarContatoEm(t: TratamentoDaDemo, nota: string) {
  t.contato = { em: agoraIso(), nota }
  return { tratamentoId: t.id, contatoEm: t.contato.em }
}
