import { describe, expect, it } from 'vitest'

import { lugarDaSecao, rotaUsaTrilha } from '../rotas'

describe('rotaUsaTrilha', () => {
  it('liga o Trilha em todas as telas do portal', () => {
    expect(rotaUsaTrilha('/veterinario/agenda')).toBe(true)
    expect(rotaUsaTrilha('/veterinario/paciente/pet-mel/resumo')).toBe(true)
    expect(rotaUsaTrilha('/hotel/mapa')).toBe(true)
    expect(rotaUsaTrilha('/parceiro/carteira')).toBe(true)
    expect(rotaUsaTrilha('/auth/login')).toBe(true)
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
