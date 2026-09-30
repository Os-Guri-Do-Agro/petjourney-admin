/**
 * Do arquivo que a pessoa escolheu à `PlanilhaLida`.
 *
 * Duas portas, e as duas sem biblioteca:
 *
 * - **csv (e txt).** A codificação é descoberta, não perguntada: tenta-se UTF-8 estrito e, se
 *   algum byte não fecha, lê-se como Windows-1252 — que é o que o Excel antigo e metade dos
 *   sistemas de clínica gravam. Sem isso, "João" chegaria como "Jo�o" em todos os nomes, e a
 *   pessoa só perceberia depois de importar.
 * - **xlsx.** É um zip de XML. O zip é aberto aqui (diretório central + `DecompressionStream`,
 *   nativo do navegador) e o XML pelo `DOMParser`. Três coisas do Excel são tratadas porque
 *   mudam o conteúdo: célula com formato de data guarda um número (vira data), número longo
 *   guarda notação científica (vira os dígitos), e **célula mesclada** guarda o valor só na
 *   primeira — as outras são preenchidas com ele, e a planilha lembra quais foram.
 *
 * O `.xls` antigo (binário, anterior a 2007) não é lido: a tela pede para salvar como `.xlsx`.
 * Só a primeira aba com dado é lida — a tela diz qual foi.
 */

import { dataDoExcel } from '../domain/migracao'
import { indiceDaLetra, lerCsv, montarPlanilha, type PlanilhaLida } from '../domain/planilha'

export type ErroDeLeitura =
  | 'vazio'
  | 'grande-demais'
  | 'xls-antigo'
  | 'formato-desconhecido'
  | 'corrompido'
  | 'sem-linhas'
  | 'linhas-demais'

export class FalhaNaLeitura extends Error {
  readonly kind: ErroDeLeitura

  constructor(kind: ErroDeLeitura) {
    super(`[migracao] leitura falhou: ${kind}`)
    this.name = 'FalhaNaLeitura'
    this.kind = kind
  }
}

export const LIMITE_DO_ARQUIVO_MB = 20
/** Maior que qualquer clínica de bairro; o teto existe para a aba não travar num arquivo errado. */
export const LIMITE_DE_LINHAS = 30_000

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export function decodificarTexto(bytes: Uint8Array): {
  texto: string
  codificacao: 'utf-8' | 'windows-1252'
} {
  try {
    return { texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes), codificacao: 'utf-8' }
  } catch {
    return { texto: new TextDecoder('windows-1252').decode(bytes), codificacao: 'windows-1252' }
  }
}

// ---------------------------------------------------------------------------
// Zip
// ---------------------------------------------------------------------------

type EntradaDoZip = {
  metodo: number
  tamanhoComprimido: number
  deslocamento: number
}

const ASSINATURA_DO_FIM = 0x06054b50
const ASSINATURA_DO_DIRETORIO = 0x02014b50
const ASSINATURA_LOCAL = 0x04034b50

function entradasDoZip(bytes: Uint8Array): Map<string, EntradaDoZip> {
  const leitor = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let fim = -1

  /* O registro final fica nos últimos 22 bytes, mais um comentário de até 64 KB. */
  for (
    let posicao = bytes.length - 22;
    posicao >= Math.max(0, bytes.length - 65_557);
    posicao -= 1
  ) {
    if (leitor.getUint32(posicao, true) === ASSINATURA_DO_FIM) {
      fim = posicao
      break
    }
  }

  if (fim < 0) {
    throw new FalhaNaLeitura('corrompido')
  }

  const total = leitor.getUint16(fim + 10, true)
  let ponteiro = leitor.getUint32(fim + 16, true)
  const entradas = new Map<string, EntradaDoZip>()
  const nomes = new TextDecoder('utf-8')

  for (let indice = 0; indice < total; indice += 1) {
    if (
      ponteiro + 46 > bytes.length ||
      leitor.getUint32(ponteiro, true) !== ASSINATURA_DO_DIRETORIO
    ) {
      throw new FalhaNaLeitura('corrompido')
    }

    const tamanhoDoNome = leitor.getUint16(ponteiro + 28, true)
    const tamanhoExtra = leitor.getUint16(ponteiro + 30, true)
    const tamanhoDoComentario = leitor.getUint16(ponteiro + 32, true)
    const nome = nomes.decode(bytes.subarray(ponteiro + 46, ponteiro + 46 + tamanhoDoNome))

    entradas.set(nome, {
      metodo: leitor.getUint16(ponteiro + 10, true),
      tamanhoComprimido: leitor.getUint32(ponteiro + 20, true),
      deslocamento: leitor.getUint32(ponteiro + 42, true),
    })

    ponteiro += 46 + tamanhoDoNome + tamanhoExtra + tamanhoDoComentario
  }

  return entradas
}

async function descomprimir(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new ReadableStream<Uint8Array>({
    start(controle) {
      controle.enqueue(dados.slice())
      controle.close()
    },
  }).pipeThrough(
    new DecompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>,
  )

  const leitor = fluxo.getReader()
  const pedacos: Uint8Array[] = []
  let total = 0

  for (;;) {
    const { done, value } = await leitor.read()

    if (done) {
      break
    }

    pedacos.push(value)
    total += value.length
  }

  const saida = new Uint8Array(total)
  let posicao = 0

  for (const pedaco of pedacos) {
    saida.set(pedaco, posicao)
    posicao += pedaco.length
  }

  return saida
}

async function lerEntrada(bytes: Uint8Array, entrada: EntradaDoZip): Promise<string> {
  const leitor = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  if (leitor.getUint32(entrada.deslocamento, true) !== ASSINATURA_LOCAL) {
    throw new FalhaNaLeitura('corrompido')
  }

  const inicio =
    entrada.deslocamento +
    30 +
    leitor.getUint16(entrada.deslocamento + 26, true) +
    leitor.getUint16(entrada.deslocamento + 28, true)
  const dados = bytes.subarray(inicio, inicio + entrada.tamanhoComprimido)

  if (entrada.metodo === 0) {
    return new TextDecoder('utf-8').decode(dados)
  }

  if (entrada.metodo === 8) {
    return new TextDecoder('utf-8').decode(await descomprimir(dados))
  }

  throw new FalhaNaLeitura('corrompido')
}

// ---------------------------------------------------------------------------
// xlsx
// ---------------------------------------------------------------------------

function xml(texto: string): Document {
  const documento = new DOMParser().parseFromString(texto, 'application/xml')

  if (documento.getElementsByTagName('parsererror').length > 0) {
    throw new FalhaNaLeitura('corrompido')
  }

  return documento
}

/** Todo `<t>` de um item de texto, sem a transcrição fonética (`rPh`) que o Excel japonês põe junto. */
function textoDoItem(item: Element): string {
  return [...item.getElementsByTagName('t')]
    .filter((t) => t.parentElement?.tagName !== 'rPh')
    .map((t) => t.textContent ?? '')
    .join('')
}

/** Formatos de número que são data: os internos do Excel e os personalizados com dia ou ano. */
const FORMATOS_DE_DATA = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57,
])

function estilosDeData(documento: Document | null): Set<number> {
  const datas = new Set<number>()

  if (!documento) {
    return datas
  }

  const personalizados = new Map<number, string>()

  for (const formato of documento.getElementsByTagName('numFmt')) {
    personalizados.set(
      Number(formato.getAttribute('numFmtId')),
      formato.getAttribute('formatCode') ?? '',
    )
  }

  const xfs = documento.getElementsByTagName('cellXfs')[0]

  ;[...(xfs?.getElementsByTagName('xf') ?? [])].forEach((xf, indice) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0)
    const codigo = (personalizados.get(id) ?? '').replace(/"[^"]*"|\[[^\]]*\]/g, '')

    if (FORMATOS_DE_DATA.has(id) || /[dy]/i.test(codigo)) {
      datas.add(indice)
    }
  })

  return datas
}

/**
 * Número como o Excel mostraria, não como ele guarda.
 *
 * `9.82000123456789E+14` é o microchip `982000123456789` — cabe inteiro num `double`, então os
 * dígitos voltam sem perda. `4.5000000000000009` é o `4,5` que alguém digitou.
 */
function numeroLegivel(bruto: string): string {
  const valor = Number(bruto)

  if (!Number.isFinite(valor)) {
    return bruto
  }

  if (Number.isInteger(valor) && Math.abs(valor) < 1e16) {
    return valor.toFixed(0)
  }

  return String(Number(valor.toPrecision(12)))
}

async function caminhoDasAbas(
  bytes: Uint8Array,
  entradas: Map<string, EntradaDoZip>,
): Promise<string[]> {
  const livro = entradas.get('xl/workbook.xml')
  const relacoes = entradas.get('xl/_rels/workbook.xml.rels')

  if (!livro || !relacoes) {
    return [...entradas.keys()]
      .filter((nome) => /^xl\/worksheets\/sheet\d+\.xml$/.test(nome))
      .sort()
  }

  const alvos = new Map<string, string>()

  for (const relacao of xml(await lerEntrada(bytes, relacoes)).getElementsByTagName(
    'Relationship',
  )) {
    const alvo = relacao.getAttribute('Target') ?? ''

    alvos.set(relacao.getAttribute('Id') ?? '', alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`)
  }

  return [...xml(await lerEntrada(bytes, livro)).getElementsByTagName('sheet')]
    .map((aba) => alvos.get(aba.getAttribute('r:id') ?? '') ?? '')
    .filter(Boolean)
}

export async function lerXlsx(bytes: Uint8Array, arquivo: string): Promise<PlanilhaLida> {
  const entradas = entradasDoZip(bytes)
  const compartilhados = entradas.get('xl/sharedStrings.xml')
  const estilos = entradas.get('xl/styles.xml')

  const textos = compartilhados
    ? [...xml(await lerEntrada(bytes, compartilhados)).getElementsByTagName('si')].map(textoDoItem)
    : []
  const datas = estilosDeData(estilos ? xml(await lerEntrada(bytes, estilos)) : null)

  for (const caminho of await caminhoDasAbas(bytes, entradas)) {
    const entrada = entradas.get(caminho)

    if (!entrada) {
      continue
    }

    const aba = xml(await lerEntrada(bytes, entrada))
    const grade: string[][] = []

    for (const linha of aba.getElementsByTagName('row')) {
      const numero = Number(linha.getAttribute('r') ?? grade.length + 1) - 1
      const celulas: string[] = []
      let proxima = 0

      for (const celula of linha.getElementsByTagName('c')) {
        const referencia = celula.getAttribute('r')
        const coluna = referencia ? indiceDaLetra(referencia.replace(/\d+$/, '')) : proxima
        const tipo = celula.getAttribute('t') ?? 'n'
        const bruto = celula.getElementsByTagName('v')[0]?.textContent ?? ''
        let valor = ''

        if (tipo === 's') {
          valor = textos[Number(bruto)] ?? ''
        } else if (tipo === 'inlineStr') {
          const item = celula.getElementsByTagName('is')[0]
          valor = item ? textoDoItem(item) : ''
        } else if (tipo === 'b') {
          valor = bruto === '1' ? 'true' : 'false'
        } else if (tipo === 'str') {
          valor = bruto
        } else if (tipo === 'd') {
          valor = bruto.slice(0, 10)
        } else if (tipo === 'e') {
          valor = ''
        } else if (bruto !== '') {
          const estilo = Number(celula.getAttribute('s') ?? 0)
          valor = datas.has(estilo) ? dataDoExcel(Number(bruto)) : numeroLegivel(bruto)
        }

        celulas[coluna] = valor
        proxima = coluna + 1
      }

      grade[numero] = Array.from(celulas, (valor) => valor ?? '')
    }

    for (let indice = 0; indice < grade.length; indice += 1) {
      grade[indice] ??= []
    }

    /*
     * Célula mesclada: o valor mora só na de cima à esquerda. As outras recebem uma cópia, e a
     * planilha lembra quais foram — é o que permite ao relatório dizer "o responsável veio da
     * célula mesclada da linha 18" em vez de parecer que a linha 19 tinha o nome escrito.
     */
    const mescladasNaGrade = new Set<string>()

    for (const mescla of aba.getElementsByTagName('mergeCell')) {
      const [inicio, fim] = (mescla.getAttribute('ref') ?? '').split(':')
      const partes = (ref: string) => {
        const [, letras = 'A', numero = '1'] = /^([A-Z]+)(\d+)$/.exec(ref) ?? []

        return { coluna: indiceDaLetra(letras), linha: Number(numero) - 1 }
      }

      if (!inicio || !fim) {
        continue
      }

      const de = partes(inicio)
      const ate = partes(fim)
      const valor = grade[de.linha]?.[de.coluna] ?? ''

      if (!valor) {
        continue
      }

      for (let linha = de.linha; linha <= ate.linha; linha += 1) {
        for (let coluna = de.coluna; coluna <= ate.coluna; coluna += 1) {
          if (linha === de.linha && coluna === de.coluna) {
            continue
          }

          grade[linha] ??= []

          if (!grade[linha]![coluna]) {
            grade[linha]![coluna] = valor
            mescladasNaGrade.add(`${linha}:${coluna}`)
          }
        }
      }
    }

    const temDado = grade.some((linha) => linha.some((valor) => valor.trim() !== ''))

    if (temDado) {
      return montarPlanilha(grade, {
        arquivo,
        formato: 'xlsx',
        codificacao: null,
        mescladasNaGrade,
      })
    }
  }

  throw new FalhaNaLeitura('sem-linhas')
}

// ---------------------------------------------------------------------------
// Porta de entrada
// ---------------------------------------------------------------------------

export async function lerBytes(bytes: Uint8Array, arquivo: string): Promise<PlanilhaLida> {
  if (bytes.length === 0) {
    throw new FalhaNaLeitura('vazio')
  }

  if (bytes.length > LIMITE_DO_ARQUIVO_MB * 1024 * 1024) {
    throw new FalhaNaLeitura('grande-demais')
  }

  const extensao = /\.([a-z0-9]+)$/i.exec(arquivo)?.[1]?.toLowerCase() ?? ''
  const pareceZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  const pareceXlsAntigo = bytes[0] === 0xd0 && bytes[1] === 0xcf

  let planilha: PlanilhaLida

  if (extensao === 'xls' || pareceXlsAntigo) {
    throw new FalhaNaLeitura('xls-antigo')
  } else if (extensao === 'xlsx' || pareceZip) {
    planilha = await lerXlsx(bytes, arquivo)
  } else if (['csv', 'txt', 'tsv', ''].includes(extensao)) {
    const { texto, codificacao } = decodificarTexto(bytes)
    planilha = montarPlanilha(lerCsv(texto), { arquivo, formato: 'csv', codificacao })
  } else {
    throw new FalhaNaLeitura('formato-desconhecido')
  }

  if (planilha.linhas.length === 0) {
    throw new FalhaNaLeitura('sem-linhas')
  }

  if (planilha.linhas.length > LIMITE_DE_LINHAS) {
    throw new FalhaNaLeitura('linhas-demais')
  }

  return planilha
}

export async function lerArquivo(arquivo: File): Promise<PlanilhaLida> {
  return lerBytes(new Uint8Array(await arquivo.arrayBuffer()), arquivo.name)
}
