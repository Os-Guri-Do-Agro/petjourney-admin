/**
 * A tela cujo arquivo sumiu do servidor não pode deixar o clique sem resposta: recarrega na rota
 * pedida, uma vez só por janela.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  ehArquivoDeTelaFaltando,
  JANELA_ENTRE_RECARGAS_MS,
  recarregarSeATelaSumiu,
} from '../pagina-velha'

const ERRO_DO_CHROME = new TypeError(
  'Failed to fetch dynamically imported module: https://portal.petjourney.health/assets/_id_-DL2_IyQa.js',
)

function depsComRelogio(agora: number, ultima: string | null = null) {
  let gravado = ultima
  const recarregarEm = vi.fn()

  return {
    deps: {
      agora: () => agora,
      ler: () => gravado,
      gravar: (valor: string) => {
        gravado = valor
      },
      recarregarEm,
    },
    recarregarEm,
    gravado: () => gravado,
  }
}

describe('ehArquivoDeTelaFaltando', () => {
  it.each([
    ERRO_DO_CHROME.message,
    'error loading dynamically imported module: https://x/assets/a.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/_id_-Biwje_tN.css',
  ])('reconhece "%s"', (mensagem) => {
    expect(ehArquivoDeTelaFaltando(new Error(mensagem))).toBe(true)
  })

  it('não confunde com os outros erros da navegação', () => {
    expect(ehArquivoDeTelaFaltando(new Error('Network Error'))).toBe(false)
    expect(ehArquivoDeTelaFaltando(new TypeError('Cannot read properties of undefined'))).toBe(
      false,
    )
    expect(ehArquivoDeTelaFaltando(undefined)).toBe(false)
    expect(
      ehArquivoDeTelaFaltando({ message: 'Failed to fetch dynamically imported module' }),
    ).toBe(false)
  })
})

describe('recarregarSeATelaSumiu', () => {
  it('recarrega na rota que a pessoa pediu e marca a hora', () => {
    const { deps, recarregarEm, gravado } = depsComRelogio(1_000_000)

    expect(recarregarSeATelaSumiu(ERRO_DO_CHROME, '/parceiro/acessos/abc', deps)).toBe(true)
    expect(recarregarEm).toHaveBeenCalledExactlyOnceWith('/parceiro/acessos/abc')
    expect(gravado()).toBe('1000000')
  })

  it('não recarrega por erro de outra natureza', () => {
    const { deps, recarregarEm } = depsComRelogio(1_000_000)

    expect(recarregarSeATelaSumiu(new Error('boom'), '/parceiro/acessos/abc', deps)).toBe(false)
    expect(recarregarEm).not.toHaveBeenCalled()
  })

  it('não vira laço: com recarga recente, deixa o erro seguir', () => {
    const { deps, recarregarEm } = depsComRelogio(
      1_000_000 + JANELA_ENTRE_RECARGAS_MS - 1,
      '1000000',
    )

    expect(recarregarSeATelaSumiu(ERRO_DO_CHROME, '/parceiro/acessos/abc', deps)).toBe(false)
    expect(recarregarEm).not.toHaveBeenCalled()
  })

  it('passada a janela, recarrega de novo', () => {
    const { deps, recarregarEm } = depsComRelogio(1_000_000 + JANELA_ENTRE_RECARGAS_MS, '1000000')

    expect(recarregarSeATelaSumiu(ERRO_DO_CHROME, '/parceiro/acessos/abc', deps)).toBe(true)
    expect(recarregarEm).toHaveBeenCalledTimes(1)
  })

  it('marca guardada com lixo não trava a recarga', () => {
    const { deps, recarregarEm } = depsComRelogio(1_000_000, 'abc')

    expect(recarregarSeATelaSumiu(ERRO_DO_CHROME, '/inicio', deps)).toBe(true)
    expect(recarregarEm).toHaveBeenCalledWith('/inicio')
  })
})
