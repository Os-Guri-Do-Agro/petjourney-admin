/**
 * O prontuário da demonstração: atendimentos, prescrições e receitas, documentos, laudos, atos,
 * adendos e cópias do prontuário.
 *
 * Todo agendamento FINALIZADO ou EM_ATENDIMENTO da agenda tem `atendimentoId = demo-atd-<id>`. São
 * uns 2.500: o atendimento se monta **sob demanda** (determinístico pelo id, guardado depois de
 * montado), com o caso clínico do tipo e da espécie (`prontuario-casos.ts`). O que a demonstração
 * muda (gravar seção, finalizar, assinar...) fica no registro guardado até recarregar.
 *
 * Às 10:40: os de hoje em consulta são rascunhos em andamento; quatro rascunhos esperam a
 * assinatura (dois de hoje cedo, um do último dia útil, um de três dias atrás); alguns finalizados
 * de hoje e da semana ainda não liberaram o resumo para o app; dois antigos foram anulados.
 *
 * Exporta, para as rotas agregadoras (pendências, meu dia, atividades):
 * - `itensDaLista(filtro)` — as linhas da lista de atendimentos (`ItemDaListaDeAtendimentosDto`),
 *   do mais recente; `prontuariosEmAberto()` (os rascunhos) e `finalizadosSemResumo()` (finalizados
 *   de paciente no app sem o resumo liberado);
 * - `receitasPorAssinar()` (receitas em rascunho) e `prescricoesSemReceita()`;
 * - `documentosComAceitePendente()` (termos emitidos esperando o aceite) e `documentosEmRascunho()`;
 * - `copiasPorGerar()` (pedidos de cópia ABERTO ou PRORROGADO) e `PEDIDOS_DE_COPIA`;
 * - `atendimentosDoPaciente(pacienteId)` e `linhaDoTempoDoPaciente(pacienteId)` — o que o paciente
 *   tem (atendimentos, atos e faltas). `registrarFonteDaLinhaDoTempo(fonte)` acrescenta itens de
 *   outras áreas (vacinas, internações) à linha do tempo da ficha;
 * - `registroDoAtendimento(id)`, `atendimentoDto(registro, dispositivoId)` e as funções de escrita
 *   que as rotas usam.
 */
import type {
  Adendo,
  Atendimento,
  Ato,
  ItemDaLinhaDoTempo,
  ItemDaLista,
  TipoNaLinhaDoTempo,
} from '@/service/parceiro/atendimentos-service'
import type { Documento } from '@/service/parceiro/documentos-service'
import type { Laudo } from '@/service/parceiro/documentos-service'
import type { PedidoDeCopia } from '@/service/parceiro/copias-service'
import type {
  AvisoDaPrescricao,
  ItemDaReceita,
  Prescricao,
  Receita,
} from '@/service/parceiro/receitas-service'
import type { CriarPrescricaoDto } from '@/service/contrato/openapi'

import { criarSorteio, type Sorteio } from '../aleatorio'
import {
  AGENDAMENTOS,
  agendamento,
  agendamentoDoAtendimento,
  agendamentosDoPaciente,
  type AgendamentoDaDemo,
} from '../base/agenda'
import { cliente, paciente, type PacienteDaDemo } from '../base/cadastro'
import { RETORNOS_PENDENTES } from './agenda-consulta'
import { pessoaDaEquipe, profissional, tipo as tipoDaBase, USUARIO_ID } from '../base/clinica'
import { normalizar } from '../roteador'
import {
  agora,
  agoraIso,
  diaDaSemana,
  diasEntre,
  hoje,
  instante,
  somarDias,
  somarMinutos,
} from '../relogio'
import {
  diagnostico as diagnosticoDoCatalogo,
  exame as exameDoCatalogo,
  faixaDoVital,
  faixaEtariaDe,
  fracionar,
  medicamento as medicamentoDoCatalogo,
  statusDoVital,
  type Vital,
} from './prontuario-catalogos'
import {
  casosDaConsulta,
  CIRURGIA_CASTRACAO_FEMEA,
  CIRURGIA_CASTRACAO_MACHO,
  CIRURGIA_DA_FRIDA,
  CIRURGIA_DENTARIA,
  CIRURGIA_EXOTICO,
  CIRURGIA_NODULO,
  EMERGENCIAS,
  EXAME_DE_ROTINA,
  EXAME_RENAL,
  grupoDe,
  NOTA_INTERNA_DO_PACIENTE,
  RETORNO_GERAL,
  VACINA_DE_CAO,
  VACINA_DE_GATO,
  VACINA_SEM_PROTOCOLO,
  type Caso,
  type ChaveDoVital,
  type ItemPrescrito,
} from './prontuario-casos'

type Tipo = Atendimento['tipo']
type Status = Atendimento['status']
type Secao = Atendimento['edicoes'][number]['secao']
type Vitais = Record<ChaveDoVital, { valor: number | null; naoAferido: boolean }>

export type Lock = {
  dispositivoId: string
  rotulo: string | null
  profissionalNome: string | null
  desde: string
  ate: string
}

export type RegistroDoAtendimento = {
  id: string
  pacienteId: string
  agendamentoId: string | null
  profissionalId: string
  status: Status
  tipo: Tipo
  versao: number
  abertoEm: string
  realizadoEm: string
  dataDoAtendimento: string
  pesoKg: number | null
  anamnese: Atendimento['anamnese']
  exame: Omit<Atendimento['exameFisico'], 'vitais' | 'porte' | 'faixaEtaria'> & { vitais: Vitais }
  diagnostico: Atendimento['diagnostico']
  conduta: Atendimento['conduta']
  edicoes: Atendimento['edicoes']
  autores: Atendimento['autores']
  adendos: Adendo[]
  atos: Ato[]
  resumo: Atendimento['resumo']
  preConsulta: Atendimento['preConsulta']
  pesoDeCasa: number | null
  retrato: Atendimento['retrato']
  finalizadoEm: string | null
  anuladoEm: string | null
  motivoAnulacao: string | null
  retificaAtendimentoId: string | null
  nuncaAberto: boolean
  lock: Lock | null
  prescricoes: Prescricao[]
  receitas: Receita[]
  laudos: Laudo[]
  /** O caso clínico que deu o texto (para o PDF e a linha do tempo). */
  queixa: string | null
}

/* ------------------------------------------------------------------------------- o estado */

const CACHE = new Map<string, RegistroDoAtendimento>()
const DESCARTADOS = new Set<string>()
const REINICIADOS = new Set<string>()
const DOCUMENTOS = new Map<string, Documento>()
const ATOS_AVULSOS: Ato[] = []

/** Os atendimentos que a agenda trouxe pronta: o resto nasceu na demonstração ("Iniciar"). */
const DA_BASE = new Set(
  AGENDAMENTOS.map((a) => a.atendimentoId).filter((id): id is string => Boolean(id)),
)

let sequencia = 0
function novoId(prefixo: string) {
  sequencia += 1
  return `${prefixo}-${String(sequencia).padStart(4, '0')}`
}

const MARINA = 'demo-prof-marina'

/* --------------------------------------------------------------------------- ajudas */

function kindDe(a: AgendamentoDaDemo): Tipo {
  return (tipoDaBase(a.tipoId)?.kind ?? 'CONSULTA') as Tipo
}

function nomeDoProfissional(id: string) {
  return profissional(id)?.nome ?? 'Equipe da clínica'
}

function crmvDe(id: string) {
  const p = profissional(id)
  return p?.registro ? `CRMV-${p.uf ?? 'SP'} ${p.registro}` : null
}

function profissionalDto(id: string): Atendimento['profissional'] {
  const p = profissional(id)
  return {
    id,
    nome: p?.nome ?? 'Equipe da clínica',
    conselho: p?.conselho ?? 'NENHUM',
    registro: p?.registro ?? null,
    uf: p?.uf ?? null,
  }
}

function pacienteDe(id: string): PacienteDaDemo {
  const p = paciente(id)
  if (!p) throw new Error(`demonstração: paciente ${id}`)
  return p
}

function codigoVerificador(semente: string) {
  const s = criarSorteio(`prontuario:codigo:${semente}`)
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const parte = () => Array.from({ length: 4 }, () => s.escolher([...letras])).join('')
  return `VMP-${parte()}-${parte()}`
}

function numeroBr(n: number, casas = 1) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
}

/** O peso no dia do atendimento: o filhote cresce, o adulto oscila pouco. */
function pesoNoDia(p: PacienteDaDemo, data: string, s: Sorteio): number | null {
  if (!p.pesoKg) return null
  const diasAtras = Math.max(0, diasEntre(data, hoje()))
  const idadeNoDia = p.nascimento ? diasEntre(p.nascimento, data) / 365.25 : 5
  let peso = p.pesoKg
  if (idadeNoDia < 1.5) peso = p.pesoKg * Math.max(0.45, 1 - diasAtras * 0.0025)
  else peso = p.pesoKg * (1 + (s.numero() - 0.5) * 0.03)
  return peso >= 10 ? Math.round(peso * 10) / 10 : Math.round(peso * 100) / 100
}

/* ------------------------------------------------------------- os estados da base */

type Especiais = { esquecidos: Set<string>; anulados: Set<string> }
let especiais: Especiais | null = null

/**
 * Os rascunhos esquecidos (o atendimento acabou, a assinatura não) e os anulados da base. Fixos
 * por regra, não por sorte: a captura sai sempre com os mesmos.
 */
function especiaisDaBase(): Especiais {
  if (especiais) return especiais
  const esquecidos = new Set<string>()
  const anulados = new Set<string>()
  const dia = hoje()
  /* O retorno pendente da agenda é de um atendimento finalizado: fica de fora. */
  const comRetornoPendente = new Set(RETORNOS_PENDENTES.map((r) => r.atendimentoId))
  const fechados = AGENDAMENTOS.filter(
    (a) =>
      a.status === 'FINALIZADO' &&
      a.atendimentoId &&
      DA_BASE.has(a.atendimentoId) &&
      !comRetornoPendente.has(a.atendimentoId),
  )

  for (const a of fechados) {
    const deHoje = a.inicio.slice(0, 10) === dia
    if (
      deHoje &&
      a.inicio.slice(11, 16) === '09:30' &&
      (a.profissionalId === MARINA || a.profissionalId === 'demo-prof-bruno')
    ) {
      esquecidos.add(a.id)
    }
  }

  const consultas = fechados.filter((a) => kindDe(a) === 'CONSULTA' && a.inicio.slice(0, 10) < dia)
  const ultimoDia = consultas.at(-1)?.inicio.slice(0, 10)
  const doRafael = consultas.filter(
    (a) => a.inicio.slice(0, 10) === ultimoDia && a.profissionalId === 'demo-prof-rafael',
  )
  const ultimoDoRafael = doRafael.at(-1)
  if (ultimoDoRafael) esquecidos.add(ultimoDoRafael.id)

  const tresDias = somarDias(dia, -3)
  const daCamila = consultas.filter(
    (a) => a.inicio.slice(0, 10) <= tresDias && a.profissionalId === 'demo-prof-camila',
  )
  const ultimoDaCamila = daCamila.at(-1)
  if (ultimoDaCamila) esquecidos.add(ultimoDaCamila.id)

  for (const atras of [19, 46]) {
    const data = somarDias(dia, -atras)
    const alvo = consultas.find((a) => a.inicio.slice(0, 10) >= data)
    if (alvo && !esquecidos.has(alvo.id)) anulados.add(alvo.id)
  }

  especiais = { esquecidos, anulados }
  return especiais
}

type EstadoInicial = 'EM_CURSO' | 'ESQUECIDO' | 'FINALIZADO' | 'ANULADO' | 'NOVO'

/** Descartado e iniciado de novo na agenda: volta como rascunho novo. */
function reiniciado(id: string, a: AgendamentoDaDemo) {
  if (REINICIADOS.has(id)) return true
  if (DESCARTADOS.has(id) && a.atendimentoId === id && a.status === 'EM_ATENDIMENTO') {
    DESCARTADOS.delete(id)
    REINICIADOS.add(id)
    return true
  }
  return false
}

function estadoInicial(a: AgendamentoDaDemo, id: string): EstadoInicial {
  if (!DA_BASE.has(id) || reiniciado(id, a)) return 'NOVO'
  if (a.status === 'EM_ATENDIMENTO') return 'EM_CURSO'
  const { esquecidos, anulados } = especiaisDaBase()
  if (esquecidos.has(a.id)) return 'ESQUECIDO'
  if (anulados.has(a.id)) return 'ANULADO'
  return 'FINALIZADO'
}

/** Quando o atendimento fechou: logo depois do horário, ou no fim do dia. */
function finalizadoEmDe(a: AgendamentoDaDemo): string {
  const s = criarSorteio(`prontuario:fim:${a.id}`)
  const base = a.finalizadoEm ?? a.fim
  if (s.chance(0.12)) {
    const noFimDoDia = instante(
      a.inicio.slice(0, 10),
      `18:${String(s.inteiro(10, 55)).padStart(2, '0')}`,
    )
    if (Date.parse(noFimDoDia) > Date.parse(base) && Date.parse(noFimDoDia) < agora().getTime()) {
      return noFimDoDia
    }
  }
  const fim = somarMinutos(base, s.inteiro(2, 18))
  return Date.parse(fim) < agora().getTime() ? fim : base
}

function anuladoEmDe(a: AgendamentoDaDemo): string {
  return somarMinutos(finalizadoEmDe(a), 60 * 26)
}

/** O resumo do finalizado: no app quando o responsável usa o app; os recentes, às vezes não. */
function resumoInicial(a: AgendamentoDaDemo, p: PacienteDaDemo): Atendimento['resumo'] {
  if (!p.noApp) {
    return {
      liberadoEm: null,
      publicado: false,
      motivoNaoPublicado: 'SEM_VINCULO',
      consultaId: null,
    }
  }
  const s = criarSorteio(`prontuario:resumo:${a.id}`)
  const atras = diasEntre(a.inicio.slice(0, 10), hoje())
  const pendente =
    atras === 0 ? s.chance(0.4) : atras <= 3 ? s.chance(0.1) : atras <= 6 ? s.chance(0.04) : false
  if (pendente) {
    return { liberadoEm: null, publicado: false, motivoNaoPublicado: null, consultaId: null }
  }
  return {
    liberadoEm: somarMinutos(finalizadoEmDe(a), s.inteiro(1, 40)),
    publicado: true,
    motivoNaoPublicado: null,
    consultaId: `demo-consulta-${a.id}`,
  }
}

/* ----------------------------------------------------------------------- o caso clínico */

const PRIMEIRA_CIRURGIA = new Map<string, string>()

function primeiraCirurgiaDo(pacienteId: string) {
  if (!PRIMEIRA_CIRURGIA.has(pacienteId)) {
    const primeira = agendamentosDoPaciente(pacienteId).find(
      (a) => kindDe(a) === 'CIRURGIA' && a.status !== 'CANCELADO',
    )
    PRIMEIRA_CIRURGIA.set(pacienteId, primeira?.id ?? '')
  }
  return PRIMEIRA_CIRURGIA.get(pacienteId)
}

/** A consulta anterior que o retorno reavalia. */
function consultaAnteriorDoRetorno(a: AgendamentoDaDemo) {
  return agendamentosDoPaciente(a.pacienteId)
    .filter(
      (b) =>
        b.inicio < a.inicio &&
        b.status === 'FINALIZADO' &&
        ['CONSULTA', 'EMERGENCIA', 'CIRURGIA'].includes(kindDe(b)),
    )
    .at(-1)
}

export function casoDe(a: AgendamentoDaDemo): Caso {
  const p = pacienteDe(a.pacienteId)
  const grupo = grupoDe(p)
  const s = criarSorteio(`prontuario:caso:${a.id}`)
  const idade = p.nascimento ? diasEntre(p.nascimento, a.inicio.slice(0, 10)) / 365.25 : 5

  switch (kindDe(a)) {
    case 'VACINA':
      return grupo === 'CAO'
        ? VACINA_DE_CAO
        : grupo === 'GATO'
          ? VACINA_DE_GATO
          : VACINA_SEM_PROTOCOLO
    case 'EXAME':
      return p.id === 'demo-pac-007-2' ? EXAME_RENAL : EXAME_DE_ROTINA
    case 'CIRURGIA': {
      if (p.id === 'demo-pac-019' && a.inicio.slice(0, 10) >= somarDias(hoje(), -1)) {
        return CIRURGIA_DA_FRIDA
      }
      if (grupo !== 'CAO' && grupo !== 'GATO') return CIRURGIA_EXOTICO
      if (p.castrado && idade < 4 && primeiraCirurgiaDo(p.id) === a.id) {
        return p.sexo === 'FEMEA' ? CIRURGIA_CASTRACAO_FEMEA : CIRURGIA_CASTRACAO_MACHO
      }
      return idade >= 6 ? s.escolher([CIRURGIA_DENTARIA, CIRURGIA_NODULO]) : CIRURGIA_NODULO
    }
    case 'EMERGENCIA': {
      if (grupo === 'CAO') return s.escolher(EMERGENCIAS.CAO)
      if (grupo === 'GATO') {
        /* A obstrução uretral é dos machos. */
        const casos = EMERGENCIAS.GATO.filter(
          (c) => p.sexo === 'MACHO' || !c.diagnosticos.some(([, codigo]) => codigo === 'UR-05'),
        )
        return s.escolher(casos)
      }
      return s.escolher(EMERGENCIAS.OUTRO)
    }
    case 'RETORNO': {
      const anterior = consultaAnteriorDoRetorno(a)
      const base = anterior ? casoDe(anterior) : null
      const depois = base?.depois ?? RETORNO_GERAL
      return {
        queixa: depois.queixa,
        historia: depois.historia,
        desde: 'MAIS_DE_DUAS_SEMANAS',
        evolucao: depois.evolucao ?? 'MELHORANDO',
        alterados: depois.alterados ?? [],
        diagnosticos:
          depois.diagnosticos ??
          (base?.diagnosticos ?? [])
            .filter(([kind]) => kind !== 'DIFERENCIAL')
            .map(([, codigo]) => ['DEFINITIVO', codigo] as ['DEFINITIVO', string]),
        orientacoes: depois.orientacoes,
        sinais: depois.sinais ?? base?.sinais,
        prescricoes: depois.prescricoes,
        interna: base?.interna,
      }
    }
    default: {
      /* O crônico volta pela doença dele metade das vezes; na outra, por outra queixa. */
      const proprios = casosDaConsulta(p.id, grupo)
      const doGrupo = casosDaConsulta('', grupo)
      return s.escolher(proprios !== doGrupo && s.chance(0.5) ? proprios : doGrupo)
    }
  }
}

/* -------------------------------------------------------------------- as seções montadas */

const SISTEMAS: Atendimento['exameFisico']['sistemas'][number]['sistema'][] = [
  'CARDIOVASCULAR',
  'RESPIRATORIO',
  'DIGESTORIO',
  'URINARIO',
  'TEGUMENTAR',
  'LOCOMOTOR',
  'NEUROLOGICO',
  'LINFONODOS',
]

const CHAVES: ChaveDoVital[] = [
  'peso',
  'temperatura',
  'frequenciaCardiaca',
  'frequenciaRespiratoria',
  'tempoPreenchimentoCapilar',
  'escoreCorporal',
  'pressaoSistolica',
]

const VITAL_DA_CHAVE: Record<ChaveDoVital, Vital> = {
  peso: 'PESO',
  temperatura: 'TEMPERATURA',
  frequenciaCardiaca: 'FREQUENCIA_CARDIACA',
  frequenciaRespiratoria: 'FREQUENCIA_RESPIRATORIA',
  tempoPreenchimentoCapilar: 'TEMPO_PREENCHIMENTO_CAPILAR',
  escoreCorporal: 'ESCORE_CORPORAL',
  pressaoSistolica: 'PRESSAO_SISTOLICA',
}

function vazio(): Vitais {
  return Object.fromEntries(CHAVES.map((c) => [c, { valor: null, naoAferido: false }])) as Vitais
}

function decimal(s: Sorteio, min: number, max: number) {
  return Math.round((min + s.numero() * (max - min)) * 10) / 10
}

/** Os sinais vitais do dia, pela espécie e pelo porte, com o que o caso muda. */
function vitaisDe(
  p: PacienteDaDemo,
  peso: number | null,
  caso: Caso,
  s: Sorteio,
  so?: 'basico',
): Vitais {
  const v = vazio()
  const por = (chave: ChaveDoVital, valor: number | null) => {
    v[chave] = valor === null ? { valor: null, naoAferido: true } : { valor, naoAferido: false }
  }
  por('peso', peso)
  const grupo = grupoDe(p)
  const porte = p.porte
  switch (grupo) {
    case 'CAO':
      por('temperatura', decimal(s, 38.1, 39.0))
      por(
        'frequenciaCardiaca',
        porte === 'GRANDE' || porte === 'GIGANTE'
          ? s.inteiro(72, 104)
          : porte === 'MEDIO'
            ? s.inteiro(80, 118)
            : s.inteiro(96, 136),
      )
      por('frequenciaRespiratoria', s.inteiro(16, 28))
      por('tempoPreenchimentoCapilar', s.escolher([1.5, 2]))
      por(
        'escoreCorporal',
        s.pesado([
          [5, 6],
          [4, 2],
          [6, 2],
        ] as const),
      )
      por('pressaoSistolica', s.chance(0.3) ? s.inteiro(118, 150) : null)
      break
    case 'GATO':
      por('temperatura', decimal(s, 38.1, 39.0))
      por('frequenciaCardiaca', s.inteiro(156, 204))
      por('frequenciaRespiratoria', s.inteiro(20, 32))
      por('tempoPreenchimentoCapilar', s.escolher([1.5, 2]))
      por(
        'escoreCorporal',
        s.pesado([
          [5, 5],
          [6, 3],
          [4, 1],
        ] as const),
      )
      por('pressaoSistolica', s.chance(0.35) ? s.inteiro(124, 152) : null)
      break
    case 'COELHO':
      por('temperatura', decimal(s, 38.6, 39.6))
      por('frequenciaCardiaca', s.inteiro(196, 252))
      por('frequenciaRespiratoria', s.inteiro(36, 54))
      por('tempoPreenchimentoCapilar', null)
      por('escoreCorporal', 5)
      por('pressaoSistolica', null)
      break
    case 'ROEDOR':
      por('temperatura', decimal(s, 37.6, 38.9))
      por('frequenciaCardiaca', s.inteiro(250, 330))
      por('frequenciaRespiratoria', s.inteiro(50, 90))
      por('tempoPreenchimentoCapilar', null)
      por('escoreCorporal', 5)
      por('pressaoSistolica', null)
      break
    case 'FURAO':
      por('temperatura', decimal(s, 38.0, 39.4))
      por('frequenciaCardiaca', s.inteiro(200, 250))
      por('frequenciaRespiratoria', s.inteiro(30, 40))
      por('tempoPreenchimentoCapilar', 1.5)
      por('escoreCorporal', 5)
      por('pressaoSistolica', null)
      break
    case 'AVE':
      por('temperatura', null)
      por('frequenciaCardiaca', s.inteiro(260, 340))
      por('frequenciaRespiratoria', s.inteiro(40, 60))
      por('tempoPreenchimentoCapilar', null)
      por('escoreCorporal', null)
      por('pressaoSistolica', null)
      break
    case 'REPTIL':
      por('temperatura', null)
      por('frequenciaCardiaca', s.inteiro(22, 38))
      por('frequenciaRespiratoria', s.inteiro(4, 10))
      por('tempoPreenchimentoCapilar', null)
      por('escoreCorporal', null)
      por('pressaoSistolica', null)
      break
  }
  for (const [chave, valor] of Object.entries(caso.vitais ?? {}) as [ChaveDoVital, number][]) {
    por(chave, valor)
  }
  if (so === 'basico') {
    for (const chave of CHAVES) {
      if (chave !== 'peso' && chave !== 'temperatura') v[chave] = { valor: null, naoAferido: false }
    }
  }
  return v
}

function vitaisDto(r: RegistroDoAtendimento): Atendimento['exameFisico']['vitais'] {
  const p = pacienteDe(r.pacienteId)
  const etaria = faixaEtariaDe(p.nascimento, p.especie, r.dataDoAtendimento)
  return Object.fromEntries(
    CHAVES.map((chave) => {
      const medida = r.exame.vitais[chave]
      const vital = VITAL_DA_CHAVE[chave]
      const faixa = vital === 'PESO' ? null : faixaDoVital(vital, p.especie, p.porte, etaria)
      return [
        chave,
        {
          vital,
          valor: medida.valor,
          naoAferido: medida.naoAferido,
          status: statusDoVital(medida.valor, medida.naoAferido, faixa),
          /* N32: a faixa do atendimento é `{ min, max, unidade, fonte }`, sem as casas. */
          faixa: faixa
            ? { min: faixa.min, max: faixa.max, unidade: faixa.unidade, fonte: faixa.fonte }
            : null,
        },
      ]
    }),
  ) as Atendimento['exameFisico']['vitais']
}

function ambienteDe(p: PacienteDaDemo): Atendimento['anamnese']['ambiente'] {
  if (p.especie === 'REPTIL') return 'EXTERNO'
  if (p.especie === 'CACHORRO') return 'MISTO'
  return 'DOMICILIAR'
}

function anamneseDe(
  p: PacienteDaDemo,
  caso: Caso,
  s: Sorteio,
  kind: Tipo,
): Atendimento['anamnese'] {
  const caoOuGato = p.especie === 'CACHORRO' || p.especie === 'GATO'
  return {
    queixaPrincipal: caso.queixa,
    historia: caso.historia,
    desdeQuando: caso.desde ?? null,
    evolucao: caso.evolucao ?? null,
    apetite: caso.apetite ?? 'NORMAL',
    evacuacao: caso.evacuacao ?? 'NORMAL',
    miccao: caso.miccao ?? 'NORMAL',
    ambiente: ambienteDe(p),
    vacinacaoEmDia: caoOuGato ? kind === 'VACINA' || s.chance(0.85) : null,
    vermifugacaoEmDia: caoOuGato ? s.chance(0.75) : null,
    camposDaPreConsulta: [],
    camposDaEscuta: [],
  }
}

function anamneseVazia(): Atendimento['anamnese'] {
  return {
    queixaPrincipal: null,
    historia: null,
    desdeQuando: null,
    evolucao: null,
    apetite: null,
    evacuacao: null,
    miccao: null,
    ambiente: null,
    vacinacaoEmDia: null,
    vermifugacaoEmDia: null,
    camposDaPreConsulta: [],
    camposDaEscuta: [],
  }
}

function exameDe(
  p: PacienteDaDemo,
  caso: Caso,
  kind: Tipo,
  peso: number | null,
  s: Sorteio,
): RegistroDoAtendimento['exame'] {
  const alterados = new Map(caso.alterados ?? [])
  const exotico = !['CACHORRO', 'GATO'].includes(p.especie)
  let sistemas: RegistroDoAtendimento['exame']['sistemas']
  if (kind === 'EXAME') sistemas = []
  else if (kind === 'VACINA') {
    sistemas = SISTEMAS.map((sistema) => ({
      sistema,
      status: ['CARDIOVASCULAR', 'RESPIRATORIO', 'TEGUMENTAR', 'LINFONODOS'].includes(sistema)
        ? ('NORMAL' as const)
        : ('NAO_AVALIADO' as const),
      nota: null,
    }))
  } else {
    sistemas = SISTEMAS.map((sistema) => {
      const nota = alterados.get(sistema)
      if (nota) return { sistema, status: 'ALTERADO' as const, nota }
      if (exotico && (sistema === 'URINARIO' || sistema === 'LINFONODOS')) {
        return { sistema, status: 'NAO_AVALIADO' as const, nota: null }
      }
      return { sistema, status: 'NORMAL' as const, nota: null }
    })
  }
  return {
    vitais: vitaisDe(p, peso, caso, s, kind === 'EXAME' ? 'basico' : undefined),
    mucosas: caso.mucosas ?? 'NORMOCORADAS',
    hidratacao: caso.hidratacao ?? 'NORMAL',
    observacao: caso.exameObs ?? null,
    sistemas,
  }
}

function exameVazio(): RegistroDoAtendimento['exame'] {
  return { vitais: vazio(), mucosas: null, hidratacao: null, observacao: null, sistemas: [] }
}

function diagnosticoDe(id: string, caso: Caso): Atendimento['diagnostico'] {
  const itens = caso.diagnosticos
    .map(([kind, codigo], i) => {
      const d = diagnosticoDoCatalogo(codigo)
      return d
        ? { id: `${id}-diag-${i + 1}`, kind, codigo: d.codigo, descricao: d.descricao }
        : null
    })
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
  return {
    semDiagnostico: itens.length === 0,
    itens,
    antecedentes: (caso.antecedentes ?? []).map(([kind, descricao, quando], i) => ({
      id: `${id}-antecedente-${i + 1}`,
      kind,
      descricao,
      quando,
    })),
  }
}

function diagnosticoVazio(): Atendimento['diagnostico'] {
  return { semDiagnostico: false, itens: [], antecedentes: [] }
}

function condutaDe(
  p: PacienteDaDemo,
  caso: Caso,
  a: AgendamentoDaDemo | null,
): Atendimento['conduta'] {
  const interna = caso.interna ?? NOTA_INTERNA_DO_PACIENTE[p.id] ?? ''
  const retornoEmDias = caso.retorno && caso.retorno <= 90 ? caso.retorno : null
  return {
    orientacoes: caso.orientacoes,
    idiomaDasOrientacoes: 'pt-BR',
    sinaisDeAlerta: caso.sinais ?? null,
    observacaoInterna: interna || null,
    retornoEmDias,
    retornoTipoId: retornoEmDias ? 'demo-tipo-retorno' : null,
    retornoAgendamentoId: retornoEmDias && a ? retornoMarcado(a, retornoEmDias) : null,
  }
}

function condutaVazia(): Atendimento['conduta'] {
  return {
    orientacoes: null,
    idiomaDasOrientacoes: null,
    sinaisDeAlerta: null,
    observacaoInterna: null,
    retornoEmDias: null,
    retornoTipoId: null,
    retornoAgendamentoId: null,
  }
}

/** O retorno que já está na agenda: o próximo RETORNO do paciente perto do vencimento. */
function retornoMarcado(a: AgendamentoDaDemo, dias: number): string | null {
  const vence = somarDias(a.inicio.slice(0, 10), dias)
  const proximo = agendamentosDoPaciente(a.pacienteId).find(
    (b) =>
      b.inicio > a.inicio &&
      kindDe(b) === 'RETORNO' &&
      b.status !== 'CANCELADO' &&
      Math.abs(diasEntre(vence, b.inicio.slice(0, 10))) <= 7,
  )
  return proximo?.id ?? null
}

/* ------------------------------------------------------------------------- pré-consulta */

const SINTOMAS: Array<[RegExp, string]> = [
  [/v[oô]mit/i, 'VOMITO'],
  [/diarreia|fezes moles|fezes/i, 'DIARREIA'],
  [/co[cç]a/i, 'COCEIRA'],
  [/espirr/i, 'ESPIRRO'],
  [/tosse/i, 'TOSSE'],
  [/manc/i, 'CLAUDICACAO'],
  [/olho/i, 'SECRECAO_OCULAR'],
  [/h[aá]lito/i, 'HALITOSE'],
  [/lamb/i, 'LAMBEDURA_EXCESSIVA'],
  [/pelo|falha/i, 'QUEDA_DE_PELO'],
  [/sem comer|parou de comer/i, 'FRAQUEZA'],
]

function preConsultaDe(
  a: AgendamentoDaDemo,
  caso: Caso,
  peso: number | null,
  s: Sorteio,
): Atendimento['preConsulta'] {
  const respondidaEm = somarMinutos(a.inicio, -s.inteiro(14, 30) * 60)
  const sintomas = SINTOMAS.filter(([re]) => re.test(caso.queixa)).map(([, codigo]) => codigo)
  const motivo =
    kindDe(a) === 'RETORNO' ? 'RETORNO' : caso.diagnosticos.length ? 'SINTOMA' : 'CHECKUP'
  const bruto = <T>(valor: unknown) => valor as T
  const campo = (
    valor: string,
    marca: 'QUEIXA_PRINCIPAL' | 'DESDE_QUANDO' | 'APETITE' | 'EVOLUCAO',
  ) => ({
    valor: bruto<Record<string, never>>(valor),
    procedencia: 'PRE_CONSULTA' as const,
    marca,
  })
  const campos: NonNullable<Atendimento['preConsulta']>['campos'] = {
    queixaPrincipal: campo(caso.queixa, 'QUEIXA_PRINCIPAL'),
  }
  if (caso.desde) campos.desdeQuando = campo(caso.desde, 'DESDE_QUANDO')
  if (caso.evolucao) campos.evolucao = campo(caso.evolucao, 'EVOLUCAO')
  campos.apetite = campo(caso.apetite ?? 'NORMAL', 'APETITE')
  return {
    respondidaEm,
    atualizadaEm: somarMinutos(respondidaEm, s.inteiro(0, 90)),
    campos,
    motivo: { valor: bruto<Record<string, never>>(motivo), procedencia: 'PRE_CONSULTA' },
    sintomas: sintomas.length
      ? { valor: bruto<Record<string, never>>(sintomas), procedencia: 'PRE_CONSULTA' }
      : null,
    hidratacao: {
      valor: bruto<Record<string, never>>(s.escolher(['NORMAL', 'NORMAL', 'MUITO'])),
      procedencia: 'DIARIO',
    },
    vitalidade: {
      valor: bruto<Record<string, never>>(
        caso.diagnosticos.length ? s.escolher(['CALMO', 'DESANIMADO']) : 'ATIVO',
      ),
      procedencia: 'DIARIO',
    },
    observacao: s.chance(0.5) ? 'Prefere ser examinado no colo do responsável.' : null,
    pesoDeCasa: peso
      ? {
          pesoKg: Math.round(peso * (1 + (s.numero() - 0.5) * 0.04) * 100) / 100,
          pesadoEm: somarDias(a.inicio.slice(0, 10), -s.inteiro(1, 4)),
          procedencia: 'DIARIO',
        }
      : null,
    fotoIds: [],
  }
}

/* ---------------------------------------------------------------- prescrição e receita */

const VIA_NA_FRASE: Record<Prescricao['via'], [string, string]> = {
  ORAL: ['Dar', 'por via oral'],
  SUBCUTANEA: ['Aplicar', 'por via subcutânea'],
  INTRAMUSCULAR: ['Aplicar', 'por via intramuscular'],
  INTRAVENOSA: ['Aplicar', 'por via intravenosa'],
  TOPICA: ['Aplicar', 'na pele'],
  OTOLOGICA: ['Pingar', 'no ouvido'],
  OFTALMICA: ['Pingar', 'no olho'],
  INTRANASAL: ['Aplicar', 'no nariz'],
}

const FRACOES: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' }

function textoDaDose(quantidade: number, unidade: Prescricao['unidade']) {
  if (unidade === 'COMPRIMIDO') {
    const inteiros = Math.floor(quantidade)
    const resto = Math.round((quantidade - inteiros) * 100) / 100
    const fracao = FRACOES[resto]
    if (!inteiros && fracao) return `${fracao} comprimido`
    if (fracao) return `${inteiros} e ${fracao} comprimidos`
    return inteiros === 1 ? '1 comprimido' : `${numeroBr(quantidade, 2)} comprimidos`
  }
  if (unidade === 'ML') return `${numeroBr(quantidade, 2)} mL`
  if (unidade === 'GOTA') return quantidade === 1 ? '1 gota' : `${numeroBr(quantidade, 0)} gotas`
  return quantidade === 1 ? '1 aplicação' : `${numeroBr(quantidade, 0)} aplicações`
}

function frequenciaNaFrase(horas: number) {
  if (horas === 24) return 'uma vez ao dia'
  if (horas === 720) return 'a cada 30 dias'
  if (horas === 84) return 'duas vezes por semana'
  if (horas === 168) return 'uma vez por semana'
  return `a cada ${horas} horas`
}

export function fraseDaPrescricao(
  p: Pick<Prescricao, 'dose' | 'via' | 'frequenciaHoras' | 'duracaoDias' | 'reavaliarEmDias'>,
) {
  const [verbo, via] = VIA_NA_FRASE[p.via]
  const duracao = p.duracaoDias
    ? `durante ${p.duracaoDias} ${p.duracaoDias === 1 ? 'dia' : 'dias'}`
    : 'em uso contínuo'
  /* Como a API (PJ-HC2AKL): "..., em uso contínuo. Reavaliar em 90 dias." */
  const reavaliar =
    !p.duracaoDias && p.reavaliarEmDias
      ? ` Reavaliar em ${p.reavaliarEmDias} ${p.reavaliarEmDias === 1 ? 'dia' : 'dias'}.`
      : ''
  return `${verbo} ${p.dose} ${via}, ${frequenciaNaFrase(p.frequenciaHoras)}, ${duracao}.${reavaliar}`
}

export type EntradaDaPrescricao = Partial<
  Pick<
    CriarPrescricaoDto,
    | 'medicamentoId'
    | 'nomeLivre'
    | 'mgPorKg'
    | 'pesoKg'
    | 'quantidade'
    | 'unidade'
    | 'duracaoDias'
    | 'reavaliarEmDias'
    | 'alergiaConfirmada'
    | 'proibidoConfirmado'
    | 'arredondamentoConfirmado'
    | 'foraDaFaixaConfirmada'
    | 'pesoImplausivelConfirmado'
    | 'critico'
  >
> & { via: Prescricao['via']; frequenciaHoras: number; instrucoes?: unknown }

export type ResultadoDaPrescricao =
  | { ok: true; prescricao: Prescricao; avisos: AvisoDaPrescricao[] }
  | { ok: false; codigo: string; mensagem: string; detalhes: Record<string, unknown> }

/** A conta e as confirmações da prescrição, como o servidor faz. */
export function montarPrescricao(
  r: RegistroDoAtendimento,
  id: string,
  ordem: number,
  e: EntradaDaPrescricao,
): ResultadoDaPrescricao {
  const p = pacienteDe(r.pacienteId)
  const m = medicamentoDoCatalogo(e.medicamentoId)
  const nome = m?.nome ?? (e.nomeLivre ?? '').trim()
  if (!nome) {
    return {
      ok: false,
      codigo: 'MEDICAMENTO_OBRIGATORIO',
      mensagem: 'Escolha o medicamento.',
      detalhes: {},
    }
  }
  const unidade = m?.unidadeApresentacao ?? e.unidade ?? 'COMPRIMIDO'
  const daEspecie = m?.doses.find((d) => d.especie === p.especie) ?? null
  const pesoInformado = e.pesoKg ?? null
  const pesoDoExame = r.exame.vitais.peso.valor
  const pesoKg = pesoInformado ?? pesoDoExame ?? p.pesoKg ?? null
  const pesoOrigem = pesoInformado
    ? 'INFORMADO'
    : pesoDoExame
      ? 'EXAME'
      : p.pesoKg
        ? 'CADASTRO'
        : null

  let quantidade = e.quantidade ?? 1
  let mgPorAdministracao: number | null = null
  let mgReal: number | null = null
  let fracao: Prescricao['fracao'] = null
  const pendentes: string[] = []
  const detalhes: Record<string, unknown> = {}

  if (e.mgPorKg && m) {
    if (!pesoKg) {
      return {
        ok: false,
        codigo: 'PESO_AUSENTE',
        mensagem: 'Informe o peso para a conta da dose.',
        detalhes: {},
      }
    }
    mgPorAdministracao = Math.round(e.mgPorKg * pesoKg * 1000) / 1000
    const frac = fracionar(mgPorAdministracao / m.concentracao, unidade)
    quantidade = frac.quantidade
    fracao = unidade === 'COMPRIMIDO' ? frac.tipo : null
    mgReal = Math.round(quantidade * m.concentracao * 1000) / 1000
    if (
      mgPorAdministracao > 0 &&
      Math.abs(mgReal - mgPorAdministracao) / mgPorAdministracao > 0.15
    ) {
      pendentes.push('DOSE_ARREDONDADA')
      detalhes.dose = { mgReal, mgCalculado: mgPorAdministracao }
    }
    if (
      daEspecie &&
      daEspecie.mgKgMax > 0 &&
      (e.mgPorKg > daEspecie.mgKgMax * 1.0001 || e.mgPorKg < daEspecie.mgKgMin * 0.9999)
    ) {
      pendentes.push('FORA_DA_FAIXA')
      detalhes.faixa = { origem: 'ESPECIE', mgKgMin: daEspecie.mgKgMin, mgKgMax: daEspecie.mgKgMax }
    }
  } else if (m) {
    mgPorAdministracao = Math.round(quantidade * m.concentracao * 1000) / 1000
    mgReal = mgPorAdministracao
  }
  if (daEspecie?.proibido) pendentes.push('ESPECIE_PROIBIDA')
  const alergia = m
    ? p.alertas.find(
        (a) =>
          a.tipo === 'ALERGIA' &&
          normalizar(a.detalhe).includes(normalizar(m.principioAtivo.split(' ')[0])),
      )
    : null
  if (alergia) pendentes.push('ALERGIA')

  const confirmado: Record<string, boolean | undefined> = {
    ALERGIA: e.alergiaConfirmada,
    ESPECIE_PROIBIDA: e.proibidoConfirmado,
    DOSE_ARREDONDADA: e.arredondamentoConfirmado,
    FORA_DA_FAIXA: e.foraDaFaixaConfirmada,
  }
  const faltam = pendentes.filter((codigo) => !confirmado[codigo])
  if (faltam.length) {
    return {
      ok: false,
      codigo: 'CONFIRMACAO_PENDENTE',
      mensagem: 'A prescrição tem avisos que pedem a sua confirmação.',
      detalhes: { ...detalhes, avisos: faltam },
    }
  }

  const avisosNoAto: string[] = []
  if (pendentes.includes('ALERGIA')) avisosNoAto.push('ALERGIA')
  if (pendentes.includes('ESPECIE_PROIBIDA')) avisosNoAto.push('ESPECIE_PROIBIDA')
  if (pendentes.includes('FORA_DA_FAIXA') && daEspecie && e.mgPorKg) {
    avisosNoAto.push(e.mgPorKg > daEspecie.mgKgMax ? 'ACIMA_DA_USUAL' : 'ABAIXO_DA_USUAL')
  }
  const avisos: AvisoDaPrescricao[] = []
  if (m && !daEspecie && m.doses.length) {
    avisos.push({ codigo: 'SEM_DOSE_DA_ESPECIE', bloqueante: false, cuidado: null, detalhe: null })
    avisosNoAto.push('SEM_DOSE_DA_ESPECIE')
  }
  if (daEspecie?.nota) {
    avisos.push({ codigo: 'CUIDADO', bloqueante: false, cuidado: null, detalhe: daEspecie.nota })
  }

  const instrucoes =
    typeof e.instrucoes === 'string' && e.instrucoes.trim() ? e.instrucoes.trim() : null
  const prescricao: Prescricao = {
    id,
    atendimentoId: r.id,
    receitaId: null,
    receitaStatus: null,
    ordem,
    medicamentoId: m?.id ?? null,
    nomeLivre: m ? null : nome,
    medicamentoNome: nome,
    principioAtivo: m?.principioAtivo ?? null,
    apresentacao: m?.apresentacao ?? null,
    concentracao: m?.concentracao ?? null,
    unidadeApresentacao: m?.unidadeApresentacao ?? null,
    regimeControle: m?.controle ?? 'NENHUM',
    listaControle: m?.listaControle ?? null,
    via: e.via,
    mgPorKg: e.mgPorKg ?? null,
    pesoKg: e.mgPorKg ? pesoKg : null,
    pesoOrigem: e.mgPorKg ? pesoOrigem : null,
    mgPorAdministracao,
    quantidade,
    unidade,
    fracao,
    dose: textoDaDose(quantidade, unidade),
    frequenciaHoras: e.frequenciaHoras,
    duracaoDias: e.duracaoDias ?? null,
    /* Só no uso contínuo; passar a ter duração apaga (como a API). */
    reavaliarEmDias: e.duracaoDias == null ? (e.reavaliarEmDias ?? null) : null,
    instrucoes,
    alergiaConfirmada: Boolean(e.alergiaConfirmada),
    proibidoConfirmado: Boolean(e.proibidoConfirmado),
    arredondamentoConfirmado: Boolean(e.arredondamentoConfirmado),
    foraDaFaixaConfirmada: Boolean(e.foraDaFaixaConfirmada),
    pesoImplausivelConfirmado: Boolean(e.pesoImplausivelConfirmado),
    mgReal,
    avisosNoAto,
    critico: Boolean(e.critico),
    editavel: r.status === 'RASCUNHO',
  }
  return { ok: true, prescricao, avisos }
}

function entradaDoCaso(item: ItemPrescrito): EntradaDaPrescricao {
  return {
    medicamentoId: item.med,
    mgPorKg: item.mgPorKg,
    quantidade: item.quantidade,
    unidade: item.unidade,
    via: item.via,
    frequenciaHoras: item.freq,
    duracaoDias: item.dias,
    instrucoes: item.instrucoes,
    alergiaConfirmada: true,
    proibidoConfirmado: true,
    arredondamentoConfirmado: true,
    foraDaFaixaConfirmada: true,
  }
}

function classeDoItem(p: Prescricao): Pick<ItemDaReceita, 'classe' | 'foraDoPdf' | 'motivo'> {
  if (p.regimeControle === 'MAPA_VETERINARIO') {
    return { classe: 'SIPEAGRO', foraDoPdf: true, motivo: 'EMITIR_NO_SIPEAGRO' }
  }
  if (p.regimeControle === 'ANVISA_RETENCAO') {
    return { classe: 'RETENCAO', foraDoPdf: true, motivo: 'RECEITA_DE_RETENCAO_EM_PAPEL' }
  }
  if (p.regimeControle === 'ANVISA_HUMANO') {
    if (p.listaControle && /^[AB]/.test(p.listaControle)) {
      return { classe: 'NOTIFICACAO_OFICIAL', foraDoPdf: true, motivo: 'EXIGE_NOTIFICACAO_OFICIAL' }
    }
    return { classe: 'CONTROLE_ESPECIAL', foraDoPdf: false, motivo: null }
  }
  return { classe: 'SIMPLES', foraDoPdf: false, motivo: null }
}

const INSTRUCAO_FORA_DO_PDF: Record<NonNullable<ItemDaReceita['motivo']>, string> = {
  EXIGE_NOTIFICACAO_OFICIAL:
    'Emitir na notificação de receita do talonário da Vigilância Sanitária.',
  EMITIR_NO_SIPEAGRO: 'Emitir a receita no SIPEAGRO (MAPA).',
  MAGISTRAL_CONTROLADA_MAPA: 'Receita magistral controlada: emitir em papel, em duas vias.',
  RECEITA_DE_RETENCAO_EM_PAPEL: 'Emitir em papel, em duas vias: a farmácia retém uma.',
}

export function montarReceita(
  r: RegistroDoAtendimento,
  id: string,
  prescricoes: Prescricao[],
): Receita {
  const itens: ItemDaReceita[] = prescricoes.map((p, i) => ({
    prescricaoId: p.id,
    ordem: i + 1,
    nome: p.medicamentoNome,
    apresentacao: p.apresentacao,
    via: p.via,
    frase: fraseDaPrescricao(p),
    instrucoes: p.instrucoes,
    ...classeDoItem(p),
  }))
  const folhas = [...new Set(itens.filter((i) => !i.foraDoPdf).map((i) => i.classe))].filter(
    (c): c is 'SIMPLES' | 'CONTROLE_ESPECIAL' => c === 'SIMPLES' || c === 'CONTROLE_ESPECIAL',
  )
  return {
    id,
    atendimentoId: r.id,
    status: 'RASCUNHO',
    folhas,
    emitidaEm: null,
    validaAte: null,
    codigoVerificador: null,
    prescritorNome: null,
    prescritorCrmv: null,
    resumoDoConteudo: prescricoes.map((p) => p.medicamentoNome).join(', '),
    itens,
    foraDoPdf: itens
      .filter((i) => i.foraDoPdf && i.motivo)
      .map((i) => ({
        prescricaoId: i.prescricaoId,
        motivo: i.motivo as NonNullable<ItemDaReceita['motivo']>,
        instrucao: INSTRUCAO_FORA_DO_PDF[i.motivo as NonNullable<ItemDaReceita['motivo']>],
      })),
    exigeNotificacaoOficial: itens
      .filter((i) => i.motivo === 'EXIGE_NOTIFICACAO_OFICIAL')
      .map((i) => i.nome),
    cancelamento: null,
    pdfDisponivel: false,
    versaoDoAtendimento: r.versao,
  }
}

/** Assina a receita: quem assina é quem está logado (a dona) ou o responsável do atendimento. */
export function assinar(r: RegistroDoAtendimento, receita: Receita, quem: string, em: string) {
  receita.status = 'ASSINADA'
  receita.emitidaEm = em
  receita.validaAte = receita.folhas.includes('CONTROLE_ESPECIAL')
    ? somarDias(em.slice(0, 10), 30)
    : null
  receita.codigoVerificador = codigoVerificador(receita.id)
  receita.prescritorNome = nomeDoProfissional(quem)
  receita.prescritorCrmv = crmvDe(quem)
  receita.pdfDisponivel = true
  receita.versaoDoAtendimento = r.versao
  for (const p of r.prescricoes) {
    if (p.receitaId === receita.id) p.receitaStatus = 'ASSINADA'
  }
}

/* ----------------------------------------------------------------------------- os atos */

function atosDe(r: RegistroDoAtendimento, caso: Caso, a: AgendamentoDaDemo): Ato[] {
  return (caso.atos ?? []).map((ato, i) => ({
    id: `${r.id}-ato-${i + 1}`,
    kind: ato.kind,
    descricao: ato.descricao,
    via: ato.via ?? null,
    doseTexto: ato.dose ?? null,
    realizadoEm: somarMinutos(a.iniciadoEm ?? a.inicio, 8 + i * 6),
    profissionalNome: nomeDoProfissional(r.profissionalId),
    origem: 'CLINICA',
    observacao: ato.obs ?? null,
    anuladoEm: null,
    pacienteId: r.pacienteId,
    atendimentoId: r.id,
    medicamentoId: ato.med ?? null,
    motivoAnulacao: null,
    versaoDoAtendimento: null,
  }))
}

/* --------------------------------------------------------------------- os documentos */

function documentoBase(
  id: string,
  pacienteId: string,
  atendimentoId: string | null,
  tipo: Documento['tipo'],
  conteudo: Record<string, unknown>,
  criadoEm: string,
): Documento {
  return {
    id,
    tipo,
    status: 'RASCUNHO',
    pacienteId,
    atendimentoId,
    internacaoId: null,
    idioma: 'pt-BR',
    conteudo,
    emitidoEm: null,
    codigoVerificador: null,
    autorNome: null,
    autorCrmv: null,
    resumoDoConteudo: resumoDoDocumento(tipo, conteudo),
    foraDoHashDoAtendimento: false,
    anulacao: null,
    pdfDisponivel: false,
    aceiteStatus: 'NAO_SE_APLICA',
    aceitePeloApp: false,
    salvoNoApp: false,
    criadoEm,
    atualizadoEm: criadoEm,
  }
}

export function resumoDoDocumento(tipo: Documento['tipo'], conteudo: Record<string, unknown>) {
  if (Array.isArray(conteudo.exames)) {
    return (conteudo.exames as { nome?: string }[])
      .map((e) => e.nome)
      .filter(Boolean)
      .join(', ')
  }
  const texto = [
    conteudo.objeto,
    conteudo.motivo,
    conteudo.finalidade,
    conteudo.causaProvavel,
    conteudo.destino,
    conteudo.observacoes,
  ].find((v) => typeof v === 'string' && v)
  return typeof texto === 'string' ? texto.slice(0, 140) : null
}

export function emitir(doc: Documento, quem: string, em: string, aceitePeloApp = false) {
  doc.status = 'EMITIDO'
  doc.emitidoEm = em
  doc.codigoVerificador = codigoVerificador(doc.id)
  doc.autorNome = nomeDoProfissional(quem)
  doc.autorCrmv = crmvDe(quem)
  doc.pdfDisponivel = true
  doc.atualizadoEm = em
  doc.resumoDoConteudo = resumoDoDocumento(doc.tipo, doc.conteudo)
  if (doc.tipo.startsWith('TERMO_')) {
    doc.aceiteStatus = 'PENDENTE'
    doc.aceitePeloApp = aceitePeloApp
  }
}

function documentosDoCaso(r: RegistroDoAtendimento, caso: Caso, s: Sorteio, emitidos: boolean) {
  const docs: Documento[] = []
  const em = somarMinutos(r.realizadoEm, 20)
  const quem = r.profissionalId
  /* O pedido de exame sai na maioria das vezes; no rascunho em curso, sempre (é o que se vê). */
  if (caso.exames?.length && (!emitidos || s.chance(0.6))) {
    const doc = documentoBase(
      `${r.id}-doc-1`,
      r.pacienteId,
      r.id,
      'PEDIDO_EXAME',
      {
        exames: caso.exames.map((nome) => ({ nome })),
        indicacao: caso.diagnosticos.length
          ? `Investigação de ${diagnosticoDoCatalogo(caso.diagnosticos[0]?.[1] ?? '')?.descricao.toLowerCase() ?? 'queixa clínica'}.`
          : 'Avaliação preventiva.',
        orientacoesDeColeta: 'Jejum de 8 horas de comida; água à vontade.',
      },
      em,
    )
    if (emitidos) emitir(doc, quem, em)
    docs.push(doc)
  }
  if (caso.termo) {
    const antes = somarMinutos(r.realizadoEm, -s.inteiro(40, 80))
    const doc = documentoBase(
      `${r.id}-doc-2`,
      r.pacienteId,
      r.id,
      'TERMO_CONSENTIMENTO',
      { ...caso.termo },
      antes,
    )
    emitir(doc, quem, antes)
    doc.aceiteStatus = 'ACEITO'
    docs.push(doc)
  }
  if (
    emitidos &&
    r.tipo === 'VACINA' &&
    ['CACHORRO', 'GATO'].includes(pacienteDe(r.pacienteId).especie) &&
    s.chance(0.3)
  ) {
    const doc = documentoBase(
      `${r.id}-doc-3`,
      r.pacienteId,
      r.id,
      'COMPROVANTE_VACINACAO',
      {
        observacoes:
          'Vacinação conforme o protocolo da clínica; próxima dose indicada na carteira do app.',
      },
      em,
    )
    emitir(doc, quem, em)
    docs.push(doc)
  }
  if (
    emitidos &&
    r.tipo === 'CONSULTA' &&
    caso.diagnosticos.length === 0 &&
    pacienteDe(r.pacienteId).especie === 'CACHORRO' &&
    s.chance(0.25)
  ) {
    const doc = documentoBase(
      `${r.id}-doc-4`,
      r.pacienteId,
      r.id,
      'ATESTADO_SAUDE',
      {
        dataDoExame: r.dataDoAtendimento,
        semAlteracoes: true,
        recomendacoes: 'Manter vacinação e controle de parasitas em dia.',
        finalidade: 'Hospedagem em hotel para cães',
      },
      em,
    )
    emitir(doc, quem, em)
    docs.push(doc)
  }
  for (const doc of docs) DOCUMENTOS.set(doc.id, doc)
  return docs
}

/** Os termos das cirurgias da semana: emitidos antes, com o aceite pelo app ou no balcão. */
let termosMontados = false
function montarTermosDaSemana() {
  if (termosMontados) return
  termosMontados = true
  const dia = hoje()
  for (const a of AGENDAMENTOS) {
    if (kindDe(a) !== 'CIRURGIA' || a.status === 'CANCELADO' || a.atendimentoId) continue
    const data = a.inicio.slice(0, 10)
    if (data < dia || diasEntre(dia, data) > 7) continue
    const p = paciente(a.pacienteId)
    if (!p) continue
    const caso = casoDe(a)
    if (!caso.termo) continue
    const s = criarSorteio(`prontuario:termo:${a.id}`)
    const em = instante(
      somarDias(data, -s.inteiro(1, 3)),
      `${s.inteiro(9, 17)}:${s.escolher(['05', '20', '35', '50'])}`,
    )
    const emitidoAntes = Date.parse(em) < agora().getTime() ? em : agoraIso()
    const doc = documentoBase(
      `demo-doc-termo-${a.id}`,
      p.id,
      null,
      'TERMO_CONSENTIMENTO',
      { ...caso.termo },
      emitidoAntes,
    )
    emitir(doc, a.profissionalId, emitidoAntes, p.noApp)
    if (!p.noApp && s.chance(0.5)) doc.aceiteStatus = 'ACEITO'
    DOCUMENTOS.set(doc.id, doc)
  }
}

/* ---------------------------------------------------------------------------- os laudos */

function laudosDe(r: RegistroDoAtendimento, caso: Caso, s: Sorteio, liberados: boolean): Laudo[] {
  const resultado = somarDias(r.dataDoAtendimento, s.inteiro(1, 2))
  if (resultado > hoje()) return []
  return (caso.laudos ?? []).map(([nome], i) => {
    const e = exameDoCatalogo(nome)
    const criadoEm = instante(
      resultado,
      `${s.inteiro(14, 17)}:${String(s.inteiro(0, 59)).padStart(2, '0')}`,
    )
    return {
      id: `${r.id}-laudo-${i + 1}`,
      atendimentoId: r.id,
      tipoExameId: e?.id ?? null,
      tipoExameNome: e?.nome ?? nome,
      grupoExame: e?.grupo ?? null,
      dataDoResultado: resultado,
      mimetype: 'application/pdf',
      tamanho: s.inteiro(118_000, 420_000),
      ordem: i + 1,
      criadoEm,
      liberadoEm: liberados ? somarMinutos(criadoEm, s.inteiro(20, 180)) : null,
      visivelAoResponsavel: liberados,
      removido: false,
    }
  })
}

/* --------------------------------------------------------------------- a montagem */

function edicoesDe(r: RegistroDoAtendimento, secoes: Secao[], inicio: string) {
  const nome = nomeDoProfissional(r.profissionalId)
  return secoes.map((secao, i) => ({
    secao,
    profissionalId: r.profissionalId,
    profissionalNome: nome,
    em: somarMinutos(inicio, 4 + i * 5),
  }))
}

function autorDe(
  papel: Atendimento['autores'][number]['papel'],
  profissionalId: string,
  em: string,
  secoes: Secao[] = [],
): Atendimento['autores'][number] {
  const p = profissional(profissionalId)
  return {
    papel,
    profissionalId,
    nome: p?.nome ?? 'Equipe da clínica',
    conselho: p?.conselho ?? 'NENHUM',
    registro: p?.registro ?? null,
    uf: p?.uf ?? null,
    seloValidoNoAto: true,
    secoes,
    em,
  }
}

function retratoDe(p: PacienteDaDemo, peso: number | null): Atendimento['retrato'] {
  return {
    nome: p.nome,
    especie: p.especie,
    especieOutra: p.especieOutra,
    raca: p.raca,
    nascimento: p.nascimento,
    pesoKg: peso,
  }
}

function registroVazio(
  id: string,
  p: PacienteDaDemo,
  profissionalId: string,
  tipo: Tipo,
  abertoEm: string,
  agendamentoId: string | null,
): RegistroDoAtendimento {
  return {
    id,
    pacienteId: p.id,
    agendamentoId,
    profissionalId,
    status: 'RASCUNHO',
    tipo,
    versao: 1,
    abertoEm,
    realizadoEm: abertoEm,
    dataDoAtendimento: abertoEm.slice(0, 10),
    pesoKg: p.pesoKg,
    anamnese: anamneseVazia(),
    exame: exameVazio(),
    diagnostico: diagnosticoVazio(),
    conduta: condutaVazia(),
    edicoes: [],
    autores: [autorDe('RESPONSAVEL', profissionalId, abertoEm)],
    adendos: [],
    atos: [],
    resumo: { liberadoEm: null, publicado: false, motivoNaoPublicado: null, consultaId: null },
    preConsulta: null,
    pesoDeCasa: null,
    retrato: null,
    finalizadoEm: null,
    anuladoEm: null,
    motivoAnulacao: null,
    retificaAtendimentoId: null,
    nuncaAberto: true,
    lock: null,
    prescricoes: [],
    receitas: [],
    laudos: [],
    queixa: null,
  }
}

function construir(a: AgendamentoDaDemo, id: string): RegistroDoAtendimento {
  const p = pacienteDe(a.pacienteId)
  const kind = kindDe(a)
  const estado = estadoInicial(a, id)
  const s = criarSorteio(`prontuario:atendimento:${a.id}`)
  const abertoEm = a.iniciadoEm ?? a.inicio
  const r = registroVazio(id, p, a.profissionalId, kind, abertoEm, a.id)
  const caso = casoDe(a)
  const peso = pesoNoDia(p, a.inicio.slice(0, 10), s)
  r.pesoKg = peso
  r.queixa = caso.queixa

  const noApp = p.noApp && (a.origem === 'APP' || s.chance(0.3))
  const recente = diasEntre(a.inicio.slice(0, 10), hoje()) <= 30
  if (
    noApp &&
    recente &&
    (kind === 'CONSULTA' || kind === 'RETORNO') &&
    (estado !== 'FINALIZADO' || s.chance(0.6))
  ) {
    r.preConsulta = preConsultaDe(a, caso, peso, s)
    r.pesoDeCasa = r.preConsulta?.pesoDeCasa?.pesoKg ?? null
  }

  if (estado === 'NOVO') {
    r.versao = 1
    return r
  }

  r.nuncaAberto = false
  const secoesFeitas: Secao[] = []
  const minutos = Math.max(0, Math.round((agora().getTime() - Date.parse(abertoEm)) / 60_000))
  const emCurso = estado === 'EM_CURSO'
  const fazAnamnese = !emCurso || minutos >= 3
  const fazExame = !emCurso || minutos >= 8
  const fazDiagnostico = !emCurso || minutos >= 20
  const fazConduta = !emCurso

  if (fazAnamnese) {
    r.anamnese = anamneseDe(p, caso, s, kind)
    if (r.preConsulta) r.anamnese.camposDaPreConsulta = ['QUEIXA_PRINCIPAL', 'APETITE']
    secoesFeitas.push('ANAMNESE')
  }
  if (fazExame) {
    r.exame = exameDe(p, caso, kind, peso, s)
    secoesFeitas.push('EXAME_FISICO')
  }
  if (fazDiagnostico) {
    r.diagnostico = diagnosticoDe(id, caso)
    secoesFeitas.push('DIAGNOSTICO')
  }
  if (fazConduta) {
    r.conduta = condutaDe(p, caso, estado === 'FINALIZADO' || estado === 'ANULADO' ? a : null)
    /* O retorno que a agenda lista como pendente: o mesmo prazo, sem horário marcado. */
    const pendente = RETORNOS_PENDENTES.find((x) => x.atendimentoId === id)
    if (pendente) {
      r.conduta.retornoEmDias = pendente.emDias
      r.conduta.retornoTipoId = pendente.tipoId
      r.conduta.retornoAgendamentoId = null
    }
    secoesFeitas.push('CONDUTA')
  }

  /* Os atos acontecem durante a consulta; no rascunho em curso, só depois do exame. */
  if (fazExame) r.atos = atosDe(r, caso, a)

  const fechado = estado === 'FINALIZADO' || estado === 'ANULADO'
  const prescreve = (caso.prescricoes ?? []).length > 0 && (fechado || estado === 'ESQUECIDO')
  if (prescreve) {
    r.prescricoes = (caso.prescricoes ?? [])
      .map((item, i) => montarPrescricao(r, `${id}-presc-${i + 1}`, i + 1, entradaDoCaso(item)))
      .filter((res): res is Extract<ResultadoDaPrescricao, { ok: true }> => res.ok)
      .map((res) => res.prescricao)
    secoesFeitas.push('PRESCRICAO')
  }

  r.edicoes = edicoesDe(r, secoesFeitas, abertoEm)
  r.versao = 2 + secoesFeitas.length * 2 + r.atos.length + r.prescricoes.length

  if (fechado) {
    const fim = finalizadoEmDe(a)
    r.status = 'FINALIZADO'
    r.finalizadoEm = fim
    r.retrato = retratoDe(p, peso)
    r.resumo = resumoInicial(a, p)
    r.autores = [
      autorDe('RESPONSAVEL', a.profissionalId, abertoEm, secoesFeitas),
      autorDe('FINALIZOU', a.profissionalId, fim),
    ]
    if (r.prescricoes.length) {
      const receita = montarReceita(r, `${id}-rec-1`, r.prescricoes)
      for (const pr of r.prescricoes) {
        pr.receitaId = receita.id
        pr.receitaStatus = 'RASCUNHO'
        pr.editavel = false
      }
      assinar(r, receita, a.profissionalId, somarMinutos(fim, -2))
      r.receitas = [receita]
    }
    documentosDoCaso(r, caso, s, true)
    r.laudos = laudosDe(r, caso, s, r.resumo.publicado)
    if (s.chance(0.06) && diasEntre(a.inicio.slice(0, 10), hoje()) > 1) {
      r.adendos.push({
        id: `${id}-adendo-1`,
        texto: 'Responsável ligou no dia seguinte: paciente comendo bem e sem novas queixas.',
        paraOResponsavel: false,
        autor: autorDoAdendo(a.profissionalId),
        em: somarMinutos(fim, 60 * 20),
      })
    }
    if (estado === 'ANULADO') {
      r.status = 'ANULADO'
      r.anuladoEm = anuladoEmDe(a)
      r.motivoAnulacao = s.escolher([
        'Registro aberto no paciente errado: o atendimento foi do outro animal da mesma família.',
        'Atendimento registrado em duplicidade; o registro válido é o do mesmo horário.',
      ])
      r.autores.push(autorDe('ANULOU', MARINA, r.anuladoEm))
      r.resumo = { ...r.resumo, publicado: false, motivoNaoPublicado: 'ANULADO' }
      for (const receita of r.receitas) {
        receita.status = 'CANCELADA'
        receita.cancelamento = {
          em: r.anuladoEm,
          origem: 'ATENDIMENTO_ANULADO',
          motivo: r.motivoAnulacao,
        }
      }
    }
  } else if (estado === 'ESQUECIDO') {
    /*
     * Tudo escrito; falta finalizar. Cada um parou em um ponto: o da Marina tem a receita por
     * assinar; o do Rafael, a prescrição sem receita; os outros, a receita assinada (só finalizar).
     */
    if (r.prescricoes.length && a.profissionalId !== 'demo-prof-rafael') {
      const receita = montarReceita(r, `${id}-rec-1`, r.prescricoes)
      for (const pr of r.prescricoes) {
        pr.receitaId = receita.id
        pr.receitaStatus = 'RASCUNHO'
      }
      if (a.profissionalId !== MARINA) {
        assinar(r, receita, a.profissionalId, somarMinutos(a.fim, s.inteiro(2, 9)))
      }
      r.receitas = [receita]
    }
    documentosDoCaso(r, caso, s, false)
  } else if (emCurso && caso.exames?.length && fazDiagnostico) {
    documentosDoCaso(r, caso, s, false)
  }

  return r
}

function autorDoAdendo(profissionalId: string): Adendo['autor'] {
  const p = profissional(profissionalId)
  return {
    profissionalId,
    nome: p?.nome ?? 'Equipe da clínica',
    conselho: p?.conselho ?? 'NENHUM',
    registro: p?.registro ?? null,
    uf: p?.uf ?? null,
    seloValidoNoAto: true,
  }
}

/** O registro do atendimento (montado na primeira leitura). `null` quando não existe. */
export function registroDoAtendimento(id: string): RegistroDoAtendimento | null {
  const guardado = CACHE.get(id)
  if (guardado) return guardado
  const daAgenda = agendamentoDoAtendimento(id)
  if (DESCARTADOS.has(id) && !(daAgenda && reiniciado(id, daAgenda))) return null
  let a = daAgenda
  if (!a && id.startsWith('demo-atd-')) {
    const doId = agendamento(id.slice('demo-atd-'.length))
    if (
      doId &&
      !doId.atendimentoId &&
      ['EM_ATENDIMENTO', 'AGUARDANDO', 'FINALIZADO'].includes(doId.status)
    ) {
      doId.atendimentoId = id
      a = doId
    }
  }
  if (!a) return null
  const r = construir(a, id)
  CACHE.set(id, r)
  return r
}

/** O avulso (fora da agenda), da ficha do paciente ou da repetição de receita. */
export function abrirAvulso(pacienteId: string, profissionalId: string | null, tipo: Tipo | null) {
  const p = paciente(pacienteId)
  if (!p) return null
  const id = novoId('demo-atd-avulso')
  const r = registroVazio(id, p, profissionalId ?? MARINA, tipo ?? 'CONSULTA', agoraIso(), null)
  CACHE.set(id, r)
  return r
}

/* ----------------------------------------------------------------------- o atendimento DTO */

/** O que falta para finalizar (os códigos do 422 `ATENDIMENTO_INCOMPLETO`). */
export function faltamParaFinalizar(r: RegistroDoAtendimento): string[] {
  if (r.status !== 'RASCUNHO') return []
  const faltam: string[] = []
  if (!r.anamnese.queixaPrincipal?.trim()) faltam.push('QUEIXA')
  if (!r.diagnostico.semDiagnostico && !r.diagnostico.itens.length) faltam.push('DIAGNOSTICO')
  const c = r.conduta
  if (!c.orientacoes?.trim() && !c.sinaisDeAlerta?.trim() && !c.observacaoInterna?.trim()) {
    faltam.push('CONDUTA')
  }
  if (r.prescricoes.some((p) => !p.receitaId)) faltam.push('PRESCRICAO_SEM_RECEITA')
  if (r.receitas.some((rec) => rec.status === 'RASCUNHO')) faltam.push('RECEITA_EM_RASCUNHO')
  return faltam
}

function lockValido(r: RegistroDoAtendimento) {
  return r.lock && Date.parse(r.lock.ate) > agora().getTime() ? r.lock : null
}

function lockDto(lock: Lock | null): Atendimento['lock'] {
  return lock
    ? {
        dispositivoRotulo: lock.rotulo,
        profissionalNome: lock.profissionalNome,
        desde: lock.desde,
        ate: lock.ate,
      }
    : null
}

export function estadoDaEdicao(r: RegistroDoAtendimento, dispositivoId: string | null) {
  if (r.status !== 'RASCUNHO') {
    return {
      somenteLeitura: true,
      motivoSomenteLeitura: r.status === 'ANULADO' ? ('ANULADO' as const) : ('FINALIZADO' as const),
      lock: null,
    }
  }
  const lock = lockValido(r)
  if (lock && lock.dispositivoId !== dispositivoId) {
    return {
      somenteLeitura: true,
      motivoSomenteLeitura: 'OUTRO_DISPOSITIVO' as const,
      lock: lockDto(lock),
    }
  }
  return { somenteLeitura: false, motivoSomenteLeitura: null, lock: lockDto(lock) }
}

/** Toma (ou renova) o lock de 10 minutos para a aba. */
export function tomarLock(
  r: RegistroDoAtendimento,
  dispositivoId: string,
  rotulo: string | null,
  forcar = false,
) {
  const atual = lockValido(r)
  if (atual && atual.dispositivoId !== dispositivoId && !forcar) return false
  const pessoa = pessoaDaEquipe(USUARIO_ID)
  r.lock = {
    dispositivoId,
    rotulo: rotulo ?? atual?.rotulo ?? null,
    profissionalNome: pessoa?.nome ?? null,
    desde: atual?.dispositivoId === dispositivoId ? atual.desde : agoraIso(),
    ate: somarMinutos(agoraIso(), 10),
  }
  r.nuncaAberto = false
  return true
}

function consultaAnteriorDe(r: RegistroDoAtendimento): Atendimento['consultaAnterior'] {
  const anteriores = agendamentosDoPaciente(r.pacienteId).filter(
    (b) =>
      b.atendimentoId &&
      b.atendimentoId !== r.id &&
      b.inicio < r.realizadoEm &&
      b.status === 'FINALIZADO',
  )
  for (let i = anteriores.length - 1; i >= 0; i--) {
    const b = anteriores[i] as AgendamentoDaDemo
    const id = b.atendimentoId as string
    const guardado = CACHE.get(id)
    const status = guardado?.status ?? (DA_BASE.has(id) ? estadoInicial(b, id) : 'NOVO')
    if (status !== 'FINALIZADO') continue
    const caso = casoDe(b)
    const p = pacienteDe(b.pacienteId)
    const diag = caso.diagnosticos.find(([kind]) => kind !== 'DIFERENCIAL')
    return {
      id,
      data: b.inicio.slice(0, 10),
      queixa: guardado?.anamnese.queixaPrincipal ?? caso.queixa,
      diagnosticoPrincipal: diag ? (diagnosticoDoCatalogo(diag[1])?.descricao ?? null) : null,
      pesoKg:
        guardado?.pesoKg ??
        pesoNoDia(p, b.inicio.slice(0, 10), criarSorteio(`prontuario:atendimento:${b.id}`)),
    }
  }
  return null
}

export function atendimentoDto(
  r: RegistroDoAtendimento,
  dispositivoId: string | null,
): Atendimento {
  const p = pacienteDe(r.pacienteId)
  const edicao = estadoDaEdicao(r, dispositivoId)
  const etaria = faixaEtariaDe(p.nascimento, p.especie, r.dataDoAtendimento)
  return {
    id: r.id,
    status: r.status,
    versao: r.versao,
    tipo: r.tipo,
    agendamentoId: r.agendamentoId,
    abertoEm: r.abertoEm,
    realizadoEm: r.realizadoEm,
    dataDoAtendimento: r.dataDoAtendimento,
    paciente: {
      id: p.id,
      nome: p.nome,
      especie: p.especie,
      especieOutra: p.especieOutra,
      raca: p.raca,
      nascimento: p.nascimento,
      pesoKg: p.pesoKg,
      ativo: p.ativo,
      obitoEm: p.obitoEm,
    },
    retrato: r.retrato,
    profissional: profissionalDto(r.profissionalId),
    somenteLeitura: edicao.somenteLeitura,
    motivoSomenteLeitura: edicao.motivoSomenteLeitura,
    lock: edicao.lock,
    anamnese: r.anamnese,
    exameFisico: {
      vitais: vitaisDto(r),
      mucosas: r.exame.mucosas,
      hidratacao: r.exame.hidratacao,
      observacao: r.exame.observacao,
      sistemas: r.exame.sistemas,
      porte: p.porte,
      faixaEtaria: etaria,
    },
    diagnostico: r.diagnostico,
    conduta: r.conduta,
    edicoes: r.edicoes,
    autores: r.autores,
    adendos: { itens: r.adendos.slice(-5), total: r.adendos.length },
    atos: {
      itens: r.atos.map((ato) => ({
        id: ato.id,
        kind: ato.kind,
        descricao: ato.descricao,
        via: ato.via,
        doseTexto: ato.doseTexto,
        realizadoEm: ato.realizadoEm,
        profissionalNome: ato.profissionalNome,
        origem: ato.origem,
        observacao: ato.observacao,
        anuladoEm: ato.anuladoEm,
      })),
      total: r.atos.length,
    },
    resumo: r.resumo,
    consultaAnterior: consultaAnteriorDe(r),
    preConsulta: r.preConsulta,
    pesoDeCasa: r.pesoDeCasa,
    faltamParaFinalizar: faltamParaFinalizar(r),
    finalizadoEm: r.finalizadoEm,
    anuladoEm: r.anuladoEm,
    motivoAnulacao: r.motivoAnulacao,
    retificaAtendimentoId: r.retificaAtendimentoId,
  }
}

/** Grava uma seção do PATCH (campo ausente fica, `null` limpa, lista presente substitui). */
export function gravarSecao(
  r: RegistroDoAtendimento,
  secao: Secao,
  dados: Record<string, unknown>,
) {
  const antes = JSON.stringify([r.anamnese, r.exame, r.diagnostico, r.conduta])
  const aplicar = <T extends object>(alvo: T) => {
    for (const [chave, valor] of Object.entries(dados)) {
      if (valor !== undefined && chave in alvo) (alvo as Record<string, unknown>)[chave] = valor
    }
  }
  switch (secao) {
    case 'ANAMNESE':
      aplicar(r.anamnese)
      break
    case 'EXAME_FISICO': {
      const { vitais, ...resto } = dados as { vitais?: Partial<Vitais> }
      if (vitais) {
        for (const chave of CHAVES) {
          const medida = vitais[chave]
          if (medida)
            r.exame.vitais[chave] = {
              valor: medida.valor ?? null,
              naoAferido: Boolean(medida.naoAferido),
            }
        }
      }
      for (const [chave, valor] of Object.entries(resto)) {
        if (valor !== undefined && chave in r.exame)
          (r.exame as Record<string, unknown>)[chave] = valor
      }
      break
    }
    case 'DIAGNOSTICO': {
      const d = dados as {
        itens?: Array<{
          id?: string
          kind: Atendimento['diagnostico']['itens'][number]['kind']
          codigo?: string | null
          descricao: string
        }>
        semDiagnostico?: boolean
        antecedentes?: Array<{
          id?: string
          kind: Atendimento['diagnostico']['antecedentes'][number]['kind']
          descricao: string
          quando?: string | null
        }>
      }
      if (d.itens) {
        r.diagnostico.itens = d.itens.map((item) => ({
          id: item.id ?? novoId(`${r.id}-diag`),
          kind: item.kind,
          codigo: item.codigo ?? null,
          descricao: item.descricao,
        }))
      }
      if (typeof d.semDiagnostico === 'boolean') r.diagnostico.semDiagnostico = d.semDiagnostico
      if (d.antecedentes) {
        r.diagnostico.antecedentes = d.antecedentes.map((item) => ({
          id: item.id ?? novoId(`${r.id}-antecedente`),
          kind: item.kind,
          descricao: item.descricao,
          quando: item.quando ?? null,
        }))
      }
      break
    }
    case 'CONDUTA':
      aplicar(r.conduta)
      break
  }
  const mudou = antes !== JSON.stringify([r.anamnese, r.exame, r.diagnostico, r.conduta])
  if (mudou) {
    r.versao += 1
    marcarEdicao(r, secao)
  }
  r.nuncaAberto = false
  return mudou
}

export function marcarEdicao(r: RegistroDoAtendimento, secao: Secao) {
  const quem = profissional(MARINA)
  r.edicoes = r.edicoes.filter((e) => e.secao !== secao)
  r.edicoes.push({
    secao,
    profissionalId: MARINA,
    profissionalNome: quem?.nome ?? '',
    em: agoraIso(),
  })
}

export function temConteudo(r: RegistroDoAtendimento) {
  return (
    Boolean(r.anamnese.queixaPrincipal || r.anamnese.historia) ||
    CHAVES.some((c) => r.exame.vitais[c].valor !== null) ||
    r.diagnostico.itens.length > 0 ||
    Boolean(r.conduta.orientacoes) ||
    r.prescricoes.length > 0 ||
    r.atos.length > 0
  )
}

export function descartar(r: RegistroDoAtendimento) {
  CACHE.delete(r.id)
  DESCARTADOS.add(r.id)
  const a = r.agendamentoId ? agendamento(r.agendamentoId) : null
  if (a) {
    a.status = 'AGUARDANDO'
    a.iniciadoEm = null
    a.atendimentoId = null
    a.atualizadoEm = agoraIso()
  }
  return a ? [a.id] : []
}

export function finalizar(r: RegistroDoAtendimento) {
  const agoraMesmo = agoraIso()
  const p = pacienteDe(r.pacienteId)
  r.status = 'FINALIZADO'
  r.finalizadoEm = agoraMesmo
  r.versao += 1
  r.lock = null
  r.retrato = retratoDe(p, r.exame.vitais.peso.valor ?? r.pesoKg)
  const secoes = [...new Set(r.edicoes.map((e) => e.secao))]
  r.autores = [
    ...r.autores.filter((a) => a.papel === 'RESPONSAVEL').map((a) => ({ ...a, secoes })),
    autorDe('FINALIZOU', MARINA, agoraMesmo),
  ]
  if (!p.noApp)
    r.resumo = {
      liberadoEm: null,
      publicado: false,
      motivoNaoPublicado: 'SEM_VINCULO',
      consultaId: null,
    }
  for (const pr of r.prescricoes) pr.editavel = false
  for (const doc of DOCUMENTOS.values()) {
    if (doc.atendimentoId === r.id && doc.status === 'RASCUNHO') doc.foraDoHashDoAtendimento = true
  }
  const a = r.agendamentoId ? agendamento(r.agendamentoId) : null
  if (a && a.status === 'EM_ATENDIMENTO') {
    a.status = 'FINALIZADO'
    a.finalizadoEm = agoraMesmo
    a.atualizadoEm = agoraMesmo
  }
}

export function anular(r: RegistroDoAtendimento, motivo: string) {
  const em = agoraIso()
  r.status = 'ANULADO'
  r.anuladoEm = em
  r.motivoAnulacao = motivo
  r.versao += 1
  r.lock = null
  r.autores.push(autorDe('ANULOU', MARINA, em))
  r.resumo = { ...r.resumo, publicado: false, motivoNaoPublicado: 'ANULADO' }
  for (const receita of r.receitas) {
    if (receita.status === 'CANCELADA') continue
    receita.status = 'CANCELADA'
    receita.cancelamento = { em, origem: 'ATENDIMENTO_ANULADO', motivo }
  }
}

export function liberarResumo(r: RegistroDoAtendimento) {
  const p = pacienteDe(r.pacienteId)
  if (r.status === 'ANULADO') {
    r.resumo = { ...r.resumo, publicado: false, motivoNaoPublicado: 'ANULADO' }
  } else if (!p.ativo || p.obitoEm) {
    r.resumo = { ...r.resumo, publicado: false, motivoNaoPublicado: 'OBITO' }
  } else if (!p.noApp) {
    r.resumo = { ...r.resumo, publicado: false, motivoNaoPublicado: 'SEM_VINCULO' }
  } else if (!r.resumo.publicado) {
    r.resumo = {
      liberadoEm: agoraIso(),
      publicado: true,
      motivoNaoPublicado: null,
      consultaId: `demo-consulta-${r.id}`,
    }
    for (const laudo of r.laudos) {
      if (!laudo.removido && !laudo.visivelAoResponsavel) {
        laudo.visivelAoResponsavel = true
        laudo.liberadoEm = r.resumo.liberadoEm
      }
    }
  }
  return r.resumo
}

export function novoAdendo(
  r: RegistroDoAtendimento,
  texto: string,
  paraOResponsavel: boolean,
): Adendo {
  const adendo: Adendo = {
    id: novoId(`${r.id}-adendo`),
    texto,
    paraOResponsavel,
    autor: autorDoAdendo(MARINA),
    em: agoraIso(),
  }
  r.adendos.push(adendo)
  return adendo
}

export function novoAto(
  r: RegistroDoAtendimento | null,
  pacienteId: string,
  corpo: {
    kind: Ato['kind']
    medicamentoId?: string
    descricao: string
    via?: Ato['via']
    doseTexto?: string | null
    realizadoEm: string
    observacao?: string | null
    origem?: Ato['origem']
  },
): Ato {
  const ato: Ato = {
    id: r ? `${r.id}-ato-${r.atos.length + 1}` : novoId('demo-ato-avulso'),
    kind: corpo.kind,
    descricao: corpo.descricao,
    via: corpo.via ?? null,
    doseTexto: corpo.doseTexto ?? null,
    realizadoEm: corpo.realizadoEm || agoraIso(),
    profissionalNome: nomeDoProfissional(MARINA),
    origem: corpo.origem ?? 'CLINICA',
    observacao: corpo.observacao ?? null,
    anuladoEm: null,
    pacienteId,
    atendimentoId: r?.id ?? null,
    medicamentoId: corpo.medicamentoId ?? null,
    motivoAnulacao: null,
    versaoDoAtendimento: null,
  }
  if (r) {
    r.versao += 1
    ato.versaoDoAtendimento = r.versao
    r.atos.push(ato)
    r.nuncaAberto = false
  } else {
    ATOS_AVULSOS.push(ato)
  }
  return ato
}

/** O ato pelo id: o do atendimento (`<atendimento>-ato-<n>`) ou o avulso. */
export function atoPorId(id: string): { ato: Ato; registro: RegistroDoAtendimento | null } | null {
  const avulso = ATOS_AVULSOS.find((a) => a.id === id)
  if (avulso) return { ato: avulso, registro: null }
  const dono = donoDoId(id, 'ato')
  const r = dono ? registroDoAtendimento(dono) : null
  const ato = r?.atos.find((a) => a.id === id)
  return ato && r ? { ato, registro: r } : null
}

/** O atendimento de um id filho: `demo-atd-...-rec-1` → `demo-atd-...`. */
export function donoDoId(id: string, marca: 'rec' | 'presc' | 'doc' | 'laudo' | 'ato') {
  const i = id.lastIndexOf(`-${marca}-`)
  return i > 0 ? id.slice(0, i) : null
}

/* ----------------------------------------------------------------- receitas e documentos */

export function receitaPorId(id: string) {
  const dono = donoDoId(id, 'rec')
  const r = dono ? registroDoAtendimento(dono) : null
  const receita = r?.receitas.find((rec) => rec.id === id)
  return receita && r ? { receita, registro: r } : null
}

export function documentoPorId(id: string): Documento | null {
  montarTermosDaSemana()
  const guardado = DOCUMENTOS.get(id)
  if (guardado) return guardado
  const dono = donoDoId(id, 'doc')
  if (dono) registroDoAtendimento(dono)
  return DOCUMENTOS.get(id) ?? null
}

export function guardarDocumento(doc: Documento) {
  DOCUMENTOS.set(doc.id, doc)
}

export function esquecerDocumento(id: string) {
  DOCUMENTOS.delete(id)
}

export function novoDocumento(
  tipo: Documento['tipo'],
  pacienteId: string,
  atendimentoId: string | null,
  conteudo: Record<string, unknown>,
  idioma: Documento['idioma'] = 'pt-BR',
) {
  const doc = documentoBase(
    novoId('demo-doc'),
    pacienteId,
    atendimentoId,
    tipo,
    conteudo,
    agoraIso(),
  )
  doc.idioma = idioma
  DOCUMENTOS.set(doc.id, doc)
  return doc
}

/** Os documentos do paciente (montando os atendimentos dele), do mais novo. */
export function documentosDoPaciente(pacienteId: string, atendimentoId: string | null) {
  montarTermosDaSemana()
  if (atendimentoId) registroDoAtendimento(atendimentoId)
  else for (const id of idsDoPaciente(pacienteId)) registroDoAtendimento(id)
  return [...DOCUMENTOS.values()]
    .filter(
      (d) => d.pacienteId === pacienteId && (!atendimentoId || d.atendimentoId === atendimentoId),
    )
    .sort((a, b) => (b.emitidoEm ?? b.criadoEm).localeCompare(a.emitidoEm ?? a.criadoEm))
}

export function laudoPorId(id: string) {
  const dono = donoDoId(id, 'laudo')
  const r = dono ? registroDoAtendimento(dono) : null
  const laudo = r?.laudos.find((l) => l.id === id)
  return laudo && r ? { laudo, registro: r } : null
}

/* ------------------------------------------------------------------------- as listas */

function idsDoPaciente(pacienteId: string) {
  const daAgenda = agendamentosDoPaciente(pacienteId)
    .map((a) => a.atendimentoId)
    .filter((id): id is string => Boolean(id) && !DESCARTADOS.has(id as string))
  const avulsos = [...CACHE.values()]
    .filter((r) => r.pacienteId === pacienteId && !r.agendamentoId)
    .map((r) => r.id)
  return [...daAgenda, ...avulsos]
}

function itemDoRegistro(r: RegistroDoAtendimento): ItemDaLista {
  const p = pacienteDe(r.pacienteId)
  return {
    id: r.id,
    status: r.status,
    tipo: r.tipo,
    pacienteId: p.id,
    pacienteNome: p.nome,
    profissionalId: r.profissionalId,
    profissionalNome: nomeDoProfissional(r.profissionalId),
    agendamentoId: r.agendamentoId,
    abertoEm: r.abertoEm,
    dataDoAtendimento: r.dataDoAtendimento,
    finalizadoEm: r.finalizadoEm,
    anuladoEm: r.anuladoEm,
    nuncaAberto: r.nuncaAberto,
  }
}

/** A linha da lista sem montar o atendimento inteiro (o mesmo que a montagem daria). */
function itemLeve(a: AgendamentoDaDemo, id: string): ItemDaLista {
  const guardado = CACHE.get(id)
  if (guardado) return itemDoRegistro(guardado)
  const p = pacienteDe(a.pacienteId)
  const estado = estadoInicial(a, id)
  const status: Status =
    estado === 'FINALIZADO' ? 'FINALIZADO' : estado === 'ANULADO' ? 'ANULADO' : 'RASCUNHO'
  return {
    id,
    status,
    tipo: kindDe(a),
    pacienteId: p.id,
    pacienteNome: p.nome,
    profissionalId: a.profissionalId,
    profissionalNome: nomeDoProfissional(a.profissionalId),
    agendamentoId: a.id,
    abertoEm: a.iniciadoEm ?? a.inicio,
    dataDoAtendimento: a.inicio.slice(0, 10),
    finalizadoEm: status !== 'RASCUNHO' ? finalizadoEmDe(a) : null,
    anuladoEm: status === 'ANULADO' ? anuladoEmDe(a) : null,
    nuncaAberto: estado === 'NOVO',
  }
}

/** Todas as linhas da lista de atendimentos, do mais recente. */
export function itensDaLista(
  filtro: {
    status?: Status | null
    profissionalId?: string | null
    pacienteId?: string | null
  } = {},
): ItemDaLista[] {
  const itens: ItemDaLista[] = []
  for (const a of AGENDAMENTOS) {
    const id = a.atendimentoId
    if (!id || (DESCARTADOS.has(id) && !reiniciado(id, a))) continue
    if (filtro.pacienteId && a.pacienteId !== filtro.pacienteId) continue
    if (
      filtro.profissionalId &&
      (CACHE.get(id)?.profissionalId ?? a.profissionalId) !== filtro.profissionalId
    )
      continue
    const item = itemLeve(a, id)
    if (filtro.status && item.status !== filtro.status) continue
    itens.push(item)
  }
  for (const r of CACHE.values()) {
    if (r.agendamentoId) continue
    if (filtro.pacienteId && r.pacienteId !== filtro.pacienteId) continue
    if (filtro.profissionalId && r.profissionalId !== filtro.profissionalId) continue
    if (filtro.status && r.status !== filtro.status) continue
    itens.push(itemDoRegistro(r))
  }
  return itens.sort(
    (x, y) =>
      y.dataDoAtendimento.localeCompare(x.dataDoAtendimento) ||
      y.abertoEm.localeCompare(x.abertoEm),
  )
}

export function prontuariosEmAberto(profissionalId?: string | null) {
  return itensDaLista({ status: 'RASCUNHO', profissionalId })
}

export function atendimentosDoPaciente(pacienteId: string) {
  return itensDaLista({ pacienteId })
}

/** Finalizados de paciente com o responsável no app e o resumo ainda não liberado. */
export function finalizadosSemResumo() {
  const desde = somarDias(hoje(), -7)
  return itensDaLista({ status: 'FINALIZADO' })
    .filter((item) => item.dataDoAtendimento >= desde)
    .filter((item) => {
      const p = paciente(item.pacienteId)
      if (!p?.noApp) return false
      const r = CACHE.get(item.id)
      if (r) return !r.resumo.publicado
      const a = item.agendamentoId ? agendamento(item.agendamentoId) : null
      return a ? !resumoInicial(a, p).publicado : false
    })
}

function rascunhosMontados() {
  return prontuariosEmAberto()
    .map((item) => registroDoAtendimento(item.id))
    .filter((r): r is RegistroDoAtendimento => Boolean(r))
}

export function receitasPorAssinar() {
  return rascunhosMontados().flatMap((r) =>
    r.receitas
      .filter((rec) => rec.status === 'RASCUNHO')
      .map((receita) => ({ receita, atendimento: itemDoRegistro(r) })),
  )
}

export function prescricoesSemReceita() {
  return rascunhosMontados().flatMap((r) =>
    r.prescricoes
      .filter((p) => !p.receitaId)
      .map((prescricao) => ({ prescricao, atendimento: itemDoRegistro(r) })),
  )
}

export function documentosComAceitePendente() {
  montarTermosDaSemana()
  rascunhosMontados()
  return [...DOCUMENTOS.values()].filter(
    (d) => d.status === 'EMITIDO' && d.aceiteStatus === 'PENDENTE',
  )
}

export function documentosEmRascunho() {
  montarTermosDaSemana()
  rascunhosMontados()
  return [...DOCUMENTOS.values()].filter((d) => d.status === 'RASCUNHO')
}

/**
 * A lista da clínica toda (N35): os documentos já montados (termos da semana, rascunhos abertos e o
 * que a sessão criou), do mais novo pela criação, cada um com o paciente e sem o `conteudo`.
 */
export function documentosDaClinica() {
  montarTermosDaSemana()
  rascunhosMontados()
  return [...DOCUMENTOS.values()]
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .map((doc) => {
      const { conteudo: _conteudo, versaoDoAtendimento: _versao, ...resto } = doc
      const p = pacienteDe(doc.pacienteId)
      return { ...resto, paciente: { id: p.id, nome: p.nome, especie: p.especie } }
    })
}

/* ----------------------------------------------------------------------- linha do tempo */

export type FonteDaLinhaDoTempo = (pacienteId: string) => ItemDaLinhaDoTempo[]
const FONTES: FonteDaLinhaDoTempo[] = []

/** Outra área acrescenta os itens dela (vacinas, internações) à linha do tempo da ficha. */
export function registrarFonteDaLinhaDoTempo(fonte: FonteDaLinhaDoTempo) {
  FONTES.push(fonte)
}

const VIA_CURTA: Record<NonNullable<Ato['via']>, string> = {
  ORAL: 'VO',
  SUBCUTANEA: 'SC',
  INTRAMUSCULAR: 'IM',
  INTRAVENOSA: 'IV',
  TOPICA: 'tópica',
  OTOLOGICA: 'otológica',
  OFTALMICA: 'oftálmica',
  INTRANASAL: 'intranasal',
}

/** Tudo o que o paciente tem na clínica, do mais recente: atendimentos, atos, faltas e o resto. */
export function linhaDoTempoDoPaciente(pacienteId: string): ItemDaLinhaDoTempo[] {
  const itens: ItemDaLinhaDoTempo[] = []
  for (const id of idsDoPaciente(pacienteId)) {
    const r = registroDoAtendimento(id)
    if (!r) continue
    const diag = r.diagnostico.itens.find((d) => d.kind !== 'DIFERENCIAL')
    itens.push({
      tipo: 'ATENDIMENTO',
      id: r.id,
      em: r.realizadoEm,
      titulo: r.tipo,
      situacao: r.status,
      profissionalNome: nomeDoProfissional(r.profissionalId),
      detalhe: diag?.descricao ?? r.anamnese.queixaPrincipal ?? null,
    })
    for (const ato of r.atos) {
      itens.push({
        tipo: 'ATO',
        id: ato.id,
        em: ato.realizadoEm,
        titulo: ato.descricao,
        situacao: ato.anuladoEm ? 'ANULADO' : null,
        profissionalNome: ato.profissionalNome,
        detalhe:
          [ato.doseTexto, ato.via ? VIA_CURTA[ato.via] : null].filter(Boolean).join(' ') || null,
      })
    }
  }
  for (const ato of ATOS_AVULSOS.filter((a) => a.pacienteId === pacienteId)) {
    itens.push({
      tipo: 'ATO',
      id: ato.id,
      em: ato.realizadoEm,
      titulo: ato.descricao,
      situacao: ato.anuladoEm ? 'ANULADO' : null,
      profissionalNome: ato.profissionalNome,
      detalhe: ato.doseTexto,
    })
  }
  for (const a of agendamentosDoPaciente(pacienteId)) {
    if (a.status !== 'FALTA') continue
    itens.push({
      tipo: 'FALTA',
      id: a.id,
      em: a.inicio,
      titulo: `Faltou: ${tipoDaBase(a.tipoId)?.nome ?? 'consulta'}`,
      situacao: null,
      profissionalNome: nomeDoProfissional(a.profissionalId),
      detalhe: null,
    })
  }
  for (const fonte of FONTES) {
    try {
      itens.push(...fonte(pacienteId))
    } catch {
      /* Uma fonte com defeito não derruba a ficha. */
    }
  }
  return itens.sort((x, y) => y.em.localeCompare(x.em))
}

export const TIPOS_DA_LINHA: TipoNaLinhaDoTempo[] = [
  'ATENDIMENTO',
  'CIRURGIA',
  'ATO',
  'VACINA',
  'FALTA',
  'INTERNACAO',
]

/* --------------------------------------------------------------------------- as cópias */

function maisDiasUteis(data: string, n: number) {
  let atual = data
  let contados = 0
  while (contados < n) {
    atual = somarDias(atual, 1)
    const semana = diaDaSemana(atual)
    if (semana !== 0 && semana !== 6) contados += 1
  }
  return atual
}

function menosDiasUteis(data: string, n: number) {
  let atual = data
  let contados = 0
  while (contados < n) {
    atual = somarDias(atual, -1)
    const semana = diaDaSemana(atual)
    if (semana !== 0 && semana !== 6) contados += 1
  }
  return atual
}

export type PedidoDeCopiaDaDemo = PedidoDeCopia & { gerandoDesde: number | null }

export const PEDIDOS_DE_COPIA: PedidoDeCopiaDaDemo[] = []
let copiasMontadas = false

export function pedidoDeCopia(
  pacienteId: string,
  dados: Partial<PedidoDeCopia> & Pick<PedidoDeCopia, 'origem' | 'recebidoEm'>,
): PedidoDeCopiaDaDemo {
  const p = pacienteDe(pacienteId)
  const dataDoPedido = dados.recebidoEm.slice(0, 10)
  const venceEm = maisDiasUteis(dataDoPedido, 5)
  const pedido: PedidoDeCopiaDaDemo = {
    id: dados.id ?? novoId('demo-copia'),
    pacienteId,
    pacienteNome: p.nome,
    origem: dados.origem,
    solicitanteNome: dados.solicitanteNome ?? null,
    status: dados.status ?? 'ABERTO',
    de: dados.de ?? null,
    ate: dados.ate ?? null,
    recebidoEm: dados.recebidoEm,
    dataDoPedido,
    venceEm,
    venceEmProrrogado: dados.venceEmProrrogado ?? null,
    prazo: dados.venceEmProrrogado ?? venceEm,
    vencido: false,
    justificativa: dados.justificativa ?? null,
    motivoRecusa: dados.motivoRecusa ?? null,
    geracaoErro: null,
    atendimentosIncluidos: dados.atendimentosIncluidos ?? null,
    laudosEmbutidos: dados.laudosEmbutidos ?? null,
    laudosForaDoPdf: dados.laudosForaDoPdf ?? null,
    prontoEm: dados.prontoEm ?? null,
    guardarAte: dados.guardarAte ?? null,
    pdfDisponivel: dados.pdfDisponivel ?? false,
    entregueEm: dados.entregueEm ?? null,
    canalDeEntrega: dados.canalDeEntrega ?? null,
    vinculoAnteriorComOutroDono: false,
    historicoDesde: dados.historicoDesde ?? null,
    gerandoDesde: null,
  }
  return pedido
}

/** Os pedidos de cópia da clínica: um de cada situação que a tela mostra. */
export function montarCopias() {
  if (copiasMontadas) return
  copiasMontadas = true
  const dia = hoje()
  const recebido = (diasUteis: number, hora: string) =>
    instante(menosDiasUteis(dia, diasUteis), hora)

  PEDIDOS_DE_COPIA.push(
    pedidoDeCopia('demo-pac-001', {
      id: 'demo-copia-perola',
      origem: 'APP',
      recebidoEm: recebido(1, '19:42'),
      historicoDesde: '2025-03-10',
    }),
  )

  const doThor = recebido(6, '11:05')
  PEDIDOS_DE_COPIA.push(
    pedidoDeCopia('demo-pac-002', {
      id: 'demo-copia-thor',
      origem: 'BALCAO',
      solicitanteNome: cliente('demo-cli-002')?.nome ?? null,
      recebidoEm: doThor,
      status: 'PRORROGADO',
      venceEmProrrogado: maisDiasUteis(maisDiasUteis(doThor.slice(0, 10), 5), 5),
      justificativa:
        'O prontuário inclui exames de imagem de outra clínica que ainda estão sendo digitalizados; o responsável concordou com o novo prazo.',
      de: somarDias(dia, -365),
      ate: dia,
    }),
  )

  const doBento = recebido(3, '08:51')
  const prontoEm = instante(menosDiasUteis(dia, 1), '16:10')
  const incluidos = itensDaLista({ pacienteId: 'demo-pac-007-2', status: 'FINALIZADO' }).filter(
    (i) => i.dataDoAtendimento <= doBento.slice(0, 10),
  ).length
  PEDIDOS_DE_COPIA.push(
    pedidoDeCopia('demo-pac-007-2', {
      id: 'demo-copia-bento',
      origem: 'APP',
      recebidoEm: doBento,
      status: 'PRONTO',
      atendimentosIncluidos: incluidos,
      laudosEmbutidos: 4,
      laudosForaDoPdf: 1,
      prontoEm,
      guardarAte: somarDias(prontoEm.slice(0, 10), 7),
      pdfDisponivel: true,
      historicoDesde: '2025-03-10',
    }),
  )

  const daDuna = recebido(14, '15:30')
  PEDIDOS_DE_COPIA.push(
    pedidoDeCopia('demo-pac-010', {
      id: 'demo-copia-duna',
      origem: 'BALCAO',
      solicitanteNome: cliente('demo-cli-010')?.nome ?? null,
      recebidoEm: daDuna,
      status: 'ENTREGUE',
      de: somarDias(dia, -200),
      ate: daDuna.slice(0, 10),
      atendimentosIncluidos: 9,
      laudosEmbutidos: 3,
      laudosForaDoPdf: 0,
      prontoEm: instante(maisDiasUteis(daDuna.slice(0, 10), 2), '10:20'),
      guardarAte: somarDias(maisDiasUteis(daDuna.slice(0, 10), 2), 7),
      entregueEm: instante(maisDiasUteis(daDuna.slice(0, 10), 3), '17:45'),
      canalDeEntrega: 'MAOS',
    }),
  )

  PEDIDOS_DE_COPIA.push(
    pedidoDeCopia('demo-pac-038', {
      id: 'demo-copia-hulk',
      origem: 'BALCAO',
      solicitanteNome: 'Fernando Moura',
      recebidoEm: recebido(24, '10:12'),
      status: 'RECUSADO',
      motivoRecusa:
        'Quem pediu não é o responsável cadastrado nem está entre as pessoas autorizadas. Orientado a trazer a autorização por escrito do responsável.',
    }),
  )
}

/** Atualiza o que depende do relógio (vencido) e termina a geração que já deu o tempo. */
export function pedidoAtualizado(pedido: PedidoDeCopiaDaDemo): PedidoDeCopiaDaDemo {
  if (
    pedido.status === 'GERANDO' &&
    pedido.gerandoDesde &&
    Date.now() - pedido.gerandoDesde > 4500
  ) {
    const p = pedido.pacienteId
    const finalizados = itensDaLista({ pacienteId: p, status: 'FINALIZADO' }).filter(
      (i) =>
        (!pedido.de || i.dataDoAtendimento >= pedido.de) &&
        (!pedido.ate || i.dataDoAtendimento <= pedido.ate),
    )
    const laudos = finalizados
      .map((i) => registroDoAtendimento(i.id))
      .reduce((total, r) => total + (r?.laudos.filter((l) => !l.removido).length ?? 0), 0)
    pedido.status = 'PRONTO'
    pedido.gerandoDesde = null
    pedido.atendimentosIncluidos = finalizados.length
    pedido.laudosEmbutidos = laudos
    pedido.laudosForaDoPdf = 0
    pedido.prontoEm = agoraIso()
    pedido.guardarAte = somarDias(hoje(), 7)
    pedido.pdfDisponivel = true
  }
  const aberto = ['ABERTO', 'PRORROGADO', 'GERANDO', 'PRONTO'].includes(pedido.status)
  pedido.vencido = aberto && pedido.status !== 'PRONTO' && pedido.prazo < hoje()
  return pedido
}

export function copiasPorGerar() {
  montarCopias()
  return PEDIDOS_DE_COPIA.map(pedidoAtualizado).filter(
    (p) => p.status === 'ABERTO' || p.status === 'PRORROGADO',
  )
}

/** O pedido sem o campo interno da geração. */
export function pedidoDto(pedido: PedidoDeCopiaDaDemo): PedidoDeCopia {
  const { gerandoDesde: _gerandoDesde, ...dto } = pedidoAtualizado(pedido)
  return dto
}

/* ------------------------------------------------------------------- textos para o PDF */

export { pacienteDe, nomeDoProfissional, crmvDe }
