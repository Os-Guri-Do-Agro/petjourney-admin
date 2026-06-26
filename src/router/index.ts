import { createRouter, createWebHistory } from 'vue-router'

import { isAuthenticated } from '@/service/auth/auth-session'

import { routes } from './file-routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

const publicRoutes = new Set(['/auth/login', '/auth/register', '/auth/forgot-password'])
const vetDashboardPath = '/veterinario'

function getSafeRedirectPath(redirect: unknown) {
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    if (redirect === '/tutor') {
      return vetDashboardPath
    }

    return redirect
  }

  return vetDashboardPath
}

router.beforeEach((to) => {
  const hasActiveSession = isAuthenticated()
  const isPublicRoute = publicRoutes.has(to.path)

  if (to.path === '/tutor') {
    return hasActiveSession
      ? vetDashboardPath
      : {
          path: '/auth/login',
          query: {
            redirect: vetDashboardPath,
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
    return to.path === '/auth/login' ? getSafeRedirectPath(to.query.redirect) : vetDashboardPath
  }

  return true
})

export default router
