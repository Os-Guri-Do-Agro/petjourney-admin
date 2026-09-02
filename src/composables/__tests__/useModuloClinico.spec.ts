/**
 * Interruptor oculto do módulo clínico.
 *
 * O que estes testes protegem é o modo de falhar mais caro deste recurso: **abrir sozinho**.
 * Uma regressão que faça o módulo nascer ligado devolve telas de dados fictícios para dentro do
 * portal de quem está trabalhando, e ninguém reporta isso como bug — reporta como "o sistema
 * está mostrando pacientes que não são meus".
 *
 * Aconteceu em produção: `localStorage` é do **navegador**, não da conta, e enquanto o valor
 * gravado era apenas `true` ele sobrevivia ao logout. Quem tinha ligado o módulo uma vez para
 * demonstrar continuava vendo as telas mocadas depois — inclusive numa conta recém-criada. Os
 * testes de "o dono da sessão" existem por causa disso e não devem ser afrouxados.
 */

import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Sessão controlável pelo teste. Precisa ser içada: o mock é avaliado antes dos imports. */
const sessao = vi.hoisted(() => ({ usuario: null as { userId: string } | null }))

vi.mock('@/service/auth/auth-session', () => ({
  authSessionVersion: ref(0),
  getAuthUser: () => sessao.usuario,
}))

import { authSessionVersion } from '@/service/auth/auth-session'

import {
  aplicarParametroDaUrl,
  definirModuloClinico,
  rotaPertenceAoModulo,
  useModuloClinico,
} from '../useModuloClinico'

/** Simula login, logout e renovação de token: tudo passa pelo mesmo sinal de sessão. */
async function entrarComo(userId: string | null) {
  sessao.usuario = userId ? { userId } : null
  authSessionVersion.value += 1
  await nextTick()
}

function ativo() {
  return useModuloClinico().ativo.value
}

beforeEach(async () => {
  window.localStorage.clear()
  await entrarComo(null)
  definirModuloClinico(false)
})

describe('estado do módulo', () => {
  it('nasce desligado', () => {
    expect(ativo()).toBe(false)
  })

  it('liga e desliga, e persiste', async () => {
    await entrarComo('user-ana')
    definirModuloClinico(true)

    expect(ativo()).toBe(true)
    /** O que se grava é o dono, não um booleano — é o que prende o módulo à conta. */
    expect(window.localStorage.getItem('clinic.moduleUnlocked')).toBe('user-ana')

    definirModuloClinico(false)

    /** Desligado some da chave em vez de virar "false": estado ausente é o padrão. */
    expect(window.localStorage.getItem('clinic.moduleUnlocked')).toBeNull()
  })
})

describe('o dono da sessão', () => {
  it('conta nova na mesma máquina não herda o módulo ligado', async () => {
    /**
     * A regressão de produção, exatamente como aconteceu: alguém liga o módulo para demonstrar,
     * cria uma conta depois no mesmo navegador, e as telas de teste estão lá.
     */
    await entrarComo('user-ana')
    definirModuloClinico(true)
    expect(ativo()).toBe(true)

    await entrarComo('user-bruno')

    expect(ativo()).toBe(false)
    /** A chave continua gravada — o que mudou é que ela não é dele. */
    expect(window.localStorage.getItem('clinic.moduleUnlocked')).toBe('user-ana')
  })

  it('logout esconde o módulo', async () => {
    await entrarComo('user-ana')
    definirModuloClinico(true)

    await entrarComo(null)

    expect(ativo()).toBe(false)
  })

  it('o dono reencontra o módulo ligado ao voltar', async () => {
    /* Sair e entrar de novo na própria conta não é troca de contexto; religar seria ruído. */
    await entrarComo('user-ana')
    definirModuloClinico(true)
    await entrarComo(null)
    await entrarComo('user-ana')

    expect(ativo()).toBe(true)
  })

  it('renovação de token não desliga nada', async () => {
    /**
     * `refreshAuthSession` passa por `setAuthSession`, que emite o sinal de sessão. Se o módulo
     * reagisse ao sinal em vez de reagir ao **dono**, ele apagaria sozinho no meio de uma
     * apresentação, na hora em que o token vencesse.
     */
    await entrarComo('user-ana')
    definirModuloClinico(true)

    await entrarComo('user-ana')

    expect(ativo()).toBe(true)
  })
})

describe('ligar antes de entrar', () => {
  it('o link vale para quem entrar em seguida', async () => {
    /* `?clinico=on` cai na tela de login: é antes do login que ele é usado. */
    aplicarParametroDaUrl('on')
    expect(ativo()).toBe(true)

    await entrarComo('user-ana')

    expect(ativo()).toBe(true)
    expect(window.localStorage.getItem('clinic.moduleUnlocked')).toBe('user-ana')
  })

  it('e para mais ninguém depois disso', async () => {
    /** O ponto: o desbloqueio anônimo tem que virar dono, não virar coringa permanente. */
    aplicarParametroDaUrl('on')
    await entrarComo('user-ana')
    await entrarComo('user-bruno')

    expect(ativo()).toBe(false)
  })
})

describe('parâmetro da URL', () => {
  it('liga com as formas afirmativas', () => {
    for (const valor of ['on', '1', 'true', 'sim', 'ON']) {
      definirModuloClinico(false)

      expect(aplicarParametroDaUrl(valor), valor).toBe(true)
      expect(ativo(), valor).toBe(true)
    }
  })

  it('desliga com as formas negativas', () => {
    for (const valor of ['off', '0', 'false', 'nao']) {
      definirModuloClinico(true)

      expect(aplicarParametroDaUrl(valor), valor).toBe(true)
      expect(ativo(), valor).toBe(false)
    }
  })

  it('ignora o que não reconhece, sem mexer no estado', () => {
    definirModuloClinico(true)

    expect(aplicarParametroDaUrl('talvez')).toBe(false)
    expect(aplicarParametroDaUrl(undefined)).toBe(false)
    expect(aplicarParametroDaUrl(123)).toBe(false)
    /** O ponto: parâmetro estranho não pode desligar o que estava ligado. */
    expect(ativo()).toBe(true)
  })

  it('aceita o parâmetro repetido na query, usando o primeiro', () => {
    expect(aplicarParametroDaUrl(['on', 'off'])).toBe(true)
    expect(ativo()).toBe(true)
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
