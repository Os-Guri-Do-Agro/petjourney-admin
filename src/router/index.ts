import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import { podeAbrirCaminho, rotaDoModulo } from '@/navegacao/rotas-dos-modulos'
import { isAuthenticated } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'

import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

import { tirarTokenDoConvite } from './convite-da-equipe'
import { routes } from './file-routes'
import { moduloDaPaginaAberta } from './paginas-abertas'

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

router.beforeEach(async (to) => {
  const hasActiveSession = isAuthenticated()
  const isPublicRoute = publicRoutes.has(to.path)

  /* O token do convite para a equipe sai da URL antes de qualquer outra decisão. */
  const semToken = tirarTokenDoConvite(to)

  if (semToken) {
    return semToken
  }

  const { ativo: demonstracao } = useModoDemonstracao()

  /*
   * A página de agendamento da clínica e a de reserva do hotel, de quem não tem conta. Ainda rodam
   * sobre os dados locais: só abrem na demonstração, até a E3-05 e a E7-03 ligarem as páginas às
   * rotas `/public` da API. Ver `paginas-abertas.ts`.
   */
  if (moduloDaPaginaAberta(to.path)) {
    if (demonstracao.value) {
      return true
    }

    return hasActiveSession ? getDefaultLandingPath() : { path: '/auth/login' }
  }

  /*
   * Tela de Clínica ou Hotel: abre com o módulo ligado no servidor, a permissão da conta e a tela
   * já integrada, ou na demonstração (`navegacao/rotas-dos-modulos.ts`). Menu escondido não basta:
   * sem esta guarda, quem tem `/veterinario/agenda` no histórico continuaria entrando.
   */
  if (hasActiveSession && rotaDoModulo(to.path) && !demonstracao.value) {
    const store = useParceiroStore()

    if (store.loadState !== 'ready') {
      await store.bootstrap().catch(() => undefined)
    }

    const liberada = podeAbrirCaminho(to.path, {
      demonstracao: false,
      podeLer: (modulo) => store.modulo(modulo)?.podeLer ?? false,
      temPermissao: (permissao) => store.temPermissao(permissao),
    })

    if (!liberada) {
      return getDefaultLandingPath()
    }
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
