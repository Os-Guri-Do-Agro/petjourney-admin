/**
 * O resumo "Este pet em 30 segundos", nos três casos difíceis do requisito.
 *
 * Os testes de regra usam dado montado à mão, já na forma do contrato com o app
 * (`EntradaDoDiarioParaClinica`); os de dataset conferem que os três pacientes plantados
 * continuam **sendo** o caso que existem para demonstrar. Um caso que deixa de ser difícil não
 * avisa: a tela abre, parece funcionar, e a demonstração perde o ponto.
 */
import { describe, expect, it } from 'vitest'

import type { DiarioParaClinica, EntradaDoDiarioParaClinica } from '../../contrato/responsavel'
import { setMockConfig } from '../../data/mock-runtime'
import { patientRepository } from '../../data/repositories'
import { PET_DIARIO_CHEIO, PET_NOVO, PET_PERDA_DE_PESO } from '../../data/seed-resumo'
import { resetDataset } from '../../data/store'
import type { Pet } from '../../data/types'
import {
  montarResumoDoPaciente,
  ultimoDoCampo,
  variacaoDePeso,
  type ConsultaDoResumo,
  type PesagemDoPaciente,
} from '../resumo-do-paciente'

const AGORA = '2026-09-24T12:00:00-04:00'

function diasAtras(dias: number): string {
  return new Date(Date.parse(AGORA) - dias * 24 * 60 * 60 * 1000).toISOString()
}

const pet: Pet = {
  id: 'pet-teste',
  nome: 'Teste',
  especie: 'felina',
  raca: 'SRD',
  sexo: 'femea',
  nascimento: '2015-01-01',
  castrado: true,
  porte: null,
  pesoKg: 5,
  microchip: '',
  pelagem: '',
  tutorId: 'tutor-teste',
  iniciais: 'TE',
  fotoUrl: '',
  alertas: [
    { id: 'a1', kind: 'alergia', severidade: 'risco', detalhe: 'Dipirona' },
    { id: 'a2', kind: 'cronico', severidade: 'atencao', detalhe: 'Doença renal crônica' },
    { id: 'a3', kind: 'medicacao-continua', severidade: 'atencao', detalhe: 'Benazepril' },
  ],
}

function consulta(dias: number, pesoKg: number | null, extra: Partial<ConsultaDoResumo> = {}) {
  return {
    encounterId: `enc-${dias}`,
    appointmentId: `apt-${dias}`,
    em: diasAtras(dias),
    typeId: 'tipo-consulta',
    professionalId: 'prof-ana',
    diagnosticos: [],
    pesoKg,
    prescricoes: [],
    ...extra,
  } satisfies ConsultaDoResumo
}

let sequencia = 0

function registro(
  dias: number,
  extra: Partial<EntradaDoDiarioParaClinica> = {},
): EntradaDoDiarioParaClinica {
  sequencia += 1

  return {
    id: `d-${sequencia}`,
    data: diasAtras(dias),
    vitalidade: 'NORMAL',
    alimentacao: 'NORMAL',
    hidratacao: null,
    fezes: null,
    urina: null,
    sintomas: [],
    sintomasOutros: null,
    doencas: [],
    observacoes: null,
    remedios: null,
    nota: null,
    fotoIds: [],
    ...extra,
  }
}

function diario(
  entradas: EntradaDoDiarioParaClinica[],
  pesos: Array<[dias: number, pesoKg: number]> = [],
): DiarioParaClinica {
  return {
    petId: pet.id,
    desde: diasAtras(180),
    entradas,
    pesos: pesos.map(([dias, pesoKg]) => ({ id: `p-${dias}`, data: diasAtras(dias), pesoKg })),
  }
}

function ponto(dias: number, pesoKg: number, origem: PesagemDoPaciente['origem'] = 'casa') {
  return { em: diasAtras(dias), pesoKg, origem }
}

describe('variação de peso', () => {
  it('chama de contínua a queda sem subida, com pontos suficientes', () => {
    const variacao = variacaoDePeso([ponto(120, 5), ponto(80, 4.8), ponto(40, 4.6), ponto(5, 4.3)])

    expect(variacao?.percentual).toBe(-14)
    expect(variacao?.continua).toBe(true)
  })

  it('tolera a diferença entre a balança da clínica e a de casa', () => {
    const variacao = variacaoDePeso([
      ponto(90, 5, 'clinica'),
      ponto(60, 4.8),
      ponto(58, 4.82, 'clinica'),
      ponto(10, 4.5),
    ])

    expect(variacao?.continua).toBe(true)
  })

  it('não afirma tendência quando a série subiu no meio', () => {
    const variacao = variacaoDePeso([ponto(90, 5), ponto(60, 4.4), ponto(30, 4.9), ponto(5, 4.6)])

    expect(variacao?.continua).toBe(false)
  })
})

describe('resumo do paciente', () => {
  it('perda contínua acima de 10% vira sinal de risco, no topo', () => {
    const resumo = montarResumoDoPaciente({
      pet,
      consultas: [consulta(150, 5), consulta(90, 4.7), consulta(40, 4.5)],
      diario: diario([registro(3, { sintomas: ['TOSSE'] })], [
        [20, 4.3],
        [3, 4.1],
      ]),
      agora: AGORA,
    })

    expect(resumo.sinais[0]).toMatchObject({ tipo: 'perda-de-peso', severidade: 'risco' })
    expect(resumo.diario.peso).toMatchObject({ deKg: 4.3, paraKg: 4.1 })
  })

  it('um único achado de alarme no meio de noventa registros normais vira sinal', () => {
    const entradas = Array.from({ length: 90 }, (_, indice) => registro(indice / 3 + 0.1))

    entradas[40] = registro(9, {
      sintomas: ['FALTA_DE_AR', 'FRAQUEZA'],
      sintomasOutros: 'Desmaiou por alguns segundos',
      observacoes: 'Ficou com a língua roxa no calor.',
    })

    const resumo = montarResumoDoPaciente({
      pet,
      consultas: [consulta(31, 5)],
      diario: diario(entradas),
      agora: AGORA,
    })

    expect(resumo.sinais[0]).toMatchObject({
      tipo: 'alarme',
      achados: [{ campo: 'sintomas', valor: 'FALTA_DE_AR' }],
      /* O que o enum não tem chega pelo relato — e é a palavra que o vet precisa ler. */
      relato: 'Desmaiou por alguns segundos',
    })
    expect(resumo.diario.entradas).toHaveLength(90)
    expect(resumo.diario.semAlteracao).toBe(89)
    /* A fala do alarme já sai no sinal; não se repete nas notas. */
    expect(resumo.diario.notas).toHaveLength(0)
  })

  it('fezes com sangue e urina nenhuma são alarme, mesmo sem sintoma marcado', () => {
    const resumo = montarResumoDoPaciente({
      pet,
      consultas: [consulta(30, 5)],
      diario: diario([registro(5, { fezes: 'COM_SANGUE' }), registro(2, { urina: 'NADA' })]),
      agora: AGORA,
    })

    expect(resumo.sinais.filter((sinal) => sinal.tipo === 'alarme')).toHaveLength(2)
  })

  it('só conta o diário desde a última consulta', () => {
    const resumo = montarResumoDoPaciente({
      pet,
      consultas: [consulta(30, 5)],
      diario: diario([registro(40, { sintomas: ['VOMITO'] }), registro(10)]),
      agora: AGORA,
    })

    expect(resumo.diario.entradas).toHaveLength(1)
    expect(resumo.diario.sintomas).toHaveLength(0)
  })

  it('sintoma comum repetido três vezes vira sinal de atenção', () => {
    const resumo = montarResumoDoPaciente({
      pet,
      consultas: [consulta(30, 5)],
      diario: diario([6, 4, 2].map((dias) => registro(dias, { sintomas: ['TOSSE'] }))),
      agora: AGORA,
    })

    expect(resumo.sinais).toEqual([
      expect.objectContaining({ tipo: 'sintoma-recorrente', sintoma: 'TOSSE', vezes: 3 }),
    ])
  })

  it('água a mais na maioria dos registros é sinal: "muito" também é alteração', () => {
    const resumo = montarResumoDoPaciente({
      pet,
      consultas: [consulta(30, 5)],
      diario: diario([
        registro(12, { hidratacao: 'MUITO' }),
        registro(8, { hidratacao: 'MUITO' }),
        registro(4, { hidratacao: 'NORMAL' }),
        registro(1, { hidratacao: 'MUITO' }),
      ]),
      agora: AGORA,
    })

    expect(resumo.sinais).toContainEqual(
      expect.objectContaining({
        tipo: 'campo-alterado',
        campo: 'hidratacao',
        predominante: 'MUITO',
        alterados: 3,
        total: 4,
      }),
    )
    expect(ultimoDoCampo(resumo.diario.campos, 'hidratacao')).toBe('MUITO')
  })

  it('separa alerta, condição e medicação do cadastro, e junta a receita em curso', () => {
    const resumo = montarResumoDoPaciente({
      pet,
      consultas: [
        consulta(20, 5, {
          diagnosticos: [
            { id: 'd1', codigo: 'UR-03', descricao: 'Doença renal crônica', kind: 'definitivo' },
            { id: 'd2', codigo: 'GN-00', descricao: 'Check-up sem alterações', kind: 'definitivo' },
          ],
          prescricoes: [
            { medicamentoId: 'med-em-curso', ate: diasAtras(-5) },
            { medicamentoId: 'med-acabou', ate: diasAtras(2) },
            { medicamentoId: 'med-continua', ate: null },
          ],
        }),
      ],
      diario: diario([]),
      agora: AGORA,
    })

    expect(resumo.alertas.map((alerta) => alerta.kind)).toEqual(['alergia'])
    /* A condição do cadastro e o diagnóstico com o mesmo nome não viram duas linhas. */
    expect(resumo.condicoes).toEqual(['Doença renal crônica'])
    expect(
      resumo.medicacoes.map((item) =>
        item.origem === 'continua' ? item.descricao : item.medicamentoId,
      ),
    ).toEqual(['Benazepril', 'med-em-curso', 'med-continua'])
  })

  it('paciente sem consulta é primeira vez, e o diário cai nos últimos 30 dias', () => {
    const resumo = montarResumoDoPaciente({
      pet: { ...pet, alertas: [] },
      consultas: [],
      diario: diario([registro(45), registro(12)]),
      agora: AGORA,
    })

    expect(resumo.primeiraVez).toBe(true)
    expect(resumo.ultimaConsulta).toBeNull()
    expect(resumo.diario.entradas).toHaveLength(1)
    expect(resumo.sinais).toEqual([])
  })

  it('sem consentimento, o diário não chega — e o resumo diz que não foi liberado', () => {
    const resumo = montarResumoDoPaciente({
      pet,
      consultas: [consulta(30, 5)],
      diario: null,
      agora: AGORA,
    })

    expect(resumo.diario.liberado).toBe(false)
    expect(resumo.diario.entradas).toHaveLength(0)
    /* O peso da clínica continua: é dela, não do diário. */
    expect(resumo.peso.serie).toHaveLength(1)
  })
})

describe('os pacientes plantados', () => {
  async function resumoDe(petId: string) {
    setMockConfig({ latenciaMs: 0, jitterMs: 0 })
    resetDataset()

    const dados = await patientRepository.obter(petId)
    const fonte = await patientRepository.paraOResumo(petId)

    return {
      resumo: montarResumoDoPaciente({ pet: dados!.pet, ...fonte }),
      atendimentoDeHoje: fonte.atendimentoDeHoje,
    }
  }

  it('Pérola perde peso de forma contínua, e isso é o primeiro sinal', async () => {
    const { resumo, atendimentoDeHoje } = await resumoDe(PET_PERDA_DE_PESO)

    expect(resumo.sinais[0]).toMatchObject({ tipo: 'perda-de-peso', severidade: 'risco' })
    expect(resumo.peso.variacao?.continua).toBe(true)
    expect(resumo.peso.consultas).toHaveLength(3)
    /* O meloxicam contínuo da artrose: é o que o vet precisa cruzar com a perda de peso. */
    expect(resumo.medicacoes).toEqual([
      expect.objectContaining({ origem: 'prescricao', medicamentoId: 'med-meloxicam', ate: null }),
    ])
    expect(atendimentoDeHoje?.origem).toBe('app')
  })

  it('Chico tem dezenas de registros, e o desmaio não se perde neles', async () => {
    const { resumo } = await resumoDe(PET_DIARIO_CHEIO)

    expect(resumo.diario.entradas.length).toBeGreaterThan(60)
    expect(resumo.sinais[0]).toMatchObject({
      tipo: 'alarme',
      severidade: 'risco',
      relato: 'Desmaiou por alguns segundos',
    })
    expect(resumo.medicacoes).toHaveLength(1)
  })

  it('Paçoca é primeira vez, sem diário e sem peso', async () => {
    const { resumo, atendimentoDeHoje } = await resumoDe(PET_NOVO)

    expect(resumo.primeiraVez).toBe(true)
    expect(resumo.diario.entradas).toHaveLength(0)
    expect(resumo.peso.serie).toHaveLength(0)
    expect(atendimentoDeHoje).not.toBeNull()
  })

  it('o responsável que não liberou o diário não tem diário no resumo', async () => {
    const { resumo } = await resumoDe('pet-bidu')

    expect(resumo.diario.liberado).toBe(false)
  })
})
