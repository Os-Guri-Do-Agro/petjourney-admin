<script setup lang="ts">
import Toast from 'primevue/toast'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute } from 'vue-router'

import AppShell from '@/components/layout/AppShell.vue'
import { isRTLLocale, type Locale } from '@/i18n/locales'
import { moduloDaPaginaAberta } from '@/router/paginas-abertas'
import { authSessionVersion, isAuthenticated } from '@/service/auth/auth-session'
import { useClasseDoDesignTrilha } from '@/theme/trilha/rotas'

const { locale } = useI18n()

/** O Toast do PrimeVue posiciona pelo lado físico: no árabe o canto de leitura é o esquerdo. */
const toastPosition = computed(() =>
  isRTLLocale(locale.value as Locale) ? 'top-left' : 'top-right',
)
const route = useRoute()
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
</script>

<template>
  <Toast
    :position="toastPosition"
    :pt="{
      messageIcon: { style: 'display: none' },
    }"
  />

  <AppShell v-if="shouldUseShell">
    <RouterView />
  </AppShell>

  <RouterView v-else />
</template>
