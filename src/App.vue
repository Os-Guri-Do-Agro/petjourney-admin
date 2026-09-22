<script setup lang="ts">
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'

import AppShell from '@/components/layout/AppShell.vue'
import { moduloClinico, rotaPertenceAoModulo } from '@/composables/useModuloClinico'
import { moduloHotel, rotaPertenceAoHotel } from '@/composables/useModuloHotel'
import { instalarSequenciasSecretas } from '@/composables/useModuloOculto'
import { isRTLLocale, type Locale } from '@/i18n/locales'
import { authSessionVersion, isAuthenticated } from '@/service/auth/auth-session'

const { t, locale } = useI18n()

/** O Toast do PrimeVue posiciona pelo lado físico: no árabe o canto de leitura é o esquerdo. */
const toastPosition = computed(() =>
  isRTLLocale(locale.value as Locale) ? 'top-left' : 'top-right',
)
const route = useRoute()
const router = useRouter()
const toast = useToast()
const publicRoutes = new Set(['/auth/login', '/auth/register', '/auth/forgot-password'])

function isNotFoundRoute() {
  return route.matched.some((record) => record.path.includes('(.*)*'))
}

const shouldUseShell = computed(() => {
  const hasSessionVersion = authSessionVersion.value >= 0

  return (
    hasSessionVersion &&
    isAuthenticated() &&
    !publicRoutes.has(route.path) &&
    !isNotFoundRoute()
  )
})

/**
 * As sequências ocultas que ligam e desligam os módulos de demonstração.
 *
 * Moram aqui, na raiz, porque precisam valer em qualquer tela — inclusive na de login, onde não
 * há menu para ligar. O aviso é curto e não diz o nome da sequência: quem a digitou já sabe
 * qual é, e um toast explicando o atalho o transformaria em documentação na tela.
 *
 * Um ouvinte só para os dois módulos: dois `keydown` globais sobre o mesmo buffer seriam dois
 * lugares para esquecer a guarda de campo de texto.
 */
let desinstalar = () => {}

/**
 * Desligar estando dentro do módulo deixaria a pessoa numa tela que acabou de deixar de existir.
 * Sai para o início; o guard faria o mesmo na próxima navegação, mas só depois de ela tentar
 * clicar em alguma coisa.
 */
function anunciar(ativo: boolean, chaves: { visivel: string; oculto: string }, dentro: boolean) {
  toast.add({
    severity: ativo ? 'success' : 'info',
    summary: t(ativo ? chaves.visivel : chaves.oculto),
    life: 2500,
  })

  if (!ativo && dentro) {
    void router.replace('/inicio')
  }
}

onMounted(() => {
  desinstalar = instalarSequenciasSecretas([
    {
      modulo: moduloClinico,
      aoAlternar: (ativo) =>
        anunciar(
          ativo,
          { visivel: 'clinico.modulo.visivel', oculto: 'clinico.modulo.oculto' },
          rotaPertenceAoModulo(route.path),
        ),
    },
    {
      modulo: moduloHotel,
      aoAlternar: (ativo) =>
        anunciar(
          ativo,
          { visivel: 'hotel.modulo.visivel', oculto: 'hotel.modulo.oculto' },
          rotaPertenceAoHotel(route.path),
        ),
    },
  ])
})

onBeforeUnmount(() => desinstalar())
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
