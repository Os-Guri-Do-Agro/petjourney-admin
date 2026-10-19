import { describe, expect, it } from 'vitest'

import { lugarDaSecao, rotaUsaTrilha } from '../rotas'

describe('rotaUsaTrilha', () => {
  it('liga o Trilha na Agenda e no que mora embaixo dela', () => {
    expect(rotaUsaTrilha('/veterinario/agenda')).toBe(true)
    expect(rotaUsaTrilha('/veterinario/agenda/semana')).toBe(true)
  })

  it('deixa as outras telas no design atual', () => {
    expect(rotaUsaTrilha('/veterinario/meu-dia')).toBe(false)
    expect(rotaUsaTrilha('/veterinario/agendamentos')).toBe(false)
    expect(rotaUsaTrilha('/inicio')).toBe(false)
  })
})

describe('lugarDaSecao', () => {
  it('dá a cada seção do menu a cor do seu lugar', () => {
    expect(lugarDaSecao('clinical')).toBe('clinica')
    expect(lugarDaSecao('patients')).toBe('pets')
    expect(lugarDaSecao('hotel')).toBe('hotel')
    expect(lugarDaSecao('portal')).toBe('portal')
    expect(lugarDaSecao('account')).toBe('conta')
    expect(lugarDaSecao('overview')).toBe('inicio')
  })

  it('cai no neutro quando a seção não é conhecida', () => {
    expect(lugarDaSecao('outra')).toBe('inicio')
  })
})
