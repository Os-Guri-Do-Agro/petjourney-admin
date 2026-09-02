/**
 * Receituário: a conta do vet e a instrução do responsável.
 *
 * O fracionamento é o que estes testes mais protegem. "0,37 comprimido" não existe no mundo, e
 * imprimir esse número numa receita transfere para quem cuida do animal uma decisão que é do
 * veterinário. O algoritmo pode arredondar; o que ele não pode é arredondar **em silêncio**.
 */

import { describe, expect, it } from 'vitest'

import type { DoseCalc, Medication } from '../../data/types'
import { fracionar, gerarCodigoVerificador, passosDaConta } from '../receita'

function medicamento(patch: Partial<Medication> = {}): Medication {
  return {
    id: 'med-teste',
    nome: 'Teste',
    principioAtivo: 'testecilina',
    concentracao: 50,
    unidadeApresentacao: 'comprimido',
    doseUsualMgKg: { min: 5, max: 15 },
    viasPermitidas: ['oral'],
    classe: 'antibiotico',
    controlado: false,
    apresentacao: 'Comprimido 50 mg',
    indicacoes: [],
    contraindicacoes: [],
    efeitosAdversos: [],
    interacoes: [],
    cuidados: [],
    doses: [],
    observacao: '',
    ...patch,
  }
}

function calculo(patch: Partial<DoseCalc> = {}): DoseCalc {
  return {
    medicamentoId: 'med-teste',
    mgPorKg: 10,
    pesoKg: 12.4,
    mgPorAdministracao: 124,
    quantidadeApresentacao: 2.48,
    frequenciaHoras: 12,
    duracaoDias: 7,
    totalAdministracoes: 14,
    ...patch,
  }
}

describe('passosDaConta', () => {
  it('mostra a conta em três passos', () => {
    const passos = passosDaConta(calculo(), medicamento())

    expect(passos.map((passo) => passo.kind)).toEqual([
      'peso-por-dose',
      'dose-por-concentracao',
      'total',
    ])
  })

  it('leva peso e mg/kg no primeiro passo, para conferir de cabeça', () => {
    const [primeiro] = passosDaConta(calculo(), medicamento())

    expect(primeiro?.params).toMatchObject({ peso: 12.4, mgPorKg: 10, mg: 124 })
  })

  it('não mostra conta nenhuma sem peso', () => {
    /** `0 × 10 = 0` é pior que silêncio: parece uma conta conferida. */
    expect(passosDaConta(calculo({ pesoKg: 0 }), medicamento())).toEqual([])
  })

  it('omite o total quando o uso é contínuo', () => {
    const passos = passosDaConta(
      calculo({ duracaoDias: null, totalAdministracoes: 0 }),
      medicamento(),
    )

    expect(passos.map((passo) => passo.kind)).not.toContain('total')
  })
})

describe('fracionar', () => {
  it('não fraciona líquido', () => {
    /** 2,37 mL é um número que a seringa mostra; não há o que partir. */
    expect(fracionar(2.37, 'ml')).toBeNull()
  })

  it('reconhece as frações que um comprimido sulcado admite', () => {
    expect(fracionar(1, 'comprimido')?.kind).toBe('inteiro')
    expect(fracionar(0.5, 'comprimido')?.kind).toBe('meio')
    expect(fracionar(1.5, 'comprimido')?.kind).toBe('um-e-meio')
    expect(fracionar(0.25, 'comprimido')?.kind).toBe('quarto')
    expect(fracionar(0.75, 'comprimido')?.kind).toBe('tres-quartos')
  })

  it('marca como aproximado o que não cai numa fração partível', () => {
    /**
     * O caso difícil do requisito. 2,48 comprimidos vira "dois e meio" — mas a marca de
     * aproximado precisa existir, porque quem decide arredondar é o veterinário.
     */
    const resultado = fracionar(2.48, 'comprimido')

    expect(resultado?.aproximado).toBe(true)
    expect(resultado?.quantidade).toBe(2.5)
  })

  it('não marca como aproximado o que é exato', () => {
    expect(fracionar(0.5, 'comprimido')?.aproximado).toBe(false)
    expect(fracionar(2, 'comprimido')?.aproximado).toBe(false)
  })

  it('avisa quando a conta cai longe de qualquer fração partível', () => {
    /** 0,37 não é meio nem um quarto: a tela precisa cobrar decisão, não imprimir 0,37. */
    const resultado = fracionar(0.37, 'comprimido')

    expect(resultado?.kind).toBe('aproximado')
    expect(resultado?.aproximado).toBe(true)
  })

  it('devolve nulo para quantidade inexistente', () => {
    expect(fracionar(0, 'comprimido')).toBeNull()
  })
})

describe('gerarCodigoVerificador', () => {
  it('é determinístico', () => {
    expect(gerarCodigoVerificador('receita-1')).toBe(gerarCodigoVerificador('receita-1'))
  })

  it('muda quando o conteúdo muda', () => {
    expect(gerarCodigoVerificador('receita-1')).not.toBe(gerarCodigoVerificador('receita-2'))
  })

  it('sai em quatro grupos de quatro, para ditar ao telefone', () => {
    expect(gerarCodigoVerificador('qualquer')).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/)
  })

  it('não usa caracteres que se confundem ao ditar', () => {
    /** Sem I, O nem letras minúsculas: "I" vira "1" e "O" vira "0" na hora de repetir. */
    const codigo = gerarCodigoVerificador('teste-confusao')

    expect(codigo).not.toMatch(/[IO]/)
  })
})
