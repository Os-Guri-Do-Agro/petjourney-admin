<script setup lang="ts">
/**
 * Stub de produção (sem dados mocados de clínica/equipe/integrações).
 * Implementação anterior arquivada em: src/_mocks/shared/settings.vue
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { clearAuthSession } from '@/service/auth/auth-session'
import { currentColors } from '@/theme/color-mode'

const router = useRouter()

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--settings-bg': colors.dashboard.bg,
    '--settings-card': colors.dashboard.surface,
    '--settings-line': colors.dashboard.line,
    '--settings-text': colors.dashboard.text,
    '--settings-muted': colors.dashboard.muted,
    '--settings-primary': colors.vet.primary,
    '--settings-warm-bg': colors.dashboard.warmBg,
    '--settings-warm-text': colors.dashboard.warmText,
    '--settings-shadow-rgb': colors.auth.shadowRgb,
  }
})

function handleLogout() {
  clearAuthSession()
  void router.push('/auth/login')
}
</script>

<template>
  <main class="settings-page" :style="pageStyle">
    <header class="settings-hero">
      <p class="settings-kicker">Conta</p>
      <h1>Configurações</h1>
      <p>
        Preferências avançadas de empresa, equipe e integrações ainda não estão disponíveis neste
        go-live.
      </p>
    </header>

    <article class="settings-card settings-card--danger">
      <h2>Sessão</h2>
      <p>Encerrar o acesso neste dispositivo.</p>
      <Button label="Sair da conta" severity="danger" outlined type="button" @click="handleLogout" />
    </article>
  </main>
</template>

<style scoped>
.settings-page {
  display: grid;
  gap: 1rem;
  max-width: 36rem;
  padding: 0.25rem 0 1.5rem;
}

.settings-hero h1 {
  margin: 0.2rem 0 0.5rem;
  font-size: 1.45rem;
  color: var(--settings-text);
}

.settings-kicker {
  margin: 0;
  color: var(--settings-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.settings-hero p {
  margin: 0;
  color: var(--settings-muted);
  font-size: 0.92rem;
  line-height: 1.5;
}

.settings-card {
  display: grid;
  gap: 0.55rem;
  padding: 1.2rem 1.25rem;
  border: 1px solid var(--settings-line);
  border-radius: 1rem;
  background: var(--settings-card);
  box-shadow: 0 12px 28px rgb(var(--settings-shadow-rgb) / 0.05);
}

.settings-card h2 {
  margin: 0;
  font-size: 1rem;
  color: var(--settings-text);
}

.settings-card p {
  margin: 0;
  color: var(--settings-muted);
  font-size: 0.88rem;
  line-height: 1.45;
}

.settings-card--danger {
  border-color: color-mix(in srgb, var(--settings-warm-text) 28%, var(--settings-line));
  background: color-mix(in srgb, var(--settings-warm-bg) 55%, var(--settings-card));
}
</style>
