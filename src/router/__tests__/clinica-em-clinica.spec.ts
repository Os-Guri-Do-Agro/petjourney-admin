/**
 * O módulo da clínica mudou de endereço: `/veterinario/*` virou `/clinica/*` (PJ-RWQBMT).
 *
 * Link salvo, favorito, deep link de notificação e a rota que a API ainda manda nos contadores
 * (`/veterinario/agenda`) têm que continuar chegando à mesma tela, com a query e o hash. A única
 * exceção é a de antes: `/veterinario/compartilhamentos` vai para os acessos do portal.
 */

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { routes } from '../file-routes'
import { partnerLegacyRedirects } from '../index'

/* Só importa para onde a rota leva: as telas viram um componente vazio, sem carregar nada. */
const Vazio = { render: () => null }
const rotasSemTela: RouteRecordRaw[] = routes.map((rota) => ({ path: rota.path, component: Vazio }))

async function abrir(caminho: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [...partnerLegacyRedirects, ...rotasSemTela],
  })

  await router.push(caminho)

  return router.currentRoute.value
}

describe('o endereço antigo da clínica', () => {
  it('leva /veterinario/agenda a /clinica/agenda com a query e o hash', async () => {
    const rota = await abrir('/veterinario/agenda?data=2026-11-04&foco=apt-1#grade')

    expect(rota.path).toBe('/clinica/agenda')
    expect(rota.query).toEqual({ data: '2026-11-04', foco: 'apt-1' })
    expect(rota.hash).toBe('#grade')
  })

  it('leva caminhos fundos à mesma tela, com o parâmetro', async () => {
    const rota = await abrir('/veterinario/paciente/pet-luna/historico')

    expect(rota.path).toBe('/clinica/paciente/pet-luna/historico')
    expect(rota.params.petId).toBe('pet-luna')
  })

  it('mantém /veterinario/compartilhamentos nos acessos do portal', async () => {
    expect((await abrir('/veterinario/compartilhamentos')).path).toBe('/parceiro/acessos')
  })

  it('leva a raiz antiga e a nova ao Início', async () => {
    expect((await abrir('/veterinario')).path).toBe('/inicio')
    expect((await abrir('/clinica')).path).toBe('/inicio')
  })
})
