/**
 * A leitura crua da planilha: separador, aspas, cabeçalho debaixo de título, e o número da
 * linha que a pessoa vai procurar no Excel.
 */
import { describe, expect, it } from 'vitest'

import {
  acharCabecalho,
  detectarSeparador,
  escreverCsv,
  indiceDaLetra,
  letraDaColuna,
  lerCsv,
  linhaNaPlanilha,
  montarPlanilha,
} from '../planilha'

describe('csv', () => {
  it('descobre o ponto e vírgula do Excel em português, mesmo com vírgula no endereço', () => {
    expect(detectarSeparador('Nome;Endereço\n"Ana";"Rua A, 12"\n')).toBe(';')
    expect(detectarSeparador('nome,fone\nAna,1199\n')).toBe(',')
    expect(detectarSeparador('nome\tfone\nAna\t1199\n')).toBe('\t')
  })

  it('lê aspas, aspas escapadas, quebra dentro de campo, CRLF e o BOM do Excel', () => {
    const texto = '﻿Nome;Obs\r\n"Ana ""Nanda"" Lu";"linha 1\nlinha 2"\r\nBia;\r\n'

    expect(lerCsv(texto)).toEqual([
      ['Nome', 'Obs'],
      ['Ana "Nanda" Lu', 'linha 1\nlinha 2'],
      ['Bia', ''],
    ])
  })

  it('escreve de volta o que leu', () => {
    const linhas = [
      ['Linha', 'Motivo'],
      ['12', 'Sem espécie; sem raça'],
      ['13', 'Aspas "assim"'],
    ]

    expect(lerCsv(escreverCsv(linhas))).toEqual(linhas)
  })
})

describe('cabeçalho e linhas', () => {
  const grade = [
    ['CADASTRO DE CLIENTES'],
    ['Emitido em 14/08/2025'],
    ['Cliente', 'Telefone', 'Animal', '', ''],
    ['Ana', '(11) 98888-7777', 'Rex', '', ''],
    ['', '', '', '', ''],
    ['Bia', '', 'Mia', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
  ]

  it('pula o título e a data de emissão', () => {
    expect(acharCabecalho(grade)).toBe(2)
  })

  it('tira as colunas vazias do fim e as linhas vazias do fim — e só elas', () => {
    const planilha = montarPlanilha(grade, {
      arquivo: 'x.csv',
      formato: 'csv',
      codificacao: 'utf-8',
    })

    expect(planilha.cabecalhos).toEqual(['Cliente', 'Telefone', 'Animal'])
    expect(planilha.linhas).toHaveLength(3)
    expect(planilha.linhas[1]).toEqual(['', '', ''])
  })

  it('numera como o Excel: a primeira linha de dado debaixo do cabeçalho da linha 3 é a 4', () => {
    const planilha = montarPlanilha(grade, {
      arquivo: 'x.csv',
      formato: 'csv',
      codificacao: 'utf-8',
    })

    expect(planilha.linhaDoCabecalho).toBe(3)
    expect(linhaNaPlanilha(planilha, 0)).toBe(4)
    expect(linhaNaPlanilha(planilha, 2)).toBe(6)
  })

  it('traduz a mescla da grade para o índice das linhas de dado', () => {
    const planilha = montarPlanilha(grade, {
      arquivo: 'x.xlsx',
      formato: 'xlsx',
      codificacao: null,
      mescladasNaGrade: new Set(['4:0', '1:0']),
    })

    expect([...planilha.mescladas]).toEqual(['1:0'])
  })

  it('letras de coluna nos dois sentidos', () => {
    expect(['A', 'Z', 'AA', 'AZ', 'BA'].map(indiceDaLetra)).toEqual([0, 25, 26, 51, 52])
    expect([0, 25, 26, 51, 52].map(letraDaColuna)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA'])
  })
})
