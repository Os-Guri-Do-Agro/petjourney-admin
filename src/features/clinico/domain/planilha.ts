/**
 * A planilha como chegou: texto em grade, com o número de linha que a pessoa vê no Excel.
 *
 * Tudo aqui é leitura crua. Nada decide o que uma coluna *é* — isso é do migrador
 * (`domain/migracao.ts`). O que se resolve aqui são os defeitos de arquivo que não dependem do
 * conteúdo:
 *
 * - **Separador.** Planilha salva pelo Excel em português sai com `;`, porque a vírgula é a casa
 *   decimal. Export de sistema costuma sair com `,`, às vezes com tabulação. Adivinhar errado
 *   junta a linha inteira numa coluna só — e a tela de colunas viraria uma coluna gigante.
 * - **Linha de título.** "CADASTRO DE CLIENTES — CLÍNICA X" em cima do cabeçalho é o normal de
 *   planilha feita à mão. Tomá-la por cabeçalho faria todo nome de coluna vir errado.
 * - **Número da linha.** O relatório diz "linha 14", e a pessoa vai procurar a linha 14 no
 *   Excel. Por isso linha em branco **não é removida** aqui: ela conta, como conta lá.
 *
 * Sem Vue, sem `File`, sem DOM: quem lê o arquivo é `data/leitura-de-planilha.ts`.
 */

export type FormatoDaPlanilha = 'csv' | 'xlsx' | 'demonstracao'

export type PlanilhaLida = {
  arquivo: string
  formato: FormatoDaPlanilha
  /** Linha da planilha (contando de 1, como o Excel) em que está o cabeçalho. */
  linhaDoCabecalho: number
  cabecalhos: string[]
  /** Uma entrada por linha depois do cabeçalho, em branco inclusive. Toda linha tem a largura do cabeçalho. */
  linhas: string[][]
  /** `null` quando não se aplica (xlsx e demonstração). */
  codificacao: 'utf-8' | 'windows-1252' | null
  /**
   * Células que vieram vazias no arquivo e foram preenchidas pela mescla de cima.
   *
   * Chave `indiceDaLinha:indiceDaColuna`. Só o xlsx sabe de mescla; no csv ela já se perdeu, e
   * o migrador cai na pergunta "é continuação da linha de cima?".
   */
  mescladas: Set<string>
}

export type Separador = ',' | ';' | '\t'

/** Até onde se procura o cabeçalho. Título, data de emissão e linha em branco raramente passam de três. */
const LINHAS_PARA_ACHAR_O_CABECALHO = 10

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * O separador que mais se repete **fora de aspas** nas primeiras linhas.
 *
 * Contar dentro de aspas erraria justamente no caso comum: endereço com vírgula ("Rua A, 12")
 * numa planilha separada por ponto e vírgula.
 */
export function detectarSeparador(texto: string): Separador {
  const candidatos: Separador[] = [';', ',', '\t']
  const contagem = new Map<Separador, number>(candidatos.map((item) => [item, 0]))
  let entreAspas = false
  let linhas = 0

  for (const caractere of texto) {
    if (caractere === '"') {
      entreAspas = !entreAspas
      continue
    }

    if (entreAspas) {
      continue
    }

    if (caractere === '\n') {
      linhas += 1

      if (linhas >= LINHAS_PARA_ACHAR_O_CABECALHO) {
        break
      }

      continue
    }

    if (contagem.has(caractere as Separador)) {
      contagem.set(caractere as Separador, (contagem.get(caractere as Separador) ?? 0) + 1)
    }
  }

  /* Empate cai no ponto e vírgula: é o que o Excel em português grava. */
  return candidatos.reduce((melhor, atual) =>
    (contagem.get(atual) ?? 0) > (contagem.get(melhor) ?? 0) ? atual : melhor,
  )
}

/**
 * CSV para grade, pela RFC 4180 e pelo que o Excel faz de fato.
 *
 * Aspas duplas escapam aspas (`""`), campo entre aspas atravessa quebra de linha, `\r\n` e `\n`
 * valem igual, e o BOM que o Excel põe no começo do UTF-8 é descartado — senão o primeiro
 * cabeçalho viria como `﻿Nome` e não casaria com nada.
 */
export function lerCsv(texto: string, separador: Separador = detectarSeparador(texto)): string[][] {
  const fonte = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let entreAspas = false

  for (let indice = 0; indice < fonte.length; indice += 1) {
    const caractere = fonte[indice]!

    if (entreAspas) {
      if (caractere === '"') {
        if (fonte[indice + 1] === '"') {
          campo += '"'
          indice += 1
        } else {
          entreAspas = false
        }
      } else {
        campo += caractere
      }

      continue
    }

    if (caractere === '"' && campo === '') {
      entreAspas = true
    } else if (caractere === separador) {
      linha.push(campo)
      campo = ''
    } else if (caractere === '\n' || caractere === '\r') {
      if (caractere === '\r' && fonte[indice + 1] === '\n') {
        indice += 1
      }

      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    } else {
      campo += caractere
    }
  }

  /* A última linha sem quebra no fim ainda é linha; a quebra final sozinha não cria uma. */
  if (campo !== '' || linha.length > 0) {
    linha.push(campo)
    linhas.push(linha)
  }

  return linhas
}

/** Aspas só quando precisa, e o separador do Excel em português. */
export function escreverCsv(linhas: string[][], separador: Separador = ';'): string {
  const precisaDeAspas = new RegExp(`["\\n\\r${separador === '\t' ? '\\t' : separador}]`)

  return linhas
    .map((linha) =>
      linha
        .map((campo) => (precisaDeAspas.test(campo) ? `"${campo.replace(/"/g, '""')}"` : campo))
        .join(separador),
    )
    .join('\r\n')
}

// ---------------------------------------------------------------------------
// Da grade à planilha
// ---------------------------------------------------------------------------

function preenchidas(linha: string[]): number {
  return linha.filter((celula) => celula.trim() !== '').length
}

/**
 * A linha que é o cabeçalho.
 *
 * É a primeira, entre as dez de cima, que tem **pelo menos metade** das colunas da linha mais
 * larga preenchidas e **quase nada numérico** — título tem uma célula só, e linha de dado tem
 * telefone, peso e data. Sem candidata, fica a primeira linha não vazia: melhor um cabeçalho
 * estranho que a pessoa corrige na tela de colunas do que planilha recusada.
 */
export function acharCabecalho(grade: string[][]): number {
  const topo = grade.slice(0, LINHAS_PARA_ACHAR_O_CABECALHO)
  const largura = Math.max(0, ...grade.slice(0, 200).map(preenchidas))

  const candidata = topo.findIndex((linha) => {
    const cheias = linha.filter((celula) => celula.trim() !== '')

    if (cheias.length < Math.max(2, Math.ceil(largura / 2))) {
      return false
    }

    const numericas = cheias.filter((celula) => /^[\d\s.,/:+()-]+$/.test(celula.trim()))

    return numericas.length <= cheias.length * 0.2
  })

  if (candidata >= 0) {
    return candidata
  }

  const primeira = grade.findIndex((linha) => preenchidas(linha) > 0)

  return Math.max(0, primeira)
}

/**
 * Monta a planilha a partir da grade inteira do arquivo.
 *
 * As colunas vazias do fim (a sobra que o Excel exporta quando alguém formatou a coluna Z) saem;
 * as do meio ficam, porque apagá-las mudaria a letra das seguintes e a pessoa se perderia ao
 * comparar com o arquivo.
 */
export function montarPlanilha(
  grade: string[][],
  meta: {
    arquivo: string
    formato: FormatoDaPlanilha
    codificacao: PlanilhaLida['codificacao']
    /** Mesclas vindas do xlsx, com índices **da grade** (antes de achar o cabeçalho). */
    mescladasNaGrade?: Set<string>
  },
): PlanilhaLida {
  const indiceDoCabecalho = acharCabecalho(grade)
  const corpo = grade.slice(indiceDoCabecalho + 1)

  /* Nenhuma linha de dado sozinha decide a largura: a sobra do Excel aparece exatamente assim. */
  const ultimaUsada = Math.max(
    -1,
    ...[grade[indiceDoCabecalho] ?? [], ...corpo].map((linha) => {
      for (let coluna = linha.length - 1; coluna >= 0; coluna -= 1) {
        if ((linha[coluna] ?? '').trim() !== '') {
          return coluna
        }
      }

      return -1
    }),
  )
  const largura = ultimaUsada + 1

  const ajustar = (linha: string[]) =>
    Array.from({ length: largura }, (_, coluna) => (linha[coluna] ?? '').trim())

  /* Linhas em branco do fim não são dado: o arquivo só acabou depois delas. */
  let fim = corpo.length

  while (fim > 0 && preenchidas(corpo[fim - 1]!) === 0) {
    fim -= 1
  }

  const mescladas = new Set<string>()

  for (const chave of meta.mescladasNaGrade ?? []) {
    const [linha, coluna] = chave.split(':').map(Number)

    if (linha! > indiceDoCabecalho) {
      mescladas.add(`${linha! - indiceDoCabecalho - 1}:${coluna}`)
    }
  }

  return {
    arquivo: meta.arquivo,
    formato: meta.formato,
    linhaDoCabecalho: indiceDoCabecalho + 1,
    cabecalhos: ajustar(grade[indiceDoCabecalho] ?? []),
    linhas: corpo.slice(0, fim).map(ajustar),
    codificacao: meta.codificacao,
    mescladas,
  }
}

/** A linha do Excel de uma linha de dado. É o número que o relatório mostra. */
export function linhaNaPlanilha(planilha: PlanilhaLida, indice: number): number {
  return planilha.linhaDoCabecalho + 1 + indice
}

/** A letra da coluna, como no Excel: 0 → A, 25 → Z, 26 → AA. */
export function letraDaColuna(indice: number): string {
  let resto = indice + 1
  let letra = ''

  while (resto > 0) {
    const posicao = (resto - 1) % 26
    letra = String.fromCharCode(65 + posicao) + letra
    resto = Math.floor((resto - 1) / 26)
  }

  return letra
}

/** O inverso de `letraDaColuna`, para ler referências de célula do xlsx (`AB12`). */
export function indiceDaLetra(letra: string): number {
  let indice = 0

  for (const caractere of letra.toUpperCase()) {
    indice = indice * 26 + (caractere.charCodeAt(0) - 64)
  }

  return indice - 1
}
