/**
 * As rotas que o mapeamento de arquivos produz.
 *
 * O arquivo monta rota a partir de caminho, e há uma regra que não é óbvia lendo a pasta:
 * `paciente/novo.vue` e `paciente/[petId]/historico.vue` moram lado a lado, e é a ordenação por
 * `routePriority` que garante que `/veterinario/paciente/novo` caia na página de cadastro em vez
 * de ser lida como um `petId` chamado "novo". Sem esta prova, mover um arquivo de lugar quebraria
 * o cadastro de paciente de um jeito silencioso: a tela abriria, e mostraria o histórico de um
 * paciente que não existe.
 */

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { routes } from '../file-routes'

function resolver(caminho: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })

  return router.resolve(caminho)
}

describe('rotas por arquivo', () => {
  it('leva /veterinario/paciente/novo ao cadastro, e não ao histórico', () => {
    const resolvida = resolver('/veterinario/paciente/novo')

    expect(resolvida.name).toBe('veterinario-paciente-novo')
    expect(resolvida.params.petId).toBeUndefined()
  })

  it('continua resolvendo o histórico de um paciente de verdade', () => {
    const resolvida = resolver('/veterinario/paciente/pet-luna/historico')

    expect(resolvida.params.petId).toBe('pet-luna')
  })

  it('põe as rotas estáticas antes das dinâmicas', () => {
    /* É esta ordem que o teste acima depende; afirmá-la aqui explica por que ele passa. */
    const posicaoDe = (caminho: string) => routes.findIndex((rota) => rota.path === caminho)

    expect(posicaoDe('/veterinario/paciente/novo')).toBeLessThan(
      posicaoDe('/veterinario/paciente/:petId/historico'),
    )
  })
})
