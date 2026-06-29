<script setup lang="ts">
import { computed } from 'vue'

import logoSemPata from '@/assets/Logos/logo-clara-em-row.png'
import bgLoginUrl from '@/assets/login/bg-login.jpg'
import { currentColors, isDarkMode } from '@/theme/color-mode'

defineProps<{
  eyebrow?: string
  title: string
  description: string
}>()

const logoUrl = computed(() => (isDarkMode.value ? '/pata-escura.png' : '/pata-clara.png'))

const authLayoutStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--auth-primary': colors.vet.primary,
    '--auth-sage': colors.vet.primary,
    '--auth-sage-strong': colors.auth.sageStrong,
    '--auth-sage-soft': colors.vet.secondary,
    '--auth-sage-tint': colors.auth.sageTint,
    '--auth-text': colors.auth.text,
    '--auth-muted': colors.auth.muted,
    '--auth-soft': colors.auth.soft,
    '--auth-line': colors.auth.line,
    '--auth-app-bg': colors.auth.appBg,
    '--auth-white': colors.auth.white,
  }
})
</script>

<template>
  <main class="auth-page" :style="authLayoutStyle">
    <section class="auth-shell">
      <div class="auth-form-panel">
        <div class="auth-form-panel__inner">
          <div class="flex gap-3 w-full mb-10">
            <div class="bg-color-icon p-3 bg-red-500 w-[50px] h-auto rounded-2xl flex">
              <img :src="logoUrl" alt="PetJourney" />
            </div>
            <div class="w-[150px] flex items-center">
              <img :src="logoSemPata" alt="Logo PetJourney" />
            </div>
          </div>

          <div class="auth-heading">
            <p v-if="eyebrow" class="auth-eyebrow">{{ eyebrow }}</p>
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>
          </div>

          <slot />
        </div>
      </div>

      <aside class="auth-visual-panel">
        <img class="auth-visual-panel__image" :src="bgLoginUrl" alt="" />
        <div class="auth-visual-panel__overlay" />
        <div class="auth-visual-ring" />
        <svg class="auth-visual-paw auth-visual-paw--top" viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="6.5" cy="10" rx="2.1" ry="2.7" />
          <ellipse cx="11" cy="7.4" rx="2.2" ry="2.9" />
          <ellipse cx="16" cy="8.6" rx="2.1" ry="2.7" />
          <ellipse cx="19.4" cy="12.6" rx="1.7" ry="2.2" />
          <path
            d="M11.7 11.4c-2.8 0-5.1 2.3-5.1 4.9 0 2 1.7 3.1 3.6 2.6 1-.26 2-.26 3 0 1.9.5 3.6-.6 3.6-2.6 0-2.6-2.3-4.9-5.1-4.9z"
          />
        </svg>
        <svg class="auth-visual-paw auth-visual-paw--middle" viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="6.5" cy="10" rx="2.1" ry="2.7" />
          <ellipse cx="11" cy="7.4" rx="2.2" ry="2.9" />
          <ellipse cx="16" cy="8.6" rx="2.1" ry="2.7" />
          <ellipse cx="19.4" cy="12.6" rx="1.7" ry="2.2" />
          <path
            d="M11.7 11.4c-2.8 0-5.1 2.3-5.1 4.9 0 2 1.7 3.1 3.6 2.6 1-.26 2-.26 3 0 1.9.5 3.6-.6 3.6-2.6 0-2.6-2.3-4.9-5.1-4.9z"
          />
        </svg>

        <div class="auth-visual-panel__content">
          <span class="auth-visual-kicker">Painel parceiro</span>

          <div class="auth-visual-panel__center">
            <div>
              <h2>Cuidado clínico organizado, do agendamento à alta.</h2>
              <p>
                Agenda, prontuários e acompanhamento de risco em um só lugar para uma rotina mais
                leve e segura.
              </p>
            </div>

            <slot name="aside">
              <ul class="auth-benefits">
                <li>
                  <i class="pi pi-check" aria-hidden="true" />
                  Agenda inteligente por sala e profissional
                </li>
                <li>
                  <i class="pi pi-check" aria-hidden="true" />
                  Prontuário completo e histórico clínico
                </li>
                <li>
                  <i class="pi pi-check" aria-hidden="true" />
                  Alertas de risco, alergia e retorno
                </li>
              </ul>
            </slot>
          </div>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  background: var(--auth-white);
  color: var(--auth-text);
  font-family: 'DM Sans', Inter, system-ui, sans-serif;
}

.bg-color-icon {
  background: var(--auth-sage);
}

.auth-shell {
  width: 100%;
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(32rem, 0.9fr) minmax(0, 1.1fr);
  overflow: hidden;
  background: var(--auth-white);
}

.auth-form-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(2.5rem, 5vw, 4.5rem);
}

.auth-form-panel__inner {
  width: min(100%, 32rem);
  justify-content: space-between;
}

.auth-brand {
  margin-bottom: 2.25rem;
}

.auth-brand img {
  display: block;
  width: 11.25rem;
  max-height: 3rem;
  object-fit: contain;
}

.auth-heading {
  margin-bottom: 2rem;
}

.auth-eyebrow {
  margin: 0 0 0.75rem;
  color: var(--auth-soft);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.auth-heading h1 {
  margin: 0;
  color: var(--auth-text);
  font-size: clamp(2rem, 3vw, 2.6rem);
  font-weight: 650;
  letter-spacing: -0.045em;
}

.auth-heading p {
  max-width: 30rem;
  margin: 0.75rem 0 0;
  color: var(--auth-muted);
  font-size: 1rem;
  line-height: 1.6;
}

.auth-visual-panel {
  position: relative;
  min-height: 100%;
  overflow: hidden;
  background: var(--auth-sage);
}

.auth-visual-panel__image,
.auth-visual-panel__overlay {
  position: absolute;
  inset: 0;
}

.auth-visual-panel__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.24;
  filter: saturate(0.75);
}

.auth-visual-panel__overlay {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--auth-sage-strong) 78%, var(--auth-text)),
    color-mix(in srgb, var(--auth-sage) 86%, var(--auth-text))
  );
}

.auth-visual-ring,
.auth-visual-paw {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

.auth-visual-ring {
  top: 17%;
  left: 8%;
  width: clamp(9rem, 14vw, 13rem);
  height: clamp(9rem, 14vw, 13rem);
  border: 1.5px solid color-mix(in srgb, var(--auth-white) 14%, transparent);
  border-radius: 999px;
}

.auth-visual-paw {
  width: 2.2rem;
  height: 2.2rem;
  fill: color-mix(in srgb, var(--auth-white) 15%, transparent);
}

.auth-visual-paw--top {
  top: 13%;
  right: 19%;
  transform: rotate(18deg);
}

.auth-visual-paw--middle {
  right: 14%;
  bottom: 32%;
  transform: rotate(-16deg);
}

.auth-visual-panel__content {
  position: relative;
  z-index: 1;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: clamp(2rem, 4vw, 3.5rem);
  padding: clamp(2.5rem, 5vw, 4.2rem);
  color: var(--auth-white);
}

.auth-visual-panel__center {
  display: grid;
  gap: clamp(2rem, 4vw, 3.5rem);
  margin-block: auto;
}

.auth-visual-kicker {
  color: color-mix(in srgb, var(--auth-white) 68%, transparent);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.auth-visual-panel h2 {
  max-width: 29rem;
  margin: 0;
  font-size: clamp(2.1rem, 4vw, 3.15rem);
  font-weight: 650;
  line-height: 1.06;
  letter-spacing: -0.055em;
}

.auth-visual-panel p {
  max-width: 31rem;
  margin: 1rem 0 0;
  color: color-mix(in srgb, var(--auth-white) 82%, transparent);
  font-size: 1rem;
  line-height: 1.65;
}

.auth-benefits {
  display: grid;
  gap: 0.95rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.auth-benefits li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: color-mix(in srgb, var(--auth-white) 90%, transparent);
  font-weight: 700;
}

.auth-benefits .pi {
  display: grid;
  width: 1.55rem;
  height: 1.55rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--auth-white) 16%, transparent);
  color: var(--auth-white);
  font-size: 0.78rem;
}

@media (max-width: 980px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }

  .auth-form-panel {
    max-width: none;
  }

  .auth-visual-panel {
    display: none;
  }
}

@media (max-width: 560px) {
  .auth-page {
    background: var(--auth-white);
  }

  .auth-shell {
    min-height: 100vh;
  }
}
</style>
