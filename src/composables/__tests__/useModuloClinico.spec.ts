/**
 * Interruptor oculto do módulo clínico.
 *
 * O que estes testes protegem é o modo de falhar mais caro deste recurso: **abrir sozinho**.
 * Uma regressão que faça o módulo nascer ligado devolve telas de dados fictícios para dentro do
 * portal de quem está trabalhando, e ninguém reporta isso como bug — reporta como "o sistema
 * está mostrando pacientes que não são meus".
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  aplicarParametroDaUrl,
  definirModuloClinico,
  rotaPertenceAoModulo,
  useModuloClinico,
} from '../useModuloClinico'

describe('estado do módulo', () => {
  beforeEach(() => {
    window.localStorage.clear()
    definirModuloClinico(false)
  })

  it('nasce desligado', () => {
    expect(useModuloClinico().ativo.value).toBe(false)
  })

  it('liga e desliga, e persiste', () => {
    definirModuloClinico(true)

    expect(useModuloClinico().ativo.value).toBe(true)
    expect(window.localStorage.getItem('clinic.moduleUnlocked')).toBe('true')

    definirModuloClinico(false)

    /** Desligado some da chave em vez de virar "false": estado ausente é o padrão. */
    expect(window.localStorage.getItem('clinic.moduleUnlocked')).toBeNull()
  })
})

describe('parâmetro da URL', () => {
  beforeEach(() => {
    window.localStorage.clear()
    definirModuloClinico(false)
  })

  it('liga com as formas afirmativas', () => {
    for (const valor of ['on', '1', 'true', 'sim', 'ON']) {
      definirModuloClinico(false)

      expect(aplicarParametroDaUrl(valor), valor).toBe(true)
      expect(useModuloClinico().ativo.value, valor).toBe(true)
    }
  })

  it('desliga com as formas negativas', () => {
    for (const valor of ['off', '0', 'false', 'nao']) {
      definirModuloClinico(true)

      expect(aplicarParametroDaUrl(valor), valor).toBe(true)
      expect(useModuloClinico().ativo.value, valor).toBe(false)
    }
  })

  it('ignora o que não reconhece, sem mexer no estado', () => {
    definirModuloClinico(true)

    expect(aplicarParametroDaUrl('talvez')).toBe(false)
    expect(aplicarParametroDaUrl(undefined)).toBe(false)
    expect(aplicarParametroDaUrl(123)).toBe(false)
    /** O ponto: parâmetro estranho não pode desligar o que estava ligado. */
    expect(useModuloClinico().ativo.value).toBe(true)
  })

  it('aceita o parâmetro repetido na query, usando o primeiro', () => {
    expect(aplicarParametroDaUrl(['on', 'off'])).toBe(true)
    expect(useModuloClinico().ativo.value).toBe(true)
  })
})

describe('rotas do módulo', () => {
  it('reconhece as telas clínicas e a de referência', () => {
    expect(rotaPertenceAoModulo('/veterinario')).toBe(true)
    expect(rotaPertenceAoModulo('/veterinario/agenda')).toBe(true)
    expect(rotaPertenceAoModulo('/veterinario/paciente/pet-luna/historico')).toBe(true)
    expect(rotaPertenceAoModulo('/design/clinico')).toBe(true)
  })

  it('não confunde rota que apenas começa parecido', () => {
    /**
     * `/veterinarios` (plural) ou `/design/clinicoteste` não são do módulo. Comparar por
     * `startsWith` cru pegaria as duas e esconderia telas do portal por engano.
     */
    expect(rotaPertenceAoModulo('/veterinarios')).toBe(false)
    expect(rotaPertenceAoModulo('/design/clinicoteste')).toBe(false)
    expect(rotaPertenceAoModulo('/inicio')).toBe(false)
    expect(rotaPertenceAoModulo('/parceiro/acessos')).toBe(false)
  })
})
