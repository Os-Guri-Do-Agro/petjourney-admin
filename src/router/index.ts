import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { EQUIPE_MENU_ENABLED } from '@/composables/useAppNavigation'
import { isAuthenticated } from '@/service/auth/auth-session'

import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

import { routes } from './file-routes'

const partnerLegacyRedirects: RouteRecordRaw[] = [
  { path: '/parceiro', redirect: '/inicio' },
  { path: '/veterinario', redirect: '/inicio' },
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
