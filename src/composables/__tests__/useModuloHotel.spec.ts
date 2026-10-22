/**
 * Interruptor oculto do módulo hotel.
 *
 * O que estes testes protegem é o modo de falhar mais caro do recurso: **abrir sozinho**. Uma
 * regressão que faça o módulo nascer ligado devolve telas de dados fictícios para dentro do portal
 * de quem está trabalhando, e ninguém reporta isso como bug — reporta como "o sistema está
 * mostrando hóspedes que não são meus".
 *
 * Aconteceu em produção com o módulo clínico: `localStorage` é do **navegador**, não da conta, e
 * enquanto o valor gravado era apenas `true` ele sobrevivia ao logout. O hotel herda o mecanismo
 * corrigido (`useModuloOculto`), e estes testes existem para que a herança continue valendo.
 *
 * Os dois últimos blocos são o que a fábrica acrescentou de risco novo: **dois módulos
 * independentes** e **um ouvinte de teclado só para os dois**.
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

import { definirModuloClinico, moduloClinico, useModuloClinico } from '../useModuloClinico'
import {
  aplicarParametroDoHotel,
  definirModuloHotel,
  moduloHotel,
  rotaPertenceAoHotel,
  useModuloHotel,
} from '../useModuloHotel'
import { instalarSequenciasSecretas } from '../useModuloOculto'

async function entrarComo(userId: string | null) {
  sessao.usuario = userId ? { userId } : null
  authSessionVersion.value += 1
  await nextTick()
}

const ativo = () => useModuloHotel().ativo.value
const clinicoAtivo = () => useModuloClinico().ativo.value

beforeEach(async () => {
  window.localStorage.clear()
  await entrarComo(null)
  definirModuloHotel(false)
  definirModuloClinico(false)
})

describe('estado do módulo', () => {
  it('nasce desligado', () => {
    expect(ativo()).toBe(false)
  })

  it('liga e desliga, e persiste com o dono', async () => {
    await entrarComo('user-ana')
    definirModuloHotel(true)

    expect(ativo()).toBe(true)
    expect(window.localStorage.getItem('hotel.moduleUnlocked')).toBe('user-ana')

    definirModuloHotel(false)

    /** Desligado some da chave em vez de virar "false": estado ausente é o padrão. */
    expect(window.localStorage.getItem('hotel.moduleUnlocked')).toBeNull()
  })
})

describe('o dono da sessão', () => {
  it('conta nova na mesma máquina não herda o módulo ligado', async () => {
    await entrarComo('user-ana')
    definirModuloHotel(true)

    await entrarComo('user-bruno')

    expect(ativo()).toBe(false)
    /** A chave continua gravada — o que mudou é que ela não é dele. */
    expect(window.localStorage.getItem('hotel.moduleUnlocked')).toBe('user-ana')
  })

  it('logout esconde o módulo, e voltar o traz de volta', async () => {
    await entrarComo('user-ana')
    definirModuloHotel(true)

    await entrarComo(null)
    expect(ativo()).toBe(false)

    await entrarComo('user-ana')
    expect(ativo()).toBe(true)
  })

  it('o link vale para quem entrar em seguida, e para mais ninguém', async () => {
    /* `?hotel=on` cai na tela de login: é antes do login que ele é usado. */
    aplicarParametroDoHotel('on')
    expect(ativo()).toBe(true)

    await entrarComo('user-ana')
    expect(window.localStorage.getItem('hotel.moduleUnlocked')).toBe('user-ana')

    await entrarComo('user-bruno')
    expect(ativo()).toBe(false)
  })
})

describe('os dois módulos são independentes', () => {
  it('ligar o hotel não acende a clínica', async () => {
    /*
     * O ponto: uma casa pode ter os dois módulos e pode ter só um. Uma chave única faria a
     * demonstração do hotel abrir doze telas de prontuário para quem foi ver hospedagem.
     */
    await entrarComo('user-ana')
    definirModuloHotel(true)

    expect(ativo()).toBe(true)
    expect(clinicoAtivo()).toBe(false)
  })

  it('desligar um não desliga o outro', async () => {
    await entrarComo('user-ana')
    definirModuloHotel(true)
    definirModuloClinico(true)

    definirModuloClinico(false)

    expect(ativo()).toBe(true)
    expect(clinicoAtivo()).toBe(false)
  })

  it('cada um guarda a própria chave', async () => {
    await entrarComo('user-ana')
    definirModuloHotel(true)
    definirModuloClinico(true)

    expect(window.localStorage.getItem('hotel.moduleUnlocked')).toBe('user-ana')
    expect(window.localStorage.getItem('clinic.moduleUnlocked')).toBe('user-ana')
  })
})

describe('parâmetro da URL', () => {
  it('liga e desliga com as formas reconhecidas', () => {
    for (const valor of ['on', '1', 'true', 'sim', 'ON']) {
      definirModuloHotel(false)

      expect(aplicarParametroDoHotel(valor), valor).toBe(true)
      expect(ativo(), valor).toBe(true)
    }

    for (const valor of ['off', '0', 'false', 'nao']) {
      definirModuloHotel(true)

      expect(aplicarParametroDoHotel(valor), valor).toBe(true)
      expect(ativo(), valor).toBe(false)
    }
  })

  it('ignora o que não reconhece, sem mexer no estado', () => {
    definirModuloHotel(true)

    expect(aplicarParametroDoHotel('talvez')).toBe(false)
    expect(aplicarParametroDoHotel(undefined)).toBe(false)
    /** O ponto: parâmetro estranho não pode desligar o que estava ligado. */
    expect(ativo()).toBe(true)
  })
})

describe('rotas do módulo', () => {
  it('reconhece as telas do hotel', () => {
    expect(rotaPertenceAoHotel('/hotel')).toBe(true)
    expect(rotaPertenceAoHotel('/hotel/mapa')).toBe(true)
    expect(rotaPertenceAoHotel('/hotel/hospedagem/hosp-1')).toBe(true)
  })

  it('não confunde rota que apenas começa parecido', () => {
    /* `/hoteis` não é do módulo. Comparar por `startsWith` cru pegaria a rota errada. */
    expect(rotaPertenceAoHotel('/hoteis')).toBe(false)
    expect(rotaPertenceAoHotel('/inicio')).toBe(false)
    expect(rotaPertenceAoHotel('/veterinario/agenda')).toBe(false)
  })
})

describe('a sequência de teclas dos dois módulos', () => {
  function digitar(texto: string) {
    for (const letra of texto) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: letra }))
    }
  }

  it('cada palavra liga o seu módulo, com um ouvinte só', () => {
    /*
     * Um `keydown` global para os dois: dois ouvintes sobre o mesmo buffer seriam dois lugares
     * para esquecer a guarda de campo de texto.
     */
    /*
     * Instalado **sem** callback de propósito, e é o ponto do teste: o encadeamento opcional
     * curto-circuita a chamada inteira, argumentos inclusive. Com o código anterior — um
     * `aoAlternar?.(alternar())` numa linha só — a ausência de callback fazia a sequência de
     * teclas não alternar nada, e o defeito era invisível porque o único chamador do app sempre
     * passava callback.
     */
    const desinstalar = instalarSequenciasSecretas([
      { modulo: moduloClinico },
      { modulo: moduloHotel },
    ])

    digitar('hotel')
    expect(ativo()).toBe(true)
    expect(clinicoAtivo()).toBe(false)

    digitar('clinico')
    expect(clinicoAtivo()).toBe(true)

    /* De novo: a sequência é um alternador, não um botão de ligar. */
    digitar('hotel')
    expect(ativo()).toBe(false)

    desinstalar()
  })

  it('não dispara dentro de campo de texto', () => {
    /* Escrever "hotel" numa observação de reserva não pode desligar o módulo. */
    const desinstalar = instalarSequenciasSecretas([{ modulo: moduloHotel }])
    const campo = document.createElement('input')

    document.body.appendChild(campo)

    for (const letra of 'hotel') {
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: letra, bubbles: true }))
    }

    expect(ativo()).toBe(false)

    campo.remove()
    desinstalar()
  })

  it('ignora a sequência com tecla modificadora', () => {
    const desinstalar = instalarSequenciasSecretas([{ modulo: moduloHotel }])

    for (const letra of 'hotel') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: letra, ctrlKey: true }))
    }

    expect(ativo()).toBe(false)

    desinstalar()
  })
})
