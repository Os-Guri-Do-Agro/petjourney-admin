import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

import { guardarTokenDoConvite } from '@/service/parceiro/convite-pendente'

/** O link do e-mail de convite para a equipe (E0-01). */
export const ROTA_DO_CONVITE = '/parceiro/convite'

/**
 * Tira o `token` do link do convite da URL e o guarda (`convite-pendente.ts`).
 *
 * Roda antes de qualquer outra decisão da guarda: sem sessão, a regra seguinte mandaria a URL
 * inteira, com o token, para o `?redirect=` do login. Devolve o mesmo destino sem o token, ou
 * `null` quando não há nada a tirar.
 */
export function tirarTokenDoConvite(
  to: Pick<RouteLocationNormalized, 'path' | 'query' | 'hash'>,
): RouteLocationRaw | null {
  if (to.path !== ROTA_DO_CONVITE || typeof to.query.token !== 'string') {
    return null
  }

  guardarTokenDoConvite(to.query.token)
  const { token: _token, ...query } = to.query

  return { path: to.path, query, hash: to.hash, replace: true }
}
