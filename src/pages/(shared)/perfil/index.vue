<script setup lang="ts">
/**
 * `/perfil` redireciona para Configurações → aba Perfil.
 * Conteúdo em: src/pages/(shared)/settings/index.vue
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  void router.replace({ path: '/settings', query: { aba: 'perfil' } })
})
</script>

<template>
  <div class="perfil-redirect" role="status" aria-live="polite">
    Redirecionando para configurações…
  </div>
</template>

<style scoped>
.perfil-redirect {
  padding: 2rem 1rem;
  color: var(--p-text-muted-color, #6b7a75);
  font-size: 0.92rem;
}
</style>
