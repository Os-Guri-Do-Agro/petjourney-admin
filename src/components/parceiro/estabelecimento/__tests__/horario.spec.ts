import { describe, expect, it } from 'vitest'

import {
  agruparSemana,
  diasSemGrupo,
  eVinteEQuatroHoras,
  faixasDoDia,
  faixasEmMinutos,
  hojeNoFuso,
  horaDoInstante,
  offsetDoFuso,
  problemaNoDia,
  problemaNoGrupo,
  semanaCompleta,
  semanaDosGrupos,
  temHorario,
  type GrupoDeHorario,
} from '../horario'
import { paraSlug, slugValido } from '../slug'

const aberto = (extra: Partial<Parameters<typeof problemaNoDia>[0]> = {}) => ({
  fechado: false,
  abre: '08:00',
  fecha: '18:00',
  intervaloInicio: null,
  intervaloFim: null,
  ...extra,
})

describe('problemaNoDia', () => {
  it('aceita o dia fechado e o expediente comum, com e sem intervalo', () => {
    expect(problemaNoDia({ fechado: true, abre: null, fecha: null })).toBeNull()
    expect(problemaNoDia(aberto())).toBeNull()
    expect(problemaNoDia(aberto({ intervaloInicio: '12:00', intervaloFim: '13:00' }))).toBeNull()
  })

  it('aceita 24 h só como 00:00 a 24:00', () => {
    expect(problemaNoDia(aberto({ abre: '00:00', fecha: '24:00' }))).toBeNull()
    expect(problemaNoDia(aberto({ abre: '24:00', fecha: '24:00' }))).toBe('HORA_INVALIDA')
  })

  it('aponta o mesmo problema que a API', () => {
    expect(problemaNoDia(aberto({ fecha: null }))).toBe('ABRE_E_FECHA_OBRIGATORIOS')
    expect(problemaNoDia(aberto({ abre: '25:00' }))).toBe('HORA_INVALIDA')
    expect(problemaNoDia(aberto({ abre: '18:00', fecha: '08:00' }))).toBe('ABRE_DEPOIS_DE_FECHA')
    expect(problemaNoDia(aberto({ intervaloInicio: '12:00' }))).toBe('INTERVALO_INCOMPLETO')
    expect(problemaNoDia(aberto({ intervaloInicio: '13:00', intervaloFim: '12:00' }))).toBe(
      'ABRE_DEPOIS_DE_FECHA',
    )
    expect(
      problemaNoDia(aberto({ fecha: '12:00', intervaloInicio: '12:00', intervaloFim: '13:00' })),
    ).toBe('INTERVALO_FORA_DO_EXPEDIENTE')
  })
})

describe('semana', () => {
  it('completa os 7 dias, de domingo a sábado, com fechado no que faltar', () => {
    const semana = semanaCompleta([{ ...aberto(), diaSemana: 1 }])

    expect(semana.map((dia) => dia.diaSemana)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(semana.filter((dia) => !dia.fechado).map((dia) => dia.diaSemana)).toEqual([1])
    expect(temHorario(semana)).toBe(true)
    expect(temHorario(semanaCompleta([]))).toBe(false)
  })

  it('escreve as faixas do dia, partidas pelo intervalo', () => {
    expect(faixasDoDia(aberto())).toEqual(['08:00–18:00'])
    expect(faixasDoDia(aberto({ intervaloInicio: '12:00', intervaloFim: '13:00' }))).toEqual([
      '08:00–12:00',
      '13:00–18:00',
    ])
    expect(faixasDoDia({ fechado: true, abre: null, fecha: null })).toEqual([])
  })
})

describe('horários em grupo', () => {
  const comercial = (diaSemana: number) => ({
    ...aberto({ intervaloInicio: '12:00', intervaloFim: '13:00' }),
    diaSemana,
  })
  const sabado = { ...aberto({ fecha: '12:00' }), diaSemana: 6 }

  it('junta os dias de mesmo horário, a partir da segunda, e deixa o resto fechado', () => {
    const semana = semanaCompleta([1, 2, 3, 4, 5].map(comercial).concat(sabado))
    const grupos = agruparSemana(semana)

    expect(grupos).toEqual([
      {
        dias: [1, 2, 3, 4, 5],
        abre: '08:00',
        fecha: '18:00',
        comPausa: true,
        pausaInicio: '12:00',
        pausaFim: '13:00',
      },
      { dias: [6], abre: '08:00', fecha: '12:00', comPausa: false, pausaInicio: '', pausaFim: '' },
    ])
    expect(diasSemGrupo(grupos)).toEqual([0])
  })

  it('volta para os 7 dias da API sem perder nada', () => {
    const semana = semanaCompleta([1, 2, 3, 4, 5].map(comercial).concat(sabado))

    expect(semanaDosGrupos(agruparSemana(semana))).toEqual(semana)
    expect(semanaDosGrupos([]).every((dia) => dia.fechado)).toBe(true)
  })

  it('grupo sem dia é problema; o horário segue a régua do dia', () => {
    const grupo: GrupoDeHorario = {
      dias: [],
      abre: '08:00',
      fecha: '18:00',
      comPausa: false,
      pausaInicio: '',
      pausaFim: '',
    }

    expect(problemaNoGrupo(grupo)).toBe('SEM_DIAS')
    expect(problemaNoGrupo({ ...grupo, dias: [1] })).toBeNull()
    expect(problemaNoGrupo({ ...grupo, dias: [1], abre: '19:00' })).toBe('ABRE_DEPOIS_DE_FECHA')
    expect(problemaNoGrupo({ ...grupo, dias: [1], comPausa: true, pausaInicio: '12:00' })).toBe(
      'INTERVALO_INCOMPLETO',
    )
  })

  it('reconhece o dia inteiro e mede as faixas para a régua', () => {
    expect(eVinteEQuatroHoras({ abre: '00:00', fecha: '24:00', comPausa: false })).toBe(true)
    expect(eVinteEQuatroHoras({ abre: '00:00', fecha: '23:59', comPausa: false })).toBe(false)
    expect(faixasEmMinutos(comercial(1))).toEqual([
      [480, 720],
      [780, 1080],
    ])
    expect(faixasEmMinutos({ ...aberto({ abre: '00:00', fecha: '24:00' }) })).toEqual([[0, 1440]])
    expect(faixasEmMinutos({ fechado: true, abre: null, fecha: null })).toEqual([])
  })
})

describe('fuso', () => {
  it('lê a hora de parede do instante como a API mandou, sem converter', () => {
    expect(horaDoInstante('2026-10-21T18:00:00-04:00')).toBe('18:00')
    expect(horaDoInstante('2026-07-01T09:30:00+01:00')).toBe('09:30')
  })

  it('dá o dia e o offset no fuso do estabelecimento', () => {
    const agora = new Date('2026-10-22T02:30:00Z')

    expect(hojeNoFuso('America/Cuiaba', agora)).toBe('2026-10-21')
    expect(hojeNoFuso('Europe/Belgrade', agora)).toBe('2026-10-22')
    expect(offsetDoFuso('America/Cuiaba', agora)).toBe('UTC−04:00')
    expect(offsetDoFuso('Fuso/Inexistente', agora)).toBe('')
  })
})

describe('slug', () => {
  it('vale de 3 a 60 caracteres, a-z, 0-9 e hífen no meio', () => {
    expect(slugValido('clinica-boa-vista')).toBe(true)
    expect(slugValido('ab')).toBe(false)
    expect(slugValido('-clinica')).toBe(false)
    expect(slugValido('clinica--boa')).toBe(false)
    expect(slugValido('Clinica')).toBe(false)
    expect(slugValido('a'.repeat(61))).toBe(false)
  })

  it('vira endereço a partir do nome: sem acento, minúsculo, hífen no lugar do resto', () => {
    expect(paraSlug('Clínica Boa Vista!')).toBe('clinica-boa-vista')
    expect(paraSlug('  Pet & Cia  ')).toBe('pet-cia')
  })
})
