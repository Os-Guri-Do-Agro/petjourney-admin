import { describe, expect, it } from 'vitest'

import {
  celulaSegura,
  csvDasLinhas,
  dddDoTelefone,
  emLotes,
  especieNaApi,
  faltasObrigatorias,
  hashDoConteudo,
  ligar,
  ligarColunas,
  linhasParaEnviar,
  ordemDaColunaDeNascimento,
  origemDaPlanilha,
  perguntasDeEspecie,
} from '@/components/importacao/planilha-para-a-api'
import { montarPlanilha } from '@/features/clinico/domain/planilha'

function planilha(grade: string[][], mescladasNaGrade?: Set<string>) {
  return montarPlanilha(grade, {
    arquivo: 'clientes.csv',
    formato: 'csv',
    codificacao: 'utf-8',
    mescladasNaGrade,
  })
}

const CABECALHO = [
  'Código',
  'Nome do responsável',
  'Telefone',
  'Complemento',
  'Cod animal',
  'Nome do animal',
  'Espécie',
  'Raça',
  'Nascimento',
]

describe('ligarColunas', () => {
  it('liga o código do cliente, o do animal e o complemento, que o protótipo deixava de fora', () => {
    const lida = planilha([
      CABECALHO,
      ['3021', 'Ana Lima', '(65) 99999-1111', 'ap 2', 'A9', 'Mel', 'Cão', 'SRD', '10/02/2020'],
    ])
    const campos = ligarColunas(lida).map((item) => item.campo)

    expect(campos).toEqual([
      'codigoCliente',
      'responsavelNome',
      'telefone',
      'complemento',
      'codigoAnimal',
      'petNome',
      'especie',
      'raca',
      'nascimento',
    ])
  })

  it('um campo vai para uma coluna só, e o obrigatório tirado vira falta', () => {
    const lida = planilha([CABECALHO, ['1', 'Ana', '', '', '', 'Mel', 'Cão', '', '']])
    const trocadas = ligar(ligarColunas(lida), 2, 'responsavelNome')

    expect(trocadas[2]).toMatchObject({ campo: 'responsavelNome', como: 'pessoa' })
    expect(trocadas[1]).toMatchObject({ campo: null })
    expect(faltasObrigatorias(ligar(trocadas, 5, null))).toEqual(['petNome'])
  })
})

describe('perguntasDeEspecie', () => {
  it('pergunta só o que nem o nome nem a raça resolvem, e não pergunta por coelho e peixe', () => {
    const lida = planilha([
      CABECALHO,
      ['1', 'Ana', '', '', '', 'Mel', 'Cão', '', ''],
      ['2', 'Bia', '', '', '', 'Zeca', 'Coelho', '', ''],
      ['3', 'Caio', '', '', '', 'Nemo', 'Peixe', '', ''],
      ['4', 'Duda', '', '', '', 'Amendoim', '?', 'Pinscher', ''],
      ['5', 'Edu', '', '', '', 'Tico', '?', '', ''],
      ['6', 'Fábio', '', '', '', 'Pipoca', '', '', ''],
      ['7', 'Gil', '', '', '', '', '?', '', ''],
    ])
    const perguntas = perguntasDeEspecie(lida, ligarColunas(lida))

    /* "?" e a célula em branco são o mesmo não saber: uma pergunta só, a da espécie em branco. */
    expect(perguntas).toEqual([
      {
        chave: '',
        exemplo: '?',
        animais: [
          { linha: 6, nome: 'Tico' },
          { linha: 7, nome: 'Pipoca' },
        ],
      },
    ])
  })

  it('a espécie da demonstração no enum da API', () => {
    expect(especieNaApi('canina')).toEqual({ especie: 'CACHORRO' })
    expect(especieNaApi('equina')).toEqual({ especie: 'OUTRO', outra: 'Equino' })
  })
})

describe('linhasParaEnviar', () => {
  it('manda todas as linhas, com as em branco do meio, cada célula como está', () => {
    const lida = planilha([
      CABECALHO,
      ['1', 'Ana Lima', '65 9999-1111', '', '', 'Mel', 'Cão', '', '10/02/20'],
      ['', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', 'Tico', '?', '', ''],
    ])
    const linhas = linhasParaEnviar(lida, ligarColunas(lida), {
      '': { especie: 'AVE' },
    })

    expect(linhas).toHaveLength(3)
    expect(linhas[0]).toEqual({
      numeroLinha: 2,
      campos: {
        codigoCliente: '1',
        responsavelNome: 'Ana Lima',
        telefone: '65 9999-1111',
        petNome: 'Mel',
        especie: 'Cão',
        nascimento: '10/02/20',
      },
    })
    expect(linhas[1]).toEqual({ numeroLinha: 3, campos: {} })
    expect(linhas[2]).toMatchObject({ numeroLinha: 4, especieEscolhida: 'AVE' })
  })

  it('a escolha OUTRO leva o texto, e a célula mesclada vai marcada', () => {
    const lida = planilha(
      [CABECALHO, ['', 'Ana', '', '', '', 'Trovão', 'Cavalo?', '', '']],
      new Set(['1:1']),
    )
    const [linha] = linhasParaEnviar(lida, ligarColunas(lida), {
      cavalo: { especie: 'OUTRO', outra: 'Equino' },
    })

    expect(linha).toMatchObject({
      especieEscolhida: 'OUTRO',
      especieOutra: 'Equino',
      mescladas: ['responsavelNome'],
    })
  })
})

describe('o começo da importação', () => {
  it('a ordem das datas sai da coluna inteira', () => {
    const americana = planilha([CABECALHO, ['', 'A', '', '', '', 'M', 'Cão', '', '04/23/2019']])
    const brasileira = planilha([CABECALHO, ['', 'A', '', '', '', 'M', 'Cão', '', '23/04/2019']])

    expect(ordemDaColunaDeNascimento(americana, ligarColunas(americana))).toBe('MDY')
    expect(ordemDaColunaDeNascimento(brasileira, ligarColunas(brasileira))).toBe('DMY')
  })

  it('planilha feita à mão é PLANILHA', () => {
    expect(origemDaPlanilha(planilha([CABECALHO, ['1', 'A', '', '', '', 'M', '', '', '']]))).toBe(
      'PLANILHA',
    )
  })

  it('o DDD vem do telefone da clínica, com ou sem o 55', () => {
    expect(dddDoTelefone('(65) 3333-4444')).toBe('65')
    expect(dddDoTelefone('+55 11 98888-7777')).toBe('11')
    expect(dddDoTelefone('3333-4444')).toBeNull()
    expect(dddDoTelefone(null)).toBeNull()
  })

  it('o hash é o sha256 em hexadecimal minúsculo', async () => {
    const hash = await hashDoConteudo(new TextEncoder().encode('abc'))
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('lotes de até 500', () => {
    expect(
      emLotes(
        Array.from({ length: 1001 }, (_, i) => i),
        500,
      ).map((lote) => lote.length),
    ).toEqual([500, 500, 1])
  })
})

describe('CSV', () => {
  it('neutraliza a célula que viraria fórmula no Excel', () => {
    expect(celulaSegura('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`)
    expect(celulaSegura('+5511')).toBe(`'+5511`)
    expect(celulaSegura('-3')).toBe(`'-3`)
    expect(celulaSegura('@ana')).toBe(`'@ana`)
    expect(celulaSegura('Ana')).toBe('Ana')
  })

  it('as linhas que não entraram, com a linha do Excel e o porquê', () => {
    const lida = planilha([CABECALHO, ['=1+1', 'Ana', '', '', '', '', '', '', '']])
    const csv = csvDasLinhas(lida, [{ numeroLinha: 2, motivo: 'Animal sem nome' }], {
      linha: 'Linha',
      motivo: 'O que houve',
    })

    expect(csv.startsWith('﻿Linha;O que houve;Código')).toBe(true)
    expect(csv).toContain(`2;Animal sem nome;'=1+1;Ana`)
  })
})
