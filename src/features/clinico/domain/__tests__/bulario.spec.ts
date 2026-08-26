/**
 * O bulário decide dose e aviso. É a parte do módulo em que errar tem consequência clínica, e
 * por isso cada regra tem um caso aqui — inclusive as que parecem óbvias.
 */

import { describe, expect, it } from 'vitest'

import { medicationsFixture } from '../../data/fixtures/medications'
import type { Medication, Pet, PetAlert } from '../../data/types'
import {
  avisosDoMedicamento,
  doseDaEspecie,
  especieProibida,
  filtrarMedicamentos,
  FILTRO_VAZIO,
  idadeEmMeses,
  sugestaoDePrescricao,
} from '../bulario'

const HOJE = new Date('2026-08-24T12:00:00Z')

function medicamento(id: string): Medication {
  const encontrado = medicationsFixture.find((item) => item.id === id)

  if (!encontrado) {
    throw new Error(`fixture sem ${id}`)
  }

  return encontrado
}

function pet(patch: Partial<Pet> = {}): Pet {
  return {
    id: 'pet-teste',
    nome: 'Teste',
    especie: 'canina',
    raca: 'SRD',
    sexo: 'macho',
    nascimento: '2020-01-01',
    castrado: true,
    pesoKg: 10,
    tutorId: 'tutor-teste',
    alertas: [],
    iniciais: 'TE',
    ...patch,
  }
}

function alerta(patch: Partial<PetAlert>): PetAlert {
  return { id: 'a1', kind: 'cronico', severidade: 'atencao', detalhe: '', ...patch }
}

describe('dose por espécie', () => {
  it('devolve a faixa da espécie pedida', () => {
    const dose = doseDaEspecie(medicamento('med-meloxicam'), 'felina')

    expect(dose?.mgPorKg).toEqual({ min: 0.02, max: 0.05 })
  })

  it('devolve nulo quando o bulário não traz a espécie', () => {
    expect(doseDaEspecie(medicamento('med-meloxicam'), 'ave')).toBeNull()
  })

  /**
   * O caso que dá nome ao módulo: a faixa felina de meloxicam é **um quinto** da canina. Tratar
   * gato como cachorro pequeno é o erro que a separação por espécie existe para impedir.
   */
  it('mantém a dose felina de meloxicam abaixo da canina', () => {
    const canina = doseDaEspecie(medicamento('med-meloxicam'), 'canina')
    const felina = doseDaEspecie(medicamento('med-meloxicam'), 'felina')

    expect(felina!.mgPorKg.max).toBeLessThan(canina!.mgPorKg.min)
  })

  it('marca espécie proibida', () => {
    expect(especieProibida(medicamento('med-carprofeno'), 'felina')).toBe(true)
    expect(especieProibida(medicamento('med-carprofeno'), 'canina')).toBe(false)
  })
})

describe('sugestão de prescrição', () => {
  /** Começa pelo mínimo: subir dose é decisão consciente, e o teto pré-preenchido vira conselho. */
  it('sugere o mínimo da faixa da espécie, com intervalo e duração do bulário', () => {
    const sugestao = sugestaoDePrescricao(medicamento('med-dipirona'), pet({ especie: 'felina' }))

    expect(sugestao).toEqual({ mgPorKg: 12.5, frequenciaHoras: 24, duracaoDias: 3 })
  })

  it('cai na faixa geral quando não há dose da espécie', () => {
    const sugestao = sugestaoDePrescricao(medicamento('med-meloxicam'), pet({ especie: 'ave' }))

    expect(sugestao.mgPorKg).toBe(medicamento('med-meloxicam').doseUsualMgKg.min)
  })

  it('não sugere a faixa proibida da espécie', () => {
    const carprofeno = medicamento('med-carprofeno')
    const sugestao = sugestaoDePrescricao(carprofeno, pet({ especie: 'felina' }))

    expect(sugestao.mgPorKg).toBe(carprofeno.doseUsualMgKg.min)
    expect(sugestao.mgPorKg).toBeGreaterThan(0)
  })
})

describe('avisos do paciente', () => {
  it('não avisa nada sem paciente aberto', () => {
    expect(avisosDoMedicamento(medicamento('med-meloxicam'), null, HOJE)).toEqual([])
  })

  it('avisa espécie proibida antes de qualquer outra coisa', () => {
    const avisos = avisosDoMedicamento(
      medicamento('med-carprofeno'),
      pet({ especie: 'felina' }),
      HOJE,
    )

    expect(avisos[0]?.kind).toBe('especie-proibida')
  })

  it('avisa quando o bulário não tem dose da espécie', () => {
    const avisos = avisosDoMedicamento(medicamento('med-carprofeno'), pet({ especie: 'ave' }), HOJE)

    expect(avisos.some((aviso) => aviso.kind === 'sem-dose-da-especie')).toBe(true)
  })

  it('casa alergia registrada com o princípio ativo', () => {
    const avisos = avisosDoMedicamento(
      medicamento('med-dipirona'),
      pet({ alertas: [alerta({ kind: 'alergia', detalhe: 'Dipirona' })] }),
      HOJE,
    )

    expect(avisos.some((aviso) => aviso.kind === 'alergia')).toBe(true)
  })

  /**
   * O encontro é por texto do alerta: a clínica escreve "Doença renal crônica" e é essa palavra
   * que liga ao cuidado `renal` do bulário. AINE em paciente renal é o caso clássico.
   */
  it('liga condição crônica renal ao cuidado renal do medicamento', () => {
    const avisos = avisosDoMedicamento(
      medicamento('med-meloxicam'),
      pet({ alertas: [alerta({ detalhe: 'Doença renal crônica' })] }),
      HOJE,
    )

    expect(avisos.some((aviso) => aviso.cuidado === 'renal')).toBe(true)
  })

  it('não inventa cuidado quando o alerta fala de outra coisa', () => {
    const avisos = avisosDoMedicamento(
      medicamento('med-meloxicam'),
      pet({ alertas: [alerta({ kind: 'agressivo', detalhe: 'Precisa de focinheira' })] }),
      HOJE,
    )

    expect(avisos.filter((aviso) => aviso.kind === 'cuidado')).toHaveLength(0)
  })

  it('deduz filhote da data de nascimento, não do alerta', () => {
    const avisos = avisosDoMedicamento(
      medicamento('med-ivermectina'),
      pet({ nascimento: '2026-05-01' }),
      HOJE,
    )

    expect(avisos.some((aviso) => aviso.cuidado === 'filhote')).toBe(true)
  })

  it('deduz idoso da data de nascimento', () => {
    const avisos = avisosDoMedicamento(
      medicamento('med-tramadol'),
      pet({ nascimento: '2012-01-01' }),
      HOJE,
    )

    expect(avisos.some((aviso) => aviso.cuidado === 'idoso')).toBe(true)
  })

  /**
   * Paciente cadastrado no balcão pode não ter data de nascimento — e o bulário **não pode
   * inventar idade** a partir disso. Cuidado que parece conferido e não foi é pior que cuidado
   * ausente: quem lê a tela assume que alguém olhou.
   */
  it('não deduz filhote nem idoso quando a data de nascimento é desconhecida', () => {
    const semData = pet({ nascimento: null })

    expect(idadeEmMeses(semData, HOJE)).toBeNull()

    const daIvermectina = avisosDoMedicamento(medicamento('med-ivermectina'), semData, HOJE)
    const doTramadol = avisosDoMedicamento(medicamento('med-tramadol'), semData, HOJE)

    expect(daIvermectina.some((aviso) => aviso.cuidado === 'filhote')).toBe(false)
    expect(doTramadol.some((aviso) => aviso.cuidado === 'idoso')).toBe(false)
  })

  /** Os cuidados que vêm do texto do alerta continuam valendo sem a data. */
  it('mantém o cuidado vindo do alerta mesmo sem data de nascimento', () => {
    const avisos = avisosDoMedicamento(
      medicamento('med-meloxicam'),
      pet({ nascimento: null, alertas: [alerta({ detalhe: 'Doença renal crônica' })] }),
      HOJE,
    )

    expect(avisos.some((aviso) => aviso.cuidado === 'renal')).toBe(true)
  })
})

describe('filtro do bulário', () => {
  it('sem filtro devolve tudo', () => {
    expect(filtrarMedicamentos(medicationsFixture, FILTRO_VAZIO)).toHaveLength(
      medicationsFixture.length,
    )
  })

  /** Quem está com um cão com otite na mesa procura "otite", não "enrofloxacina". */
  it('busca também pela indicação, não só pelo nome', () => {
    const achados = filtrarMedicamentos(medicationsFixture, { ...FILTRO_VAZIO, busca: 'otite' })

    expect(achados.length).toBeGreaterThan(0)
    expect(achados.every((item) => item.nome.toLowerCase().includes('otite'))).toBe(false)
  })

  it('busca pelo princípio ativo', () => {
    const achados = filtrarMedicamentos(medicationsFixture, { ...FILTRO_VAZIO, busca: 'maropitant' })

    expect(achados).toHaveLength(1)
  })

  it('filtra por classe', () => {
    const achados = filtrarMedicamentos(medicationsFixture, {
      ...FILTRO_VAZIO,
      classes: ['antibiotico'],
    })

    expect(achados.every((item) => item.classe === 'antibiotico')).toBe(true)
    expect(achados.length).toBeGreaterThan(1)
  })

  it('filtra por receituário de controle especial', () => {
    const achados = filtrarMedicamentos(medicationsFixture, {
      ...FILTRO_VAZIO,
      somenteControlados: true,
    })

    expect(achados.length).toBeGreaterThan(0)
    expect(achados.every((item) => item.controlado)).toBe(true)
  })

  /**
   * Espécie proibida **continua na lista**. Esconder carprofeno de quem busca para um gato
   * garantiria que ninguém descobrisse que ele é contraindicado.
   */
  it('mantém na lista o medicamento proibido para a espécie filtrada', () => {
    const achados = filtrarMedicamentos(medicationsFixture, {
      ...FILTRO_VAZIO,
      especie: 'felina',
    })

    expect(achados.some((item) => item.id === 'med-carprofeno')).toBe(true)
  })
})
