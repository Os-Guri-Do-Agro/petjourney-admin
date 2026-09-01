<script setup lang="ts">
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'

import AppShell from '@/components/layout/AppShell.vue'
import { instalarSequenciaSecreta, rotaPertenceAoModulo } from '@/composables/useModuloClinico'
import { authSessionVersion, isAuthenticated } from '@/service/auth/auth-session'

const { t } = useI18n()
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
 * A sequência oculta que liga e desliga o módulo clínico.
 *
 * Mora aqui, na raiz, porque precisa valer em qualquer tela — inclusive na de login, onde não
 * há menu para ligar. O aviso é curto e não diz o nome da sequência: quem a digitou já sabe
 * qual é, e um toast explicando o atalho o transformaria em documentação na tela.
 */
let desinstalar = () => {}

onMounted(() => {
  desinstalar = instalarSequenciaSecreta((ativo) => {
    toast.add({
      severity: ativo ? 'success' : 'info',
      summary: t(ativo ? 'clinico.modulo.visivel' : 'clinico.modulo.oculto'),
      life: 2500,
    })

    /*
     * Desligar estando dentro do módulo deixaria a pessoa numa tela que acabou de deixar de
     * existir. Sai para o início; o guard faria o mesmo na próxima navegação, mas só depois de
     * ela tentar clicar em alguma coisa.
     */
    if (!ativo && rotaPertenceAoModulo(route.path)) {
      void router.replace('/inicio')
    }
  })
})

onBeforeUnmount(() => desinstalar())
</script>

<template>
  <Toast
    position="top-right"
    :pt="{
      messageIcon: { style: 'display: none' },
    }"
  />

  <AppShell v-if="shouldUseShell">
    <RouterView />
  </AppShell>

  <RouterView v-else />
</template>
