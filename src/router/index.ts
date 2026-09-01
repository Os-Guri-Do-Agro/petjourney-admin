import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { EQUIPE_MENU_ENABLED } from '@/composables/useAppNavigation'
import {
  aplicarParametroDaUrl,
  PARAMETRO_DO_MODULO,
  rotaPertenceAoModulo,
  useModuloClinico,
} from '@/composables/useModuloClinico'
import { isAuthenticated } from '@/service/auth/auth-session'

import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

import { routes } from './file-routes'

const partnerLegacyRedirects: RouteRecordRaw[] = [
  { path: '/parceiro', redirect: '/inicio' },
  { path: '/veterinario', redirect: '/inicio' },
  /*
   * Compartilhamentos do menu Pets era uma segunda porta para o mesmo cômodo.
   *
   * O acesso temporário que o responsável concede ao prestador tem uma tela só, e ela existe:
   * `/parceiro/acessos`. A entrada em `/veterinario` nasceu na fase de mock do módulo clínico,
   * antes de a de portal ser entregue, e nunca passou de um cartão de "indisponível".
   * Redireciona em vez de sumir porque quem tem o link salvo merece cair na tela que funciona.
   */
  { path: '/veterinario/compartilhamentos', redirect: '/parceiro/acessos' },
  ...(EQUIPE_MENU_ENABLED
    ? []
    : [{ path: '/parceiro/equipe', redirect: '/inicio' } satisfies RouteRecordRaw]),
  {
    path: '/parceiro/status',
    redirect: { path: '/settings', query: { aba: 'empresa' } },
  },
  {
    path: '/parceiro/indicacao',
    redirect: { path: '/parceiro/divulgacao', hash: '#indicacao' },
  },
  {
    path: '/parceiro/cupons',
    redirect: { path: '/parceiro/divulgacao', hash: '#cupons' },
  },
  {
    path: '/parceiro/resgates',
    redirect: { path: '/parceiro/divulgacao', hash: '#resgates' },
  },
  {
    path: '/parceiro/carteira/extrato',
    redirect: { path: '/parceiro/carteira', query: { aba: 'extrato' } },
  },
  {
    path: '/parceiro/carteira/saques',
    redirect: { path: '/parceiro/carteira', query: { aba: 'saques' } },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...partnerLegacyRedirects, ...routes],
})

const publicRoutes = new Set(['/auth/login', '/auth/register', '/auth/forgot-password'])

function getSafeRedirectPath(redirect: unknown) {
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    if (redirect === '/tutor' || redirect === '/inicio' || redirect === '/parceiro' || redirect === '/veterinario') {
      return getDefaultLandingPath()
    }

    return redirect
  }

  return getDefaultLandingPath()
}

router.beforeEach((to) => {
  const hasActiveSession = isAuthenticated()
  const isPublicRoute = publicRoutes.has(to.path)

  /*
   * O interruptor oculto do módulo clínico.
   *
   * O parâmetro é lido em **qualquer** rota, não só nas clínicas: é assim que o link de
   * demonstração funciona a partir de onde a pessoa já estiver. Depois de aplicado, ele sai da
   * URL — `?clinico=on` colado na barra de endereço transforma o caminho oculto numa placa, e
   * qualquer captura de tela o entregaria.
   */
  if (aplicarParametroDaUrl(to.query[PARAMETRO_DO_MODULO])) {
    const query = { ...to.query }

    delete query[PARAMETRO_DO_MODULO]

    return { path: to.path, query, hash: to.hash, replace: true }
  }

  /*
   * Menu escondido não basta: sem esta guarda, quem tem `/veterinario/agenda` no histórico do
   * navegador continuaria entrando. Redireciona para o início em vez de mostrar "não
   * encontrado" — a rota existe, só não é para ser alcançada assim.
   */
  if (hasActiveSession && rotaPertenceAoModulo(to.path) && !useModuloClinico().ativo.value) {
    return getDefaultLandingPath()
  }

  if (to.path === '/' || to.path === '/tutor') {
    return hasActiveSession
      ? getDefaultLandingPath()
      : {
          path: '/auth/login',
          query: {
            redirect: getDefaultLandingPath(),
          },
        }
  }

  if (!hasActiveSession && !isPublicRoute) {
    return {
      path: '/auth/login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (hasActiveSession && isPublicRoute) {
    return to.path === '/auth/login' ? getSafeRedirectPath(to.query.redirect) : getDefaultLandingPath()
  }

  return true
})

export default router
