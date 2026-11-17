/**
 * O tempo e os recortes do protótipo de Saúde pública (17/11/2026, "muito mais filtros: por
 * campanha, região, período de tempo"). Tudo **ilustrativo**, como `dados.ts`.
 *
 * - **Tempo**: cada região sai do número do início (`inicio`) e chega ao de hoje (`cobertura`) nos 90
 *   dias. Uma parte da subida é contínua (o aviso no app, dia a dia); a outra vem em degrau, nos dez
 *   dias depois de cada campanha encerrada que passou pela região com aquele cuidado. Assim o
 *   período escolhido muda o número, e a campanha aparece no gráfico como um salto.
 * - **Espécie**: a antirrábica e a castração contam cães e gatos; separar uma da outra desloca o
 *   número em volta do da região, sem mudar a média. Leishmaniose e coleira são só de cães.
 * - **Bairro**: anda junto com a região dele, a partir do número de hoje.
 *
 * O dia é contado do começo do programa: 0 é a manhã de 01/12/2026 e 90, a noite de 28/02/2027.
 */
import {
  BAIRROS,
  CAMPANHAS,
  indicador as definicaoDo,
  PERIODO,
  REGIOES,
  tipoDeCampanha,
  type Bairro,
  type Campanha,
  type IdDaRegiao,
  type Indicador,
  type Regiao,
} from '@/features/saude-publica/dados'

export type Especie = 'todos' | 'caes' | 'gatos'

/** O que se está olhando: do começo do dia `de` ao fim do dia `ate`, nas regiões (vazio = cidade). */
export type Recorte = {
  /** Dia em que o período começa (0 a 89). */
  de: number
  /** Dia em que o período termina, contado no fim do dia (1 a 90). */
  ate: number
  regioes: IdDaRegiao[]
  especie: Especie
}

/* ---------------------------------------------------------------------------------- os dias */

const DIA = 86_400_000
const ZERO = Date.UTC(2026, 11, 1)

function utc(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number]
  return Date.UTC(ano, mes - 1, dia)
}

/** Quantos dias do programa já tinham passado na manhã da data (0 a 89). */
export function diaDaManha(data: string) {
  return Math.min(PERIODO.dias, Math.max(0, Math.round((utc(data) - ZERO) / DIA)))
}

/** Quantos dias do programa tinham passado na noite da data (1 a 90). */
export function diaDaNoite(data: string) {
  return Math.min(PERIODO.dias, diaDaManha(data) + 1)
}

/** A data (`AAAA-MM-DD`) de um dia do programa. */
export function dataDoDia(dia: number) {
  return new Date(ZERO + Math.max(0, Math.min(PERIODO.dias - 1, dia)) * DIA)
    .toISOString()
    .slice(0, 10)
}

export const RECORTE_INTEIRO: Recorte = { de: 0, ate: PERIODO.dias, regioes: [], especie: 'todos' }

/* ---------------------------------------------------------------------------- as campanhas */

/** As campanhas que já aconteceram dentro dos 90 dias: as únicas que mexem nos números. */
export const CAMPANHAS_DO_PERIODO: Campanha[] = CAMPANHAS.filter(
  (campanha) =>
    campanha.situacao === 'encerrada' &&
    campanha.data >= PERIODO.inicio &&
    campanha.data <= PERIODO.fim,
).sort((uma, outra) => uma.data.localeCompare(outra.data))

function campanhasQueTocam(regiao: IdDaRegiao, id: Indicador) {
  return CAMPANHAS_DO_PERIODO.filter(
    (campanha) =>
      campanha.regioes.includes(regiao) && tipoDeCampanha(campanha.tipo).indicador === id,
  )
}

/** Dez dias para a campanha render tudo: uma curva suave, sem quina. */
function degrau(x: number) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x * x * (3 - 2 * x)
}

/** Quanto da subida dos 90 dias já tinha acontecido no dia (0 a 1). */
function andamento(regiao: IdDaRegiao, id: Indicador, dia: number) {
  const campanhas = campanhasQueTocam(regiao, id)
  const continuo = campanhas.length ? 0.55 : 1
  const porCampanha = campanhas.length ? (1 - continuo) / campanhas.length : 0
  let fracao = continuo * (dia / PERIODO.dias)
  for (const campanha of campanhas) {
    fracao += porCampanha * degrau((dia - diaDaManha(campanha.data)) / 10)
  }
  return fracao
}

/* ------------------------------------------------------------------------------ as espécies */

/** Indicador que só conta cães não tem número para gatos. */
export function seAplica(id: Indicador, especie: Especie) {
  return !(especie === 'gatos' && definicaoDo(id).publico === 'caes')
}

/**
 * O deslocamento de cada espécie em volta do número do lugar: o gato toma menos antirrábica e é mais
 * castrado que o cão. Pesado pela quantidade de cada um, a média continua a mesma.
 */
const DIFERENCA_DO_GATO: Partial<Record<Indicador, number>> = { antirrabica: -9, castracao: 7 }

function naEspecie(
  valor: number,
  id: Indicador,
  especie: Especie,
  lugar: { caes: number; gatos: number },
) {
  const diferenca = DIFERENCA_DO_GATO[id]
  if (!diferenca || especie === 'todos' || definicaoDo(id).publico === 'caes') return valor
  const total = lugar.caes + lugar.gatos
  return especie === 'gatos'
    ? valor + diferenca * (lugar.caes / total)
    : valor - diferenca * (lugar.gatos / total)
}

/** Quantos animais contam para o indicador no lugar, na espécie escolhida. */
export function publicoNoRecorte(
  lugar: { caes: number; gatos: number },
  id: Indicador,
  especie: Especie,
) {
  if (!seAplica(id, especie)) return 0
  if (definicaoDo(id).publico === 'caes' || especie === 'caes') return lugar.caes
  if (especie === 'gatos') return lugar.gatos
  return lugar.caes + lugar.gatos
}

/** Cães e gatos do lugar, na espécie escolhida (para os números da abertura). */
export function animaisNoRecorte(lugar: { caes: number; gatos: number }, especie: Especie) {
  if (especie === 'caes') return lugar.caes
  if (especie === 'gatos') return lugar.gatos
  return lugar.caes + lugar.gatos
}

/** "+5 pontos", "+1 ponto", "−2 pontos": quanto o número andou. */
export function pontos(delta: number) {
  const sinal = delta > 0 ? '+' : delta < 0 ? '−' : ''
  return `${sinal}${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'ponto' : 'pontos'}`
}

/* ------------------------------------------------------------------------------- os números */

const limitar = (valor: number) => Math.min(100, Math.max(0, valor))

/** O percentual em dia da região no dia, na espécie (sem arredondar). */
export function coberturaDaRegiao(regiao: Regiao, id: Indicador, dia: number, especie: Especie) {
  const valor =
    regiao.inicio[id] + (regiao.cobertura[id] - regiao.inicio[id]) * andamento(regiao.id, id, dia)
  return limitar(naEspecie(valor, id, especie, regiao))
}

/** O percentual em dia do bairro no dia: o de hoje, andando junto com a região dele. */
export function coberturaDoBairro(bairro: Bairro, id: Indicador, dia: number, especie: Especie) {
  const regiao = REGIOES.find((item) => item.id === bairro.regiao)!
  const daRegiaoHoje = coberturaDaRegiao(regiao, id, PERIODO.dias, 'todos')
  const daRegiaoNoDia = coberturaDaRegiao(regiao, id, dia, 'todos')
  const valor = bairro.cobertura[id] + (daRegiaoNoDia - daRegiaoHoje)
  return limitar(naEspecie(valor, id, especie, bairro))
}

/** As regiões do recorte: as escolhidas, ou todas. */
export function regioesDoRecorte(recorte: Pick<Recorte, 'regioes'>) {
  return recorte.regioes.length
    ? REGIOES.filter((regiao) => recorte.regioes.includes(regiao.id))
    : REGIOES
}

export function bairrosDoRecorte(recorte: Pick<Recorte, 'regioes'>) {
  return recorte.regioes.length
    ? BAIRROS.filter((bairro) => recorte.regioes.includes(bairro.regiao))
    : BAIRROS
}

/** O percentual do recorte num dia: a média das regiões pesada pelo público do indicador. */
export function coberturaDoRecorte(id: Indicador, recorte: Recorte, dia: number) {
  let soma = 0
  let total = 0
  for (const regiao of regioesDoRecorte(recorte)) {
    const publico = publicoNoRecorte(regiao, id, recorte.especie)
    soma += coberturaDaRegiao(regiao, id, dia, recorte.especie) * publico
    total += publico
  }
  return total ? soma / total : 0
}

/** O número do período: onde terminou, onde começou e quanto andou, já arredondados. */
export function noPeriodo(id: Indicador, recorte: Recorte) {
  const fim = Math.round(coberturaDoRecorte(id, recorte, recorte.ate))
  const comeco = Math.round(coberturaDoRecorte(id, recorte, recorte.de))
  return { fim, comeco, delta: fim - comeco }
}

/**
 * O que a campanha rendeu nas regiões dela: o número na véspera e três semanas depois (ou no fim do
 * programa, o que vier antes), no cuidado da campanha.
 */
export function efeitoDaCampanha(campanha: Campanha) {
  const id = tipoDeCampanha(campanha.tipo).indicador
  const recorte: Recorte = { ...RECORTE_INTEIRO, regioes: campanha.regioes }
  const dia = diaDaManha(campanha.data)
  const depois = Math.min(PERIODO.dias, dia + 21)
  const antes = Math.round(coberturaDoRecorte(id, recorte, dia))
  const agora = Math.round(coberturaDoRecorte(id, recorte, depois))
  return { indicador: id, antes, depois: agora, delta: agora - antes, ate: dataDoDia(depois - 1) }
}
