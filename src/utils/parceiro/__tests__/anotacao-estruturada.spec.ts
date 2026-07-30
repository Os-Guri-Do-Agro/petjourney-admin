import { describe, expect, it } from 'vitest'

import type { Anotacao, TipoServicoPrestador } from '@/service/parceiro/types'
import {
  camposDoTipo,
  criarAnotacaoEstruturadaForm,
  criarExameSolicitadoForm,
  criarPrescricaoItemForm,
  dataHoraLocalParaIso,
  dataLocalParaIso,
  escalaresPreenchidos,
  filtrarEstruturadoPorTipo,
  montarAnotacaoEstruturada,
  temEstruturados,
  tipoAceitaEstruturado,
  validarAnotacaoEstruturada,
  type AnotacaoEstruturadaForm,
} from '../anotacao-estruturada'

function form(overrides: Partial<AnotacaoEstruturadaForm> = {}): AnotacaoEstruturadaForm {
  return { ...criarAnotacaoEstruturadaForm(), ...overrides }
}

function prescricao(overrides: Partial<ReturnType<typeof criarPrescricaoItemForm>> = {}) {
  return { ...criarPrescricaoItemForm(), ...overrides }
}

function exame(overrides: Partial<ReturnType<typeof criarExameSolicitadoForm>> = {}) {
  return { ...criarExameSolicitadoForm(), ...overrides }
}

function anotacao(overrides: Partial<Anotacao> = {}): Anotacao {
  return {
    id: 'a1',
    empresaNome: 'CenterVet',
    profissionalNome: null,
    servicoRealizado: 'Consulta',
    texto: 'Retorno em 15 dias.',
    criadaEm: '2026-07-28T12:00:00.000Z',
    motivo: null,
    diagnostico: null,
    pesoKg: null,
    tipoExame: null,
    laudoTexto: null,
    dataResultado: null,
    produtos: null,
    condicaoPele: null,
    comportamento: null,
    dataEntrada: null,
    dataSaida: null,
    alimentacao: null,
    intercorrencias: null,
    prescricaoItens: [],
    examesSolicitados: [],
    anexos: [],
    ...overrides,
  }
}

describe('campos por tipo de serviço', () => {
  it('espelha o contrato do backend', () => {
    expect(camposDoTipo('CONSULTA')).toEqual([
      'motivo',
      'diagnostico',
      'pesoKg',
      'prescricaoItens',
      'examesSolicitados',
    ])
    expect(camposDoTipo('EXAME')).toEqual(['tipoExame', 'laudoTexto', 'dataResultado'])
    expect(camposDoTipo('BANHO')).toEqual(['produtos', 'condicaoPele', 'comportamento'])
    expect(camposDoTipo('TOSA')).toEqual(['produtos', 'condicaoPele', 'comportamento'])
    expect(camposDoTipo('HOTEL')).toEqual([
      'dataEntrada',
      'dataSaida',
      'alimentacao',
      'comportamento',
      'intercorrencias',
    ])
    expect(camposDoTipo('OUTRO')).toEqual([])
  })

  it('OUTRO não aceita nada estruturado', () => {
    expect(tipoAceitaEstruturado('OUTRO')).toBe(false)
    expect(tipoAceitaEstruturado('CONSULTA')).toBe(true)
  })
})

describe('montarAnotacaoEstruturada', () => {
  it('devolve null quando nada foi preenchido', () => {
    expect(montarAnotacaoEstruturada('CONSULTA', form())).toBeNull()
    expect(montarAnotacaoEstruturada('CONSULTA', undefined)).toBeNull()
  })

  it('nunca envia campo de outro tipo de serviço (evita 400)', () => {
    const preenchido = form({
      motivo: 'Vômito há 2 dias',
      pesoKg: 12.4,
      produtos: 'Shampoo neutro',
      tipoExame: 'Ultrassom',
      prescricaoItens: [prescricao({ nome: 'Omeprazol' })],
    })

    const banho = montarAnotacaoEstruturada('BANHO', preenchido)

    expect(banho).toEqual({ produtos: 'Shampoo neutro' })
    expect(banho).not.toHaveProperty('motivo')
    expect(banho).not.toHaveProperty('pesoKg')
    expect(banho).not.toHaveProperty('prescricaoItens')
  })

  it('OUTRO nunca gera bloco estruturado', () => {
    expect(montarAnotacaoEstruturada('OUTRO', form({ motivo: 'x', produtos: 'y' }))).toBeNull()
  })

  it('trima os textos e descarta campo em branco', () => {
    const montado = montarAnotacaoEstruturada(
      'CONSULTA',
      form({ motivo: '  Vômito  ', diagnostico: '   ' }),
    )

    expect(montado).toEqual({ motivo: 'Vômito' })
  })

  it('descarta item de lista sem nome e mantém os demais', () => {
    const montado = montarAnotacaoEstruturada(
      'CONSULTA',
      form({
        prescricaoItens: [
          prescricao({
            nome: 'Omeprazol',
            dose: '10',
            unidade: 'mg',
            frequencia: '1x ao dia',
            duracaoDias: 7,
          }),
          prescricao({ dose: '5' }),
          prescricao(),
        ],
        examesSolicitados: [exame({ nome: 'Hemograma', observacao: 'Em jejum' }), exame()],
      }),
    )

    expect(montado?.prescricaoItens).toEqual([
      { nome: 'Omeprazol', dose: '10', unidade: 'mg', frequencia: '1x ao dia', duracaoDias: 7 },
    ])
    expect(montado?.examesSolicitados).toEqual([{ nome: 'Hemograma', observacao: 'Em jejum' }])
  })

  it('omite lista vazia em vez de mandar array vazio', () => {
    const montado = montarAnotacaoEstruturada('CONSULTA', form({ motivo: 'Rotina' }))

    expect(montado).toEqual({ motivo: 'Rotina' })
    expect(Object.keys(montado ?? {})).not.toContain('prescricaoItens')
  })

  it('converte as datas do formulário para ISO no fuso local', () => {
    const montado = montarAnotacaoEstruturada('EXAME', form({ dataResultado: '2026-07-30' }))
    const data = new Date(montado?.dataResultado ?? '')

    expect(data.getFullYear()).toBe(2026)
    expect(data.getMonth()).toBe(6)
    expect(data.getDate()).toBe(30)
  })
})

describe('conversão de data', () => {
  it('mantém o dia escolhido ao converter data pura', () => {
    const iso = dataLocalParaIso('2026-01-01')
    const data = new Date(iso ?? '')

    expect(data.getFullYear()).toBe(2026)
    expect(data.getMonth()).toBe(0)
    expect(data.getDate()).toBe(1)
  })

  it('mantém a hora escolhida ao converter data e hora', () => {
    const iso = dataHoraLocalParaIso('2026-07-30T14:30')
    const data = new Date(iso ?? '')

    expect(data.getDate()).toBe(30)
    expect(data.getHours()).toBe(14)
    expect(data.getMinutes()).toBe(30)
  })

  it('rejeita formato fora do esperado', () => {
    expect(dataLocalParaIso('30/07/2026')).toBeNull()
    expect(dataLocalParaIso('')).toBeNull()
    expect(dataHoraLocalParaIso('2026-07-30')).toBeNull()
  })
})

describe('validarAnotacaoEstruturada', () => {
  it('formulário vazio é válido: tudo é opcional', () => {
    for (const tipo of [
      'CONSULTA',
      'EXAME',
      'BANHO',
      'TOSA',
      'HOTEL',
      'OUTRO',
    ] as TipoServicoPrestador[]) {
      expect(validarAnotacaoEstruturada(tipo, form())).toEqual([])
    }
  })

  it('acusa peso fora da faixa aceita pelo backend', () => {
    expect(validarAnotacaoEstruturada('CONSULTA', form({ pesoKg: 0 }))[0]).toMatchObject({
      id: 'pesoKg',
      chave: 'pesoFaixa',
    })
    expect(validarAnotacaoEstruturada('CONSULTA', form({ pesoKg: 501 }))[0]).toMatchObject({
      id: 'pesoKg',
      chave: 'pesoFaixa',
    })
    expect(validarAnotacaoEstruturada('CONSULTA', form({ pesoKg: 12.4 }))).toEqual([])
  })

  it('ignora peso quando o tipo do acesso não aceita o campo', () => {
    expect(validarAnotacaoEstruturada('BANHO', form({ pesoKg: 999 }))).toEqual([])
  })

  it('acusa texto acima do limite da coluna', () => {
    const erros = validarAnotacaoEstruturada('CONSULTA', form({ motivo: 'a'.repeat(1001) }))

    expect(erros).toHaveLength(1)
    expect(erros[0]).toMatchObject({ id: 'motivo', chave: 'maxLength', params: { max: 1000 } })
  })

  it('exige nome no item de prescrição que foi parcialmente preenchido', () => {
    const erros = validarAnotacaoEstruturada(
      'CONSULTA',
      form({ prescricaoItens: [prescricao({ dose: '10' })] }),
    )

    expect(erros).toEqual([{ id: 'prescricaoItens.0.nome', chave: 'obrigatorio' }])
  })

  it('não reclama de item totalmente em branco', () => {
    expect(
      validarAnotacaoEstruturada('CONSULTA', form({ prescricaoItens: [prescricao()] })),
    ).toEqual([])
  })

  it('acusa duração fora da faixa', () => {
    const erros = validarAnotacaoEstruturada(
      'CONSULTA',
      form({ prescricaoItens: [prescricao({ nome: 'Omeprazol', duracaoDias: 0 })] }),
    )

    expect(erros).toEqual([
      {
        id: 'prescricaoItens.0.duracaoDias',
        chave: 'duracaoFaixa',
        params: { min: 1, max: 3650 },
      },
    ])
  })

  it('acusa mais itens do que o backend aceita', () => {
    const itens = Array.from({ length: 11 }, (_, i) => prescricao({ nome: `Item ${i}` }))
    const erros = validarAnotacaoEstruturada('CONSULTA', form({ prescricaoItens: itens }))

    expect(erros).toEqual([{ id: 'prescricaoItens', chave: 'maxItens', params: { max: 10 } }])
  })

  it('acusa saída da hospedagem anterior à entrada', () => {
    const erros = validarAnotacaoEstruturada(
      'HOTEL',
      form({ dataEntrada: '2026-07-30T14:00', dataSaida: '2026-07-29T10:00' }),
    )

    expect(erros).toEqual([{ id: 'dataSaida', chave: 'intervaloData' }])
  })

  it('aceita saída igual à entrada', () => {
    expect(
      validarAnotacaoEstruturada(
        'HOTEL',
        form({ dataEntrada: '2026-07-30T14:00', dataSaida: '2026-07-30T14:00' }),
      ),
    ).toEqual([])
  })
})

describe('filtrarEstruturadoPorTipo', () => {
  it('derruba chave que o tipo não aceita', () => {
    expect(
      filtrarEstruturadoPorTipo('BANHO', { produtos: 'Shampoo', pesoKg: 12, motivo: 'x' }),
    ).toEqual({ produtos: 'Shampoo' })
  })

  it('devolve null quando sobra nada', () => {
    expect(filtrarEstruturadoPorTipo('OUTRO', { motivo: 'x' })).toBeNull()
    expect(filtrarEstruturadoPorTipo('CONSULTA', undefined)).toBeNull()
    expect(filtrarEstruturadoPorTipo('CONSULTA', { prescricaoItens: [] })).toBeNull()
  })
})

describe('leitura', () => {
  it('anotação legada não tem bloco estruturado', () => {
    expect(temEstruturados(anotacao())).toBe(false)
    expect(escalaresPreenchidos(anotacao())).toEqual([])
  })

  it('lista só os escalares preenchidos, na ordem de exibição', () => {
    const item = anotacao({ diagnostico: 'Gastrite', motivo: 'Vômito', pesoKg: 12.4 })

    expect(escalaresPreenchidos(item)).toEqual([
      { campo: 'motivo', valor: 'Vômito' },
      { campo: 'diagnostico', valor: 'Gastrite' },
      { campo: 'pesoKg', valor: 12.4 },
    ])
  })

  it('reconhece bloco estruturado só com lista', () => {
    const item = anotacao({
      examesSolicitados: [{ id: 'e1', nome: 'Hemograma', observacao: null }],
    })

    expect(temEstruturados(item)).toBe(true)
  })
})
