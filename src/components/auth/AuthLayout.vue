<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import logoLightUrl from '@/assets/Logos/logo-clara-em-row.png'
import logoDarkUrl from '@/assets/Logos/logo-for-dark-theme.png'
import bgDarkUrl from '@/assets/login/login-dark-bg.jpg'
import bgLightUrl from '@/assets/login/login-ligth-bg.jpg'
import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'
import { useAuthThemeVars } from '@/composables/useAuthThemeVars'
import { isDarkMode } from '@/theme/color-mode'

defineProps<{
  eyebrow?: string
  title: string
  description: string
}>()

const { t } = useI18n()

const logoUrl = computed(() => (isDarkMode.value ? '/pata-escura.png' : '/pata-clara.png'))
const logoSemPata = computed(() => (isDarkMode.value ? logoDarkUrl : logoLightUrl))
const authLayoutStyle = useAuthThemeVars()

/**
 * A arte de fundo já traz a diagonal verde e a pata: a página inteira é a imagem,
 * o formulário fica sobre a área lisa e o texto sobre o verde.
 */
const authArtStyle = computed(() => ({
  '--auth-art': `url(${isDarkMode.value ? bgDarkUrl : bgLightUrl})`,
}))
</script>

<template>
  <main class="auth-page" :style="[authLayoutStyle, authArtStyle]">
    <section class="auth-shell">
      <div class="auth-form-panel">
        <div class="auth-form-panel__locale auth-form-panel__locale--mobile">
          <LanguageSwitcher variant="auth" tone="surface" />
        </div>
        <div class="auth-form-panel__inner">
          <div class="auth-brand-row">
            <div class="flex gap-3 w-full">
              <div class="bg-color-icon p-3 bg-red-500 w-[50px] h-auto rounded-2xl flex">
                <img :src="logoUrl" alt="PetJourney" />
              </div>
              <div class="w-[150px] flex items-center">
                <img :src="logoSemPata" alt="Logo PetJourney" />
              </div>
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
        <div class="auth-visual-panel__content">
          <div class="auth-visual-panel__top">
            <LanguageSwitcher variant="auth" tone="brand" />
          </div>

          <div class="auth-visual-panel__center">
            <div>
              <h2>{{ t('auth.layout.title') }}</h2>
              <p>{{ t('auth.layout.description') }}</p>
            </div>

            <slot name="aside">
              <ul class="auth-benefits">
                <li>
                  <i class="pi pi-check" aria-hidden="true" />
                  {{ t('auth.layout.benefits.programs') }}
                </li>
                <li>
                  <i class="pi pi-check" aria-hidden="true" />
                  {{ t('auth.layout.benefits.indicacao') }}
                </li>
                <li>
                  <i class="pi pi-check" aria-hidden="true" />
                  {{ t('auth.layout.benefits.results') }}
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
  background-color: var(--auth-page-bg);
  background-image: var(--auth-art);
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  /* Preso à viewport: em página alta (cadastro) a arte não estica nem some ao rolar. */
  background-attachment: fixed;
  color: var(--auth-text);
  font-family: 'DM Sans', Inter, system-ui, sans-serif;
}

.bg-color-icon {
  background: var(--auth-sage);
}

/* A coluna da direita fica dentro da faixa verde da arte em qualquer proporção de tela. */
.auth-shell {
  width: 100%;
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(19rem, 0.62fr);
  overflow: hidden;
}

/* Centrado na vertical, encostado à esquerda: em tela larga o formulário não
   caminha para a diagonal da arte. */
.auth-form-panel {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(2.5rem, 5vw, 4.5rem);
  padding-inline-start: clamp(2.5rem, 11vw, 12rem);
}

.auth-form-panel__locale--mobile {
  display: none;
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 2;
}

.auth-visual-panel__top {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
}

.auth-form-panel__inner {
  width: min(100%, 32rem);
  justify-content: space-between;
}

.auth-brand-row {
  display: flex;
  align-items: flex-start;
  width: 100%;
  margin-bottom: 2.5rem;
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
}

.auth-visual-panel__content {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  justify-content: flex-start;
  gap: clamp(1.5rem, 3vw, 2.5rem);
  padding: clamp(2rem, 4vw, 3.25rem) clamp(1.5rem, 3vw, 3rem) clamp(2rem, 4vw, 3.25rem) 0;
  color: var(--auth-on-brand);
}

/* No terço superior da arte: centrado no eixo, o texto desce até a pata.
   Medida curta de propósito — linha longa em tela larga cansa e desalinha o bloco. */
.auth-visual-panel__center {
  position: relative;
  /* Sem contexto próprio o véu de z-index negativo cairia atrás da arte da página. */
  isolation: isolate;
  display: grid;
  gap: clamp(1.5rem, 3vw, 2.5rem);
  max-width: 30rem;
  margin-top: clamp(1rem, 8vh, 6rem);
  margin-bottom: auto;
}

/* A pata da arte começa a ~62% da altura da imagem: em tela baixa (1600x900,
   1366x768) ela sobe até os benefícios e o texto branco some sobre o branco dela.
   O véu repõe o verde chapado da arte (#84C1B4, idêntico nos dois temas) atrás da
   copy — invisível sobre a faixa verde, opaco sobre a pata. Borda difusa para não
   marcar retângulo contra o JPEG. */
.auth-visual-panel__center::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -1.75rem -2.25rem;
  border-radius: 2.5rem;
  background: var(--auth-sage);
  filter: blur(1.25rem);
}

.auth-visual-panel h2 {
  margin: 0;
  font-size: clamp(1.9rem, 2.6vw, 2.75rem);
  font-weight: 650;
  line-height: 1.08;
  letter-spacing: -0.05em;
  /* Distribui as linhas do título em vez de deixar uma órfã curta no fim. */
  text-wrap: balance;
}

/* Sobre o verde da arte o texto já é limítrofe: branco cheio, sem transparência. */
.auth-visual-panel p {
  margin: 1rem 0 0;
  color: var(--auth-on-brand);
  font-size: 0.98rem;
  line-height: 1.6;
}

.auth-benefits {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.auth-benefits li {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  color: var(--auth-on-brand);
  font-size: 0.92rem;
  font-weight: 650;
}

.auth-benefits .pi {
  display: grid;
  width: 1.4rem;
  height: 1.4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--auth-on-brand) 16%, transparent);
  color: var(--auth-on-brand);
  font-size: 0.7rem;
}

/* Sem a coluna verde, a arte cortaria a diagonal no meio do formulário: fica só o fundo liso. */
@media (max-width: 980px) {
  .auth-page {
    background-image: none;
  }

  .auth-shell {
    grid-template-columns: 1fr;
  }

  .auth-form-panel {
    max-width: none;
    align-items: center;
    padding-inline-start: clamp(1.5rem, 5vw, 4.5rem);
  }

  .auth-form-panel__locale--mobile {
    display: block;
  }

  .auth-visual-panel {
    display: none;
  }
}
</style>
