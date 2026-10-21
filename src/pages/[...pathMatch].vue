<script setup lang="ts">
/**
 * A página que não existe.
 *
 * Mora fora da moldura (sem a barra lateral), então ela mesma precisa dizer onde a pessoa está e
 * como voltar: a marca no alto, uma frase do que aconteceu, o endereço que foi aberto (quem copiou
 * um link errado vê o erro na hora) e as duas saídas — o Início, cheia, e voltar para onde estava.
 *
 * O desenho é a trilha do design system: pegadas que andam e param numa interrogação. É o único
 * enfeite da página, e ele também diz o que aconteceu.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import logoLightUrl from '@/assets/Logos/logo-clara-em-row.png'
import logoDarkUrl from '@/assets/Logos/logo-for-dark-theme.png'
import { isAuthenticated } from '@/service/auth/auth-session'
import { isDarkMode } from '@/theme/color-mode'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const logo = computed(() => (isDarkMode.value ? logoDarkUrl : logoLightUrl))

const homePath = computed(() => (isAuthenticated() ? getDefaultLandingPath() : '/auth/login'))

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  void router.push(homePath.value)
}
</script>

<template>
  <main class="perdido">
    <div class="perdido__miolo">
      <RouterLink class="perdido__marca" :to="homePath">
        <span class="perdido__pata" aria-hidden="true">
          <img src="/pata-clara.png" alt="" />
        </span>
        <img class="perdido__logo" :src="logo" :alt="t('errors.notFound.brandAlt')" />
      </RouterLink>

      <section class="perdido__folha" aria-labelledby="perdido-titulo">
        <!-- As pegadas andam e param: a trilha acaba aqui. -->
        <div class="trilha" aria-hidden="true">
          <i
            v-for="passo in 5"
            :key="passo"
            class="ph ph-paw-print trilha__pegada"
            :style="{ '--passo': passo }"
          />
          <span class="trilha__fim"><i class="ph ph-question" /></span>
        </div>

        <span class="ui-selo ui-selo--contorno perdido__selo">{{ t('errors.notFound.selo') }}</span>
        <h1 id="perdido-titulo" class="perdido__titulo">{{ t('errors.notFound.title') }}</h1>
        <p class="perdido__texto">{{ t('errors.notFound.body') }}</p>

        <p class="perdido__endereco">
          <span>{{ t('errors.notFound.endereco') }}</span>
          <bdi class="perdido__caminho" dir="ltr">{{ route.path }}</bdi>
        </p>

        <div class="perdido__acoes">
          <Button
            :as="RouterLink"
            :to="homePath"
            icon="ph ph-house"
            :label="t('errors.notFound.goHome')"
          />
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-arrow-left"
            class="perdido__voltar"
            :label="t('errors.notFound.back')"
            @click="goBack"
          />
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.perdido {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: 32px 16px;
  background:
    radial-gradient(
      60rem 28rem at 50% -8rem,
      color-mix(in oklab, var(--musgo-fundo) 70%, transparent),
      transparent 70%
    ),
    var(--fundo);
  color: var(--tinta);
  font-family: var(--font-texto);
}

.perdido__miolo {
  display: grid;
  width: min(30rem, 100%);
  justify-items: center;
  gap: 24px;
}

/* A marca: a pata no verde da barra (aqui não há barra) e o nome ao lado. */
.perdido__marca {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  text-decoration: none;
}

.perdido__marca:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 4px;
}

.perdido__pata {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 13px;
  background: var(--rail);
  box-shadow:
    var(--sombra-1),
    inset 0 1px 0 rgb(255 255 255 / 12%);
}

.perdido__pata img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.perdido__logo {
  width: 132px;
  height: auto;
}

/* A folha flutua sobre o claro, com a luz do lugar descendo do alto, como a cabeça dos cartões. */
.perdido__folha {
  display: grid;
  width: 100%;
  justify-items: center;
  gap: 10px;
  overflow: hidden;
  padding: 36px 32px 30px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-painel);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--musgo-fundo) 45%, var(--superficie)),
    var(--superficie) 44%
  );
  box-shadow: var(--sombra-2);
  text-align: center;
}

/* ------------------------------------------------------------------ a trilha */

.trilha {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

/* As pegadas alternam de lado, como um bicho andando, e vão sumindo até parar. */
.trilha__pegada {
  color: var(--salvia);
  font-size: 24px;
  opacity: calc(1 - (var(--passo) - 1) * 0.16);
  rotate: 90deg;
  translate: 0 -7px;
  animation: pegada-chega 420ms var(--pj-curva-chega) both;
  animation-delay: calc(var(--passo) * 110ms);
}

.trilha__pegada:nth-child(even) {
  translate: 0 7px;
}

[dir='rtl'] .trilha__pegada {
  rotate: -90deg;
}

.trilha__fim {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  margin-inline-start: 8px;
  border: 1.5px dashed var(--salvia);
  border-radius: 13px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--musgo);
  font-size: 22px;
  animation: pegada-chega 420ms var(--pj-curva-chega) both;
  animation-delay: 700ms;
}

@keyframes pegada-chega {
  from {
    opacity: 0;
    scale: 0.6;
  }
}

/* ------------------------------------------------------------------ o texto */

.perdido__selo {
  font-family: var(--font-dados);
}

.perdido__titulo {
  margin: 4px 0 0;
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.perdido__texto {
  max-width: 40ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 15px;
  line-height: 1.55;
}

.perdido__endereco {
  display: grid;
  max-width: 100%;
  justify-items: center;
  gap: 4px;
  margin: 8px 0 0;
  color: var(--tinta-3);
  font-size: 12.5px;
}

.perdido__caminho {
  max-width: 100%;
  overflow: hidden;
  padding: 5px 12px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-controle);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.perdido__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 14px;
}

.perdido__acoes :deep(a.p-button) {
  text-decoration: none;
}

[dir='rtl'] .perdido__voltar :deep(.p-button-icon) {
  scale: -1 1;
}

@media (max-width: 480px) {
  .perdido__folha {
    padding: 28px 18px 22px;
  }

  .perdido__acoes {
    display: grid;
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .trilha__pegada,
  .trilha__fim {
    animation: none;
  }
}
</style>
