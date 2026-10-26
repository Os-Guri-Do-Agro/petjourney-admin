<script setup lang="ts">
/**
 * A moldura da entrada (login, criar conta, redefinir senha), no layout de sempre: o formulário
 * sobre a área lisa da arte, à esquerda, e a mensagem da marca sobre o verde, à direita.
 *
 * Os elementos são os do portal de hoje: campo, botão, checkbox e passos do kit, a fonte e os
 * tokens do Trilha. As cores chegam às páginas pela família `--auth-*`, que o `trilha-tema.css`
 * aponta para os tokens do kit. Desde 26/10/2026 a entrada liga o tema do app na raiz
 * (`html.moldura-app`, o mesmo que o `AppShell` liga no portal): tinta marinho, ação na sálvia do
 * app, botão liso — o layout continua o mesmo.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import logoLightUrl from '@/assets/Logos/logo-clara-em-row.png'
import logoDarkUrl from '@/assets/Logos/logo-for-dark-theme.png'
import bgDarkUrl from '@/assets/login/login-dark-bg.jpg'
import bgLightUrl from '@/assets/login/login-ligth-bg.jpg'
import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'
import { isDarkMode } from '@/theme/color-mode'

defineProps<{
  eyebrow?: string
  title: string
  description: string
}>()

const { t } = useI18n()

const logoUrl = computed(() => (isDarkMode.value ? '/pata-escura.png' : '/pata-clara.png'))
const logoSemPata = computed(() => (isDarkMode.value ? logoDarkUrl : logoLightUrl))

/**
 * A arte de fundo já traz a diagonal verde e a pata: a página inteira é a imagem,
 * o formulário fica sobre a área lisa e o texto sobre o verde.
 */
const authArtStyle = computed(() => ({
  '--auth-art': `url(${isDarkMode.value ? bgDarkUrl : bgLightUrl})`,
}))

/*
 * A arte cobre a janela (1920 x 1080, centrada) e o alto da pata fica a 678 px da borda de cima
 * dela, medido no arquivo. Em tela baixa (1366 x 768, 1280 x 800) a pata sobe até os benefícios,
 * e só aí o véu verde entra atrás da copy. Em tela grande ela fica abaixo do texto, e o véu
 * pintava a cabeça da pata à toa.
 */
const ARTE = { largura: 1920, altura: 1080, topoDaPata: 678 }
/** Só encostar de verdade liga o véu: com folga, a borda dele pintava a cabeça da pata. */
const FOLGA_DA_PATA = 4

const centro = ref<HTMLElement | null>(null)
const textoSobreAPata = ref(false)

function medirAPata() {
  const alvo = centro.value

  if (!alvo) {
    return
  }

  const escala = Math.max(window.innerWidth / ARTE.largura, window.innerHeight / ARTE.altura)
  const topoDaArte = (window.innerHeight - ARTE.altura * escala) / 2
  const topoDaPata = topoDaArte + ARTE.topoDaPata * escala

  textoSobreAPata.value = alvo.getBoundingClientRect().bottom + FOLGA_DA_PATA > topoDaPata
}

let observador: ResizeObserver | undefined

onMounted(() => {
  document.documentElement.classList.add('moldura-app')
  medirAPata()
  window.addEventListener('resize', medirAPata)
  /* A arte é fixa na janela: rolar o cadastro (alto) leva o texto para longe da pata. */
  window.addEventListener('scroll', medirAPata, { passive: true })
  /* O texto muda de altura com o idioma e quando a fonte termina de carregar. */
  observador = new ResizeObserver(medirAPata)

  if (centro.value) {
    observador.observe(centro.value)
  }
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('moldura-app')
  window.removeEventListener('resize', medirAPata)
  window.removeEventListener('scroll', medirAPata)
  observador?.disconnect()
})
</script>

<template>
  <main class="auth-page" :style="authArtStyle">
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

          <div
            ref="centro"
            class="auth-visual-panel__center"
            :class="{ 'auth-visual-panel__center--sobre-pata': textoSobreAPata }"
          >
            <div>
              <h2>{{ t('auth.layout.title') }}</h2>
              <p>{{ t('auth.layout.description') }}</p>
            </div>

            <slot name="aside">
              <ul class="auth-benefits">
                <li>
                  <i class="ph ph-check" aria-hidden="true" />
                  {{ t('auth.layout.benefits.programs') }}
                </li>
                <li>
                  <i class="ph ph-check" aria-hidden="true" />
                  {{ t('auth.layout.benefits.indicacao') }}
                </li>
                <li>
                  <i class="ph ph-check" aria-hidden="true" />
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
/*
 * A ação da entrada (o botão, o checkbox, o passo do cadastro) na matiz da sálvia da arte, com o
 * rótulo branco (pedido de 26/10/2026). Branco sobre a sálvia da arte (#84C1B4) dá 2:1 e some; um
 * tom mais fundo da mesma matiz (#4F9C8B) chega a 3,25:1 sem virar o cinza-esverdeado do botão do
 * app (#627A74), que pesava sobre o creme. Os links continuam no `--musgo`: sálvia clara sobre o
 * creme não lê.
 */
.auth-page {
  --auth-acao: #4f9c8b;
  --auth-acao-hover: #488e7f;
  --sobre-auth-acao: #fff;
  --p-checkbox-checked-background: var(--auth-acao);
  --p-checkbox-checked-border-color: var(--auth-acao);
  --p-checkbox-checked-hover-background: var(--auth-acao-hover);
  --p-checkbox-checked-hover-border-color: var(--auth-acao-hover);
  --p-checkbox-icon-checked-color: var(--sobre-auth-acao);
  --p-checkbox-icon-checked-hover-color: var(--sobre-auth-acao);

  min-height: 100vh;
  background-color: var(--auth-page-bg);
  background-image: var(--auth-art);
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  /* Preso à viewport: em página alta (cadastro) a arte não estica nem some ao rolar. */
  background-attachment: fixed;
  color: var(--auth-text);
  font-family: var(--font-texto);
}

/*
 * Árabe: as colunas trocam de lado, e a faixa verde da arte precisa ir junto, senão a copy
 * branca da marca fica sobre o fundo claro. Imagem de fundo não espelha: a arte passa para um
 * pseudo-elemento fixo, invertido na horizontal.
 */
[dir='rtl'] .auth-page {
  isolation: isolate;
  background-image: none;
}

[dir='rtl'] .auth-page::before {
  content: '';
  position: fixed;
  z-index: -1;
  inset: 0;
  background-image: var(--auth-art);
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  transform: scaleX(-1);
}

/* O ladrilho da pata na sálvia do destaque do app, a mesma do topo da barra. */
/* `:deep`: o checkbox vem do formulário da página, pelo slot. */
.auth-page :deep(.p-checkbox.p-checkbox-checked .p-checkbox-box) {
  border-color: var(--auth-acao);
  background: var(--auth-acao);
}

.auth-page :deep(.p-checkbox.p-checkbox-checked .p-checkbox-icon) {
  color: var(--sobre-auth-acao);
}

.bg-color-icon {
  background: var(--app-destaque, var(--auth-sage));
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
  inset-inline-end: 1.25rem;
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
  letter-spacing: -0.03em;
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
  padding-block: clamp(2rem, 4vw, 3.25rem);
  padding-inline: 0 clamp(1.5rem, 3vw, 3rem);
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

/* Só quando a pata chega ao texto (`textoSobreAPata`, medido no script): ela é papel no
   claro e quase preta no escuro, e o texto branco some na primeira. O véu repõe o verde
   chapado da arte (#84c0b4, idêntico nos dois temas) atrás da copy: invisível sobre a faixa
   verde, opaco sobre a pata. É um degradê radial, não um bloco desfocado: chapado atrás do
   texto, ele se apaga antes da borda e mais ainda no canto da diagonal, onde um
   desfoque deixaria um halo verde sobre o creme (e claro sobre o escuro). */
.auth-visual-panel__center--sobre-pata::before {
  content: '';
  position: absolute;
  z-index: -1;
  /* A última linha precisa ficar no chapado (o esmaecer são os 18% de fora da elipse), e o
     véu não desce mais que isso: abaixo do texto ele só pintaria a pata. Nada do lado da
     diagonal: ali o véu entortaria a borda da faixa verde no tablet. A elipse cabe na caixa
     (`closest-side`) e chega a zero antes de qualquer borda; com inset lógico, o árabe
     espelha sozinho. */
  inset-block: -2.5rem;
  inset-inline: 0 -3.5rem;
  background: radial-gradient(closest-side, #84c0b4 82%, rgb(132 192 180 / 0%) 100%);
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

/* Branco sobre a sálvia é limítrofe: branco cheio, sem transparência, e uma sombra curta na
   tinta da casa que só dá contorno à letra. Sombra larga escurece em volta e desenha um
   retângulo sobre a arte. */
.auth-visual-panel h2,
.auth-visual-panel p,
.auth-benefits li {
  text-shadow: 0 1px 2px rgb(16 48 42 / 30%);
}

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

.auth-benefits .ph {
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

  [dir='rtl'] .auth-page::before {
    display: none;
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
