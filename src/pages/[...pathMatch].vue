<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import logoSemPata from '@/assets/Logos/logo-clara-em-row.png'
import AuthButton from '@/components/auth/AuthButton.vue'
import { isAuthenticated } from '@/service/auth/auth-session'
import { currentColors, isDarkMode } from '@/theme/color-mode'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const router = useRouter()

const logoIconUrl = computed(() => (isDarkMode.value ? '/pata-escura.png' : '/pata-clara.png'))

const homePath = computed(() =>
  isAuthenticated() ? getDefaultLandingPath() : '/auth/login',
)

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--nf-bg': colors.dashboard.bg,
    '--nf-card': colors.dashboard.surface,
    '--nf-surface': colors.dashboard.surfaceSoft,
    '--nf-line': colors.dashboard.line,
    '--nf-text': colors.dashboard.text,
    '--nf-muted': colors.dashboard.muted,
    '--nf-faint': colors.dashboard.faint,
    '--nf-primary': colors.vet.primary,
    '--nf-primary-soft': colors.vet.secondary,
    '--nf-primary-strong': colors.dashboard.primaryStrong,
    '--nf-shadow-rgb': colors.auth.shadowRgb,
  }
})

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  void router.push(homePath.value)
}
</script>

<template>
  <main class="not-found" :style="pageStyle">
    <div class="not-found__glow" aria-hidden="true" />

    <section class="not-found__card">
      <header class="not-found__brand">
        <div class="not-found__logo-badge" aria-hidden="true">
          <img :src="logoIconUrl" alt="" />
        </div>
        <img class="not-found__logo-wordmark" :src="logoSemPata" alt="PetJourney" />
      </header>

      <p class="not-found__code" aria-hidden="true">404</p>

      <div class="not-found__copy">
        <h1>Página não encontrada</h1>
        <p>
          O endereço que você acessou não existe ou foi movido. Verifique o link ou volte para a
          área principal do painel.
        </p>
      </div>

      <div class="not-found__actions">
        <AuthButton :to="homePath" full-width>
          Ir para o início
        </AuthButton>
        <AuthButton full-width variant="secondary" @click="goBack">
          Voltar
        </AuthButton>
      </div>
    </section>
  </main>
</template>

<style scoped>
.not-found {
  position: relative;
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  place-items: center;
  overflow: hidden;
  padding: 1.5rem;
  background:
    radial-gradient(
      120% 90% at 50% -10%,
      color-mix(in srgb, var(--nf-primary) 12%, transparent),
      transparent 55%
    ),
    var(--nf-bg);
  color: var(--nf-text);
}

.not-found__glow {
  position: absolute;
  inset: auto -10% 10% -10%;
  height: 18rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--nf-primary-soft) 35%, transparent);
  filter: blur(72px);
  pointer-events: none;
}

.not-found__card {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 1.35rem;
  width: min(28rem, 100%);
  padding: 1.75rem 1.6rem 1.5rem;
  border: 1px solid var(--nf-line);
  border-radius: 1.25rem;
  background: color-mix(in srgb, var(--nf-card) 92%, transparent);
  box-shadow: 0 24px 48px rgb(var(--nf-shadow-rgb) / 0.08);
}

.not-found__brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.not-found__logo-badge {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--nf-primary) 18%, var(--nf-card));
}

.not-found__logo-badge img {
  width: 1.35rem;
  height: 1.35rem;
}

.not-found__logo-wordmark {
  width: 7.5rem;
  height: auto;
}

.not-found__code {
  margin: 0;
  font-size: clamp(3.5rem, 12vw, 4.75rem);
  font-weight: 800;
  line-height: 0.9;
  letter-spacing: -0.06em;
  color: color-mix(in srgb, var(--nf-primary) 22%, var(--nf-faint));
}

.not-found__copy h1 {
  margin: 0 0 0.45rem;
  font-size: clamp(1.35rem, 3vw, 1.65rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.not-found__copy p {
  margin: 0;
  color: var(--nf-muted);
  font-size: 0.94rem;
  line-height: 1.55;
}

.not-found__actions {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.25rem;
}
</style>
