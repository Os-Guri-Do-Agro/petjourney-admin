<script setup lang="ts">
/**
 * A moldura da entrada — login, criar conta e redefinir senha. É a primeira coisa que alguém vê do
 * PetJourney, então diz quem somos antes de pedir qualquer coisa.
 *
 * Em tela larga, duas metades: a marca de um lado, no verde-floresta da barra do portal, com a
 * pata, uma frase do que o portal faz por quem trabalha com pets e os três ganhos; o formulário do
 * outro, sozinho no claro, com o título, uma frase e os campos. No celular, uma coluna: a marca
 * vira uma faixa curta no alto, e o formulário vem logo abaixo, sem rolar até ele.
 *
 * `eyebrow` continua aceito, mas não aparece: sobretítulo em caixa alta acima do título saiu do
 * sistema. Quem precisa dizer "passo 1 de 2" usa os passos (`RegisterStepIndicator`).
 */
import { useI18n } from 'vue-i18n'

import logoNomeUrl from '@/assets/Logos/logo-for-dark-theme.png'
import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'

defineProps<{
  eyebrow?: string
  title: string
  description: string
}>()

const { t } = useI18n()

const ganhos = [
  { id: 'programs', icone: 'ph ph-hand-heart' },
  { id: 'indicacao', icone: 'ph ph-qr-code' },
  { id: 'results', icone: 'ph ph-chart-line-up' },
] as const
</script>

<template>
  <main class="entrada">
    <aside class="entrada__marca">
      <!-- A trilha da marca, os nós ligados da pata, como no painel de abertura do portal. -->
      <svg
        class="marca__trilha"
        viewBox="0 0 480 640"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d="M 520 40 C 400 60 380 170 300 190 S 140 170 120 280 S 260 420 210 520 S 60 600 -40 660"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="2 9"
        />
        <circle cx="300" cy="190" r="5" />
        <circle cx="128" cy="300" r="3.5" />
        <circle cx="212" cy="500" r="4.5" />
      </svg>

      <div class="marca__topo">
        <span class="marca__pata" aria-hidden="true"><img src="/pata-escura.png" alt="" /></span>
        <img class="marca__nome" :src="logoNomeUrl" alt="PetJourney" />
        <LanguageSwitcher class="marca__idioma" variant="auth" tone="brand" />
      </div>

      <div class="marca__meio">
        <p class="marca__frase">{{ t('auth.layout.frase') }}</p>
        <p class="marca__apoio">{{ t('auth.layout.description') }}</p>

        <slot name="aside">
          <ul class="marca__ganhos">
            <li v-for="ganho in ganhos" :key="ganho.id">
              <span class="marca__disco" aria-hidden="true"><i :class="ganho.icone" /></span>
              {{ t(`auth.layout.benefits.${ganho.id}`) }}
            </li>
          </ul>
        </slot>
      </div>
    </aside>

    <section class="entrada__lado">
      <LanguageSwitcher class="entrada__idioma" variant="auth" tone="surface" />

      <div class="entrada__caixa">
        <div v-if="$slots.voltar" class="entrada__voltar">
          <slot name="voltar" />
        </div>

        <header class="entrada__cabeca">
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </header>

        <slot />
      </div>
    </section>
  </main>
</template>

<style scoped>
.entrada {
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 16px;
  gap: 16px;
  grid-template-columns: minmax(22rem, 0.92fr) minmax(0, 1.08fr);
  background: var(--fundo);
  color: var(--tinta);
  font-family: var(--font-texto);
}

/* ------------------------------------------------------------------ a marca */

.entrada__marca {
  --marca-fundo: var(--rail);

  position: sticky;
  top: 16px;
  display: flex;
  overflow: hidden;
  height: calc(100dvh - 32px);
  min-height: 34rem;
  flex-direction: column;
  padding: clamp(28px, 4vw, 48px);
  border-radius: 24px;
  isolation: isolate;
  background:
    radial-gradient(
      38rem 26rem at 100% 0%,
      color-mix(in oklab, var(--salvia) 26%, transparent),
      transparent 70%
    ),
    var(--marca-fundo);
  color: var(--sobre-rail);
}

/* No escuro o verde da barra é quase preto: a marca fica no musgo fundo, que ainda é floresta. */
.app-dark .entrada__marca {
  --marca-fundo: var(--musgo-fundo);
}

.marca__trilha {
  position: absolute;
  z-index: -1;
  inset: 0;
  width: 100%;
  height: 100%;
  color: rgb(255 255 255 / 22%);
  fill: rgb(255 255 255 / 30%);
  /* Só no canto de cima, à direita: atrás da frase e dos ganhos ela só atrapalharia a leitura. */
  mask-image: linear-gradient(215deg, #000 0%, #000 12%, transparent 34%);
}

/* A pata da marca, grande e quase sumida, saindo pelo canto de baixo. */
.entrada__marca::after {
  position: absolute;
  z-index: -1;
  bottom: -4rem;
  width: 26rem;
  aspect-ratio: 324 / 300;
  inset-inline-end: -5rem;
  background: url('/pata-clara.png') center / contain no-repeat;
  content: '';
  opacity: 0.07;
  transform: rotate(-12deg);
}

.marca__topo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.marca__pata {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: var(--sobre-rail);
}

.marca__pata img {
  width: 27px;
  height: 27px;
  object-fit: contain;
}

.marca__nome {
  width: 132px;
  height: auto;
}

.marca__idioma {
  display: none;
  margin-inline-start: auto;
}

.marca__meio {
  display: grid;
  max-width: 30rem;
  gap: 18px;
  margin-block: auto;
  padding-block: 32px;
}

.marca__frase {
  margin: 0;
  font-size: clamp(30px, 3.1vw, 42px);
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.12;
  text-wrap: balance;
}

.marca__apoio {
  margin: 0;
  color: var(--sobre-rail-2);
  font-size: 16px;
  line-height: 1.6;
}

.marca__ganhos {
  display: grid;
  gap: 12px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

/* Os ganhos em vidro, como os números do painel de abertura. */
.marca__ganhos li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid rgb(255 255 255 / 11%);
  border-radius: var(--raio-cartao-pequeno);
  background: rgb(255 255 255 / 6%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  backdrop-filter: blur(6px);
}

.marca__disco {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: linear-gradient(145deg, color-mix(in oklab, var(--salvia) 70%, #fff), var(--salvia));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 25%);
  color: var(--rail);
  font-size: 19px;
}

/* ------------------------------------------------------------------ o formulário */

.entrada__lado {
  position: relative;
  display: grid;
  min-width: 0;
  align-items: center;
  justify-items: center;
  padding: 72px clamp(16px, 4vw, 48px) 48px;
}

.entrada__idioma {
  position: absolute;
  top: 12px;
  inset-inline-end: 8px;
}

/* O formulário num cartão que flutua sobre o claro: o que se preenche junto vai junto. */
.entrada__caixa {
  display: grid;
  width: min(100%, 31rem);
  gap: 28px;
  padding: 36px 38px 34px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-painel);
  background: var(--superficie);
  box-shadow: var(--sombra-2);
}

.entrada__voltar :deep(a) {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.entrada__voltar :deep(a:hover) {
  color: var(--tinta);
}

.entrada__voltar :deep(a:focus-visible) {
  border-radius: 6px;
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

[dir='rtl'] .entrada__voltar :deep(.ph-arrow-left) {
  transform: scaleX(-1);
}

.entrada__voltar {
  margin-bottom: -16px;
}

.entrada__cabeca {
  display: grid;
  gap: 8px;
}

.entrada__cabeca h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.entrada__cabeca p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 15.5px;
  line-height: 1.55;
}

/* ------------------------------------------------------------------ celular */

@media (max-width: 900px) {
  .entrada {
    display: block;
    padding: 0;
  }

  .entrada__marca {
    position: relative;
    top: 0;
    height: auto;
    min-height: 0;
    padding: 16px 16px 24px;
    border-radius: 0 0 24px 24px;
  }

  .entrada__marca::after {
    bottom: -7rem;
    width: 15rem;
    inset-inline-end: -3rem;
  }

  .marca__pata {
    width: 38px;
    height: 38px;
    border-radius: 11px;
  }

  .marca__pata img {
    width: 23px;
    height: 23px;
  }

  .marca__nome {
    width: 112px;
  }

  .marca__idioma {
    display: block;
  }

  .marca__meio {
    margin: 0;
    padding: 20px 0 0;
  }

  .marca__frase {
    font-size: 23px;
  }

  .marca__apoio,
  .marca__ganhos {
    display: none;
  }

  .entrada__idioma {
    display: none;
  }

  .entrada__lado {
    display: block;
    padding: 28px 16px 40px;
  }

  .entrada__caixa {
    width: min(100%, 27rem);
    margin-inline: auto;
    gap: 24px;
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
  }

  .marca__trilha {
    display: none;
  }

  .entrada__cabeca h1 {
    font-size: 26px;
  }
}
</style>
