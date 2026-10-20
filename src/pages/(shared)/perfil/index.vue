<script setup lang="ts">
/**
 * `/perfil` redireciona para Configurações → aba Perfil.
 * Conteúdo em: src/pages/(shared)/settings/index.vue
 */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

onMounted(() => {
  void router.replace({ path: '/settings', query: { aba: 'perfil' } })
})
</script>

<template>
  <div class="perfil-redirect" role="status" aria-live="polite">
    <span class="perfil-redirect__girando" aria-hidden="true" />
    {{ t('frame.loading') }}
  </div>
</template>

<style scoped>
.perfil-redirect {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 28px 32px;
  color: var(--tinta-2);
  font-size: 14.5px;
}

.perfil-redirect__girando {
  width: 18px;
  height: 18px;
  border: 2px solid var(--superficie-3);
  border-top-color: var(--musgo);
  border-radius: 50%;
  animation: girar 0.9s linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .perfil-redirect__girando {
    animation-duration: 2.4s;
  }
}
</style>
