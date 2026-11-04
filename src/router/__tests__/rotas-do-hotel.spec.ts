/**
 * As rotas do hotel que o mapeamento de arquivos produz.
 *
 * A armadilha aqui é a mesma que `file-routes.spec.ts` guarda para o paciente: um destino estático
 * e um dinâmico que moram lado a lado. `/hotel/reservas` e `/hotel/reserva/:reservaId` só não
 * colidem porque o segmento é diferente no plural — e é o tipo de coisa que alguém "arruma" ao
 * renomear um arquivo, transformando a lista de reservas no detalhe de uma reserva chamada
 * "reservas".
 *
 * O trilho entra junto: uma rota do hotel que marque a seção errada no menu é um defeito visível
 * e silencioso ao mesmo tempo — a tela certa abre debaixo do rótulo errado.
 */

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { resolveActiveSectionId } from '@/composables/useAppNavigation'

import { routes } from '../file-routes'

function resolver(caminho: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })

  return router.resolve(caminho)
}

const TELAS = [
  '/hotel/painel',
  '/hotel/rotina',
  '/hotel/mapa',
  '/hotel/reservas',
  '/hotel/hospedes',
  '/hotel/acomodacoes',
  '/hotel/rotina-padrao',
  '/hotel/resumo',
]

describe('rotas do hotel', () => {
  it.each(TELAS)('%s resolve para uma página de verdade', (caminho) => {
    const resolvida = resolver(caminho)

    /* O catch-all de "não encontrado" tem `(.*)*` no caminho: cair nele é não ter a tela. */
    expect(resolvida.matched.some((registro) => registro.path.includes('(.*)*'))).toBe(false)
    expect(resolvida.name).toBe(caminho.replace(/^\//, '').replace(/\//g, '-'))
  })

  it('leva /hotel/reservas à lista, e não ao detalhe de uma reserva', () => {
    const resolvida = resolver('/hotel/reservas')

    expect(resolvida.name).toBe('hotel-reservas')
    expect(resolvida.params.reservaId).toBeUndefined()
  })

  it('resolve o detalhe de uma reserva e o de uma estadia', () => {
    expect(resolver('/hotel/reserva/res-bidu').params.reservaId).toBe('res-bidu')
    expect(resolver('/hotel/hospedagem/hosp-tofu').params.hospedagemId).toBe('hosp-tofu')
  })

  it('põe as rotas estáticas antes das dinâmicas', () => {
    /* É esta ordem que o teste acima depende; afirmá-la aqui explica por que ele passa. */
    const posicaoDe = (caminho: string) => routes.findIndex((rota) => rota.path === caminho)

    expect(posicaoDe('/hotel/reservas')).toBeLessThan(posicaoDe('/hotel/reserva/:reservaId'))
  })

  it('toda tela do hotel marca a seção do hotel no trilho', () => {
    for (const caminho of [...TELAS, '/hotel/reserva/res-bidu', '/hotel/hospedagem/hosp-tofu']) {
      expect(resolveActiveSectionId(caminho, true), caminho).toBe('hotel')
    }
  })

  it('e nenhuma outra seção rouba as rotas do hotel', () => {
    expect(resolveActiveSectionId('/clinica/agenda', true)).toBe('clinical')
    expect(resolveActiveSectionId('/parceiro/carteira', true)).toBe('portal')
    expect(resolveActiveSectionId('/inicio', true)).toBe('overview')
  })
})
