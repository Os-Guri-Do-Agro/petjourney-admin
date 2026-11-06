import { describe, expect, it } from 'vitest'

import {
  chaveDoCampo,
  erroDoDesfazer,
  faseDoStatus,
  fraseDoAjuste,
  paraLegivel,
  tituloDoCodigo,
  tomDoCodigo,
} from '@/components/importacao/leitura-da-importacao'

const FORMATOS = {
  especie: (valor: string) => `especie:${valor}`,
  data: (iso: string) => `data:${iso}`,
  telefone: (digitos: string) => `tel:${digitos}`,
  peso: (quilos: number) => `${quilos} kg`,
}

describe('fraseDoAjuste', () => {
  it('o ajuste que a demonstração já dizia usa a frase dela, com o de e o para', () => {
    const frase = fraseDoAjuste(
      {
        campo: 'telefone',
        tipo: 'TELEFONE_SEM_DDD_CORRIGIDO',
        de: '3322-1100',
        para: '556533221100',
      },
      { campo: 'Telefone', para: '(65) 3322-1100' },
    )

    expect(frase).toEqual({
      chave: 'clinico.migracao.ajuste.telefone-ddd-da-clinica',
      params: { de: '3322-1100', para: '(65) 3322-1100', campo: 'Telefone' },
    })
  })

  it('o código novo da v0.3 tem frase própria', () => {
    const frase = fraseDoAjuste(
      { campo: 'telefone', tipo: 'TELEFONE_DE_ENCHIMENTO', de: '99999-9999', para: null },
      { campo: 'Telefone', para: '' },
    )

    expect(frase.chave).toBe('importacao.ajuste.TELEFONE_DE_ENCHIMENTO')
  })

  it('espécie escolhida para a célula em branco tem a frase do branco', () => {
    const frase = fraseDoAjuste(
      { campo: 'especie', tipo: 'ESPECIE_ESCOLHIDA', de: '', para: 'GATO' },
      { campo: 'Espécie', para: 'Gato' },
    )

    expect(frase.chave).toBe('clinico.migracao.ajuste.especie-escolhida-branco')
  })
})

describe('paraLegivel', () => {
  it('lê o para como a ficha mostra, pelo campo', () => {
    expect(paraLegivel('GATO', 'especie', FORMATOS)).toBe('especie:GATO')
    expect(paraLegivel('2017-11-05', 'nascimento', FORMATOS)).toBe('data:2017-11-05')
    expect(paraLegivel('5511984112299', 'telefone', FORMATOS)).toBe('tel:5511984112299')
    expect(paraLegivel('01234567890', 'cpf', FORMATOS)).toBe('012.345.678-90')
    expect(paraLegivel('01310100', 'cep', FORMATOS)).toBe('01310-100')
    expect(paraLegivel('0.1', 'peso', FORMATOS)).toBe('0.1 kg')
    expect(paraLegivel('Ana', 'responsavelNome', FORMATOS)).toBe('Ana')
    expect(paraLegivel(null, 'peso', FORMATOS)).toBe('')
  })
})

describe('códigos', () => {
  it('o motivo de fora da demonstração usa o título dela; o resto, o do migrador', () => {
    expect(tituloDoCodigo('ANIMAL_FALECIDO')).toBe('clinico.migracao.motivo.falecido.titulo')
    expect(tituloDoCodigo('LINHA_EM_BRANCO')).toBe('importacao.codigo.LINHA_EM_BRANCO')
  })

  it('cada código tem um tom', () => {
    expect(tomDoCodigo('ANIMAL_SEM_NOME')).toBe('fora')
    expect(tomDoCodigo('CPF_INVALIDO')).toBe('descarte')
    expect(tomDoCodigo('DIVERGE_PESO')).toBe('aviso')
    expect(tomDoCodigo('SEM_CONTATO')).toBe('aviso')
    expect(tomDoCodigo('DATA_ANO_CURTO')).toBe('ajuste')
  })

  it('os campos novos têm rótulo do migrador', () => {
    expect(chaveDoCampo('codigoAnimal')).toBe('importacao.campo.codigoAnimal')
    expect(chaveDoCampo('telefone')).toBe('clinico.migracao.campo.telefone')
  })
})

describe('status', () => {
  it('agrupa os status na fase da tela', () => {
    expect(faseDoStatus('COM_DUVIDAS')).toBe('duvidas')
    expect(faseDoStatus('DESFAZENDO')).toBe('andando')
    expect(faseDoStatus('FALHOU')).toBe('parada')
    expect(faseDoStatus('CANCELADA')).toBe('fim')
  })

  it('o erro do desfazer começa por DESFAZER_', () => {
    expect(erroDoDesfazer('DESFAZER_LOTE')).toBe(true)
    expect(erroDoDesfazer('LOTE_FALHOU')).toBe(false)
    expect(erroDoDesfazer(null)).toBe(false)
  })
})
