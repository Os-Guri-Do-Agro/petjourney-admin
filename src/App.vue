<script setup lang="ts">
import Toast from 'primevue/toast'
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import AppShell from '@/components/layout/AppShell.vue'
import { authSessionVersion, isAuthenticated } from '@/service/auth/auth-session'

const route = useRoute()
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
</script>

<template>
  <Toast />

  <AppShell v-if="shouldUseShell">
    <RouterView />
  </AppShell>

  <RouterView v-else />
</template>
