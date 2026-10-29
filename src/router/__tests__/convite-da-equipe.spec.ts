/**
 * O link do convite para a equipe chega com `?token=` e precisa sair da URL antes de qualquer
 * outra decisão do roteador: sem sessão, a URL inteira iria para o `?redirect=` do login.
 *
 * O roteador de verdade carrega todas as páginas; aqui a guarda roda num roteador de memória com
 * as duas rotas que importam e a mesma ordem de decisão (token primeiro, sessão depois).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { lerTokenDoConvite } from '@/service/parceiro/convite-pendente'

import { ROTA_DO_CONVITE, tirarTokenDoConvite } from '../convite-da-equipe'

function roteadorSemSessao() {
  const vazia = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/login', component: vazia },
      { path: ROTA_DO_CONVITE, component: vazia },
      { path: '/inicio', component: vazia },
    ],
  })

  router.beforeEach((to) => {
    const semToken = tirarTokenDoConvite(to)

    if (semToken) {
      return semToken
    }

    if (to.path !== '/auth/login') {
      return { path: '/auth/login', query: { redirect: to.fullPath } }
    }

    return true
  })

  return router
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('tirarTokenDoConvite', () => {
  it('sem sessão: guarda o token e o login recebe o redirect sem ele', async () => {
    const router = roteadorSemSessao()

    await router.push('/parceiro/convite?token=abc123')

    expect(lerTokenDoConvite()).toBe('abc123')
    expect(router.currentRoute.value.path).toBe('/auth/login')
    expect(router.currentRoute.value.fullPath).not.toContain('abc123')
    expect(router.currentRoute.value.query.redirect).toBe('/parceiro/convite')
  })

  it('mantém o resto da query e tira só o token', async () => {
    const router = roteadorSemSessao()

    await router.push('/parceiro/convite?token=abc123&origem=email')

    expect(router.currentRoute.value.query.redirect).toBe('/parceiro/convite?origem=email')
  })

  it('não mexe em outras rotas nem no convite sem token', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })

    expect(tirarTokenDoConvite(router.resolve('/inicio?token=x'))).toBeNull()
    expect(tirarTokenDoConvite(router.resolve('/parceiro/convite'))).toBeNull()
    expect(lerTokenDoConvite()).toBeNull()
  })
})
