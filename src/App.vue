<script setup lang="ts">
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'

import AppShell from '@/components/layout/AppShell.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { isRTLLocale, type Locale } from '@/i18n/locales'
import { moduloDaPaginaAberta } from '@/router/paginas-abertas'
import { EVENTO_SESSAO_EXPIRADA } from '@/service/api'
import { authSessionVersion, isAuthenticated } from '@/service/auth/auth-session'
import { useClasseDoDesignTrilha } from '@/theme/trilha/rotas'

const { t, locale } = useI18n()

/** O Toast do PrimeVue posiciona pelo lado físico: no árabe o canto de leitura é o esquerdo. */
const toastPosition = computed(() =>
  isRTLLocale(locale.value as Locale) ? 'top-left' : 'top-right',
)
const route = useRoute()
const router = useRouter()
const toast = useToast()
const publicRoutes = new Set(['/auth/login', '/auth/register', '/auth/forgot-password'])

/* As telas já no design Trilha levam `trilha` na raiz — ver `theme/trilha/rotas.ts`. */
useClasseDoDesignTrilha()

function isNotFoundRoute() {
  return route.matched.some((record) => record.path.includes('(.*)*'))
}

const shouldUseShell = computed(() => {
  const hasSessionVersion = authSessionVersion.value >= 0

  return (
    hasSessionVersion &&
    isAuthenticated() &&
    !publicRoutes.has(route.path) &&
    /* A página de agendamento é do responsável: sem o menu do parceiro, mesmo com sessão. */
    !moduloDaPaginaAberta(route.path) &&
    !isNotFoundRoute()
  )
})

/**
 * A API disse que a sessão caiu no meio do uso (token vencido ou revogado). Sem isto a moldura
 * sumia e a tela ficava aberta, sem menu e sem explicação, até o próximo clique. Volta para a
 * entrada com o caminho de agora, para continuar de onde parou.
 */
let saindoPorSessaoExpirada = false

function aoExpirarSessao() {
  /* Várias chamadas em voo voltam 401 juntas: um aviso e uma ida à entrada bastam. */
  if (saindoPorSessaoExpirada || publicRoutes.has(route.path) || moduloDaPaginaAberta(route.path)) {
    return
  }

  saindoPorSessaoExpirada = true
  toast.add({
    severity: 'warn',
    summary: t('auth.login.sessaoExpirada'),
    detail: t('auth.login.sessaoExpiradaDetalhe'),
    life: 6000,
  })

  void router.replace({ path: '/auth/login', query: { redirect: route.fullPath } }).finally(() => {
    saindoPorSessaoExpirada = false
  })
}

onMounted(() => {
  window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirarSessao)
})

onBeforeUnmount(() => {
  window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirarSessao)
})
</script>

<template>
  <Toast
    :position="toastPosition"
    :pt="{
      messageIcon: { style: 'display: none' },
    }"
  />

  <AppShell v-if="shouldUseShell">
    <!--
      Na primeira carga a tela chega em pedaço separado: até ele chegar, a faixa e o "Carregando"
      no lugar da área em branco ao lado do menu.
    -->
    <RouterView v-slot="{ Component }">
      <component :is="Component" v-if="Component" />
      <UiPagina v-else carregando sem-abas />
    </RouterView>
  </AppShell>

  <RouterView v-else />
</template>
