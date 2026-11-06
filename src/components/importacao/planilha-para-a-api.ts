/**
 * Da planilha lida no navegador para o que a API do migrador recebe (E2-05, guia e2 seção 4.1).
 *
 * O portal só lê o arquivo, liga as colunas e faz o de-para de espécie; cada célula vai **como está**
 * (`campos`), porque a API lê de novo cada valor (CPF, telefone, data, peso, espécie) e não confia
 * no navegador. A leitura do arquivo e o palpite das colunas são os mesmos da demonstração
 * (`features/clinico/domain`); o plano local não roda aqui.
 */
import type { PetSpecies } from '@/features/clinico/data/types'
import {
  especiePelaRaca,
  exemplosDaColuna,
  lerEspecie,
  normalizarRotulo,
  ordemDasDatas,
  preenchidasNaColuna,
  reconhecerOrigem,
  sugerirMapeamento,
} from '@/features/clinico/domain/migracao'
import { escreverCsv, linhaNaPlanilha, type PlanilhaLida } from '@/features/clinico/domain/planilha'
import type {
  CampoDaLinha,
  CamposDaLinha,
  EspecieDaApi,
  LinhaEnviada,
  NovaImportacao,
} from '@/service/parceiro/importacao-service'

/** Os campos de `CamposDaLinhaDto`, na ordem do cadastro: o responsável, depois o animal. */
export const CAMPOS_DO_RESPONSAVEL: readonly CampoDaLinha[] = [
  'responsavelNome',
  'telefone',
  'telefone2',
  'email',
  'cpf',
  'cep',
  'endereco',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'uf',
  'codigoCliente',
]

export const CAMPOS_DO_ANIMAL: readonly CampoDaLinha[] = [
  'petNome',
  'especie',
  'raca',
  'sexo',
  'castrado',
  'nascimento',
  'idade',
  'peso',
  'microchip',
  'pelagem',
  'alergia',
  'situacao',
  'codigoAnimal',
]

/** Sem o nome do animal e o do responsável não há o que importar. */
export const CAMPOS_OBRIGATORIOS: readonly CampoDaLinha[] = ['petNome', 'responsavelNome']

export type ColunaLigada = {
  coluna: number
  campo: CampoDaLinha | null
  /** `sozinho`: o palpite pelo nome ou pelo conteúdo; `pessoa`: alguém escolheu. */
  como: 'sozinho' | 'pessoa'
}

/*
 * O código do sistema anterior (D6) e o complemento, que o protótipo mandava para "nenhum":
 * `Código` e `cod_cliente` são do cliente, `cod_animal` é do animal.
 */
const CODIGO_DO_ANIMAL = /\b(cod|codigo|id)\b.*\b(animal|pet|paciente)\b/
const CODIGO_DO_CLIENTE =
  /^(cod|codigo|id)$|\b(cod|codigo|id)\b.*\b(cliente|responsavel|tutor|proprietario|dono)\b/
const COMPLEMENTO = /^(complemento|compl|comp)$/

function campoNovo(cabecalho: string): CampoDaLinha | null {
  const rotulo = normalizarRotulo(cabecalho)

  if (CODIGO_DO_ANIMAL.test(rotulo)) return 'codigoAnimal'
  if (CODIGO_DO_CLIENTE.test(rotulo)) return 'codigoCliente'
  if (COMPLEMENTO.test(rotulo)) return 'complemento'

  return null
}

/** O palpite de cada coluna: o da demonstração, mais os campos que só a API tem. */
export function ligarColunas(planilha: PlanilhaLida): ColunaLigada[] {
  const sugestao = new Map(sugerirMapeamento(planilha).map((item) => [item.coluna, item.destino]))
  const usados = new Set<CampoDaLinha>()

  const ligadas: ColunaLigada[] = planilha.cabecalhos.map((_, coluna) => {
    const campo = (sugestao.get(coluna) ?? null) as CampoDaLinha | null
    if (campo) usados.add(campo)
    return { coluna, campo, como: 'sozinho' }
  })

  for (const item of ligadas) {
    if (item.campo) continue
    const campo = campoNovo(planilha.cabecalhos[item.coluna] ?? '')
    if (campo && !usados.has(campo)) {
      item.campo = campo
      usados.add(campo)
    }
  }

  return ligadas
}

/** Um campo vai para uma coluna só: escolher "Telefone" numa coluna tira o da outra. */
export function ligar(
  colunas: readonly ColunaLigada[],
  coluna: number,
  campo: CampoDaLinha | null,
): ColunaLigada[] {
  return colunas.map((item) => {
    if (item.coluna === coluna) return { ...item, campo, como: 'pessoa' }
    if (campo && item.campo === campo) return { ...item, campo: null, como: 'pessoa' }
    return item
  })
}

export function colunaDe(colunas: readonly ColunaLigada[], campo: CampoDaLinha) {
  return colunas.find((item) => item.campo === campo)?.coluna
}

export function faltasObrigatorias(colunas: readonly ColunaLigada[]): CampoDaLinha[] {
  return CAMPOS_OBRIGATORIOS.filter((campo) => colunaDe(colunas, campo) === undefined)
}

export function colunasUsadas(colunas: readonly ColunaLigada[]) {
  return colunas.filter((item) => item.campo !== null).length
}

export { exemplosDaColuna, preenchidasNaColuna }

/* ------------------------------------------------------------------------------- espécie */

/** O enum da API, na ordem em que a pergunta oferece. `FORA` é a resposta segura. */
export const ESPECIES_DA_API: readonly EspecieDaApi[] = [
  'CACHORRO',
  'GATO',
  'AVE',
  'ROEDOR',
  'COELHO',
  'PEIXE',
  'REPTIL',
  'OUTRO',
]

export type EscolhaDeEspecie = { especie: EspecieDaApi; outra?: string }

/** Coelho e peixe passaram a existir na API, que os reconhece sozinha: não se pergunta por eles. */
const RECONHECIDAS_PELA_API = new Set(['coelho', 'coelha', 'coelhos', 'peixe', 'peixes'])

/** A espécie da demonstração no enum da API (o de-para da seção 4.1). */
export function especieNaApi(especie: PetSpecies): EscolhaDeEspecie {
  switch (especie) {
    case 'canina':
      return { especie: 'CACHORRO' }
    case 'felina':
      return { especie: 'GATO' }
    case 'ave':
      return { especie: 'AVE' }
    case 'roedor':
      return { especie: 'ROEDOR' }
    case 'reptil':
      return { especie: 'REPTIL' }
    case 'equina':
      return { especie: 'OUTRO', outra: 'Equino' }
  }
}

export type PerguntaDeEspecie = {
  /** O valor normalizado; `''` é a espécie em branco. */
  chave: string
  /** Como está escrito na planilha (o primeiro que apareceu). */
  exemplo: string
  /** Os animais que dependem da resposta, com a linha do Excel. */
  animais: Array<{ linha: number; nome: string }>
}

/**
 * Os valores de espécie que nem o nome nem a raça resolvem, só nas linhas com animal. Cada um vira
 * uma pergunta; a resposta vai em cada linha desse valor (`especieEscolhida`).
 */
export function perguntasDeEspecie(
  planilha: PlanilhaLida,
  colunas: readonly ColunaLigada[],
): PerguntaDeEspecie[] {
  const especie = colunaDe(colunas, 'especie')
  const raca = colunaDe(colunas, 'raca')
  const nome = colunaDe(colunas, 'petNome')
  if (nome === undefined) return []

  const porChave = new Map<string, PerguntaDeEspecie>()

  planilha.linhas.forEach((celulas, indice) => {
    const animal = (celulas[nome] ?? '').trim()
    if (!animal) return

    const bruto = especie === undefined ? '' : (celulas[especie] ?? '').trim()
    const chave = normalizarRotulo(bruto)
    if (chave && (lerEspecie(bruto).especie || RECONHECIDAS_PELA_API.has(chave))) return
    if (especiePelaRaca(raca === undefined ? '' : (celulas[raca] ?? ''))) return

    const pergunta = porChave.get(chave) ?? { chave, exemplo: bruto, animais: [] }
    pergunta.animais.push({ linha: linhaNaPlanilha(planilha, indice), nome: animal })
    porChave.set(chave, pergunta)
  })

  return [...porChave.values()]
}

/* -------------------------------------------------------------------------------- linhas */

/**
 * Todas as linhas de dado, **com as em branco do meio**: é por elas que a API sabe que o animal sem
 * responsável não é continuação da linha de cima. Cada célula vai como está; a escolha de espécie
 * vai só nas linhas com animal do valor respondido.
 */
export function linhasParaEnviar(
  planilha: PlanilhaLida,
  colunas: readonly ColunaLigada[],
  especies: Readonly<Record<string, EscolhaDeEspecie>>,
): LinhaEnviada[] {
  const especie = colunaDe(colunas, 'especie')
  const nome = colunaDe(colunas, 'petNome')

  return planilha.linhas.map((celulas, indice) => {
    const campos: CamposDaLinha = {}
    const mescladas: CampoDaLinha[] = []

    for (const { coluna, campo } of colunas) {
      if (!campo) continue
      const valor = celulas[coluna] ?? ''
      if (valor !== '') campos[campo] = valor
      if (valor !== '' && planilha.mescladas.has(`${indice}:${coluna}`)) mescladas.push(campo)
    }

    const linha: LinhaEnviada = { numeroLinha: linhaNaPlanilha(planilha, indice), campos }
    const temAnimal = nome !== undefined && (celulas[nome] ?? '').trim() !== ''
    const chave = normalizarRotulo(especie === undefined ? '' : (celulas[especie] ?? ''))
    const escolha = temAnimal ? especies[chave] : undefined

    if (escolha) {
      linha.especieEscolhida = escolha.especie
      if (escolha.especie === 'OUTRO' && escolha.outra) linha.especieOutra = escolha.outra
    }
    if (mescladas.length) linha.mescladas = mescladas as LinhaEnviada['mescladas']

    return linha
  })
}

/** Lotes de até `tamanho` (500 linhas por chamada na API). */
export function emLotes<T>(itens: readonly T[], tamanho: number): T[][] {
  const lotes: T[][] = []
  for (let inicio = 0; inicio < itens.length; inicio += tamanho) {
    lotes.push(itens.slice(inicio, inicio + tamanho))
  }
  return lotes
}

/* ---------------------------------------------------------------------------- o começo */

/** `ordemDasDatas` decide pela coluna de nascimento inteira: `04/23/2019` diz que é americana. */
export function ordemDaColunaDeNascimento(
  planilha: PlanilhaLida,
  colunas: readonly ColunaLigada[],
): NovaImportacao['ordemDasDatas'] {
  const coluna = colunaDe(colunas, 'nascimento')
  if (coluna === undefined) return 'DMY'
  const valores = planilha.linhas.map((celulas) => celulas[coluna] ?? '')
  return ordemDasDatas(valores) === 'mdy' ? 'MDY' : 'DMY'
}

export function origemDaPlanilha(planilha: PlanilhaLida): NovaImportacao['origemDetectada'] {
  const origem = reconhecerOrigem(planilha.cabecalhos)
  if (origem?.id === 'simplesvet') return 'SIMPLESVET'
  if (origem?.id === 'vetus') return 'VETUS'
  return 'PLANILHA'
}

/**
 * O DDD do telefone da clínica (o do perfil do estabelecimento). Sem ele, a API deixa de fora o
 * telefone anotado sem DDD, em vez de inventar um.
 */
export function dddDoTelefone(telefone: string | null | undefined): string | null {
  let digitos = (telefone ?? '').replace(/\D/g, '')
  if (digitos.startsWith('55') && digitos.length >= 12) digitos = digitos.slice(2)
  if (digitos.startsWith('0')) digitos = digitos.replace(/^0+/, '')
  if (digitos.length < 10) return null
  const ddd = digitos.slice(0, 2)
  return /^[1-9][1-9]$/.test(ddd) ? ddd : null
}

/** sha256 do arquivo, em hexadecimal minúsculo. */
export async function hashDoConteudo(bytes: BufferSource): Promise<string> {
  const resumo = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(resumo)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/* ----------------------------------------------------------------------------------- CSV */

/**
 * Célula que começa com `=`, `+`, `-` ou `@` (ou tabulação e retorno) vira fórmula no Excel: com o
 * apóstrofo na frente, ela abre como texto.
 */
export function celulaSegura(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto
}

/**
 * "Baixar as linhas que não entraram": o cabeçalho e as células como vieram, mais a linha do
 * Excel e o porquê. Tudo passa por `celulaSegura`. Com o BOM, o Excel abre os acentos certos.
 */
export function csvDasLinhas(
  planilha: PlanilhaLida,
  linhas: ReadonlyArray<{ numeroLinha: number; motivo: string }>,
  rotulos: { linha: string; motivo: string },
): string {
  const porNumero = new Map(
    planilha.linhas.map((celulas, indice) => [linhaNaPlanilha(planilha, indice), celulas]),
  )
  const grade = [
    [rotulos.linha, rotulos.motivo, ...planilha.cabecalhos],
    ...linhas.map(({ numeroLinha, motivo }) => [
      String(numeroLinha),
      motivo,
      ...(porNumero.get(numeroLinha) ?? []),
    ]),
  ].map((linha) => linha.map(celulaSegura))

  return `﻿${escreverCsv(grade)}`
}
