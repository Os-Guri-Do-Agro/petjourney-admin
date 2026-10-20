<script setup lang="ts">
/**
 * O tutorial da tela: um passo de cada vez, apontando para a coisa de que fala.
 *
 * Substitui o par que existia antes — uma tela "Como funciona" separada e um botão que ligava
 * parágrafos de explicação. Os dois tinham o mesmo defeito: **explicavam longe do que explicavam**.
 * A tela à parte ensinava o fluxo e sumia quando a pessoa ia trabalhar; o parágrafo dizia "a
 * coluna de documentação é ordenável" a quem ainda não sabia qual era a coluna.
 *
 * Aqui a frase e o objeto aparecem juntos: o resto da tela escurece, o alvo continua aceso, e o
 * cartão fica encostado nele. Quem já sabe fecha no Esc e nunca mais abre.
 *
 * ## O que este componente não faz
 *
 * Não bloqueia a tela para ensinar um caminho feliz, e não guarda "já viu". Tutorial que só roda
 * na primeira vez é tutorial que ninguém reencontra no dia em que precisa — e a pergunta "o que é
 * esse selo âmbar?" chega no segundo mês, não no primeiro minuto.
 */
import Button from 'primevue/button'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PassoDoTour } from './tour-types'

const props = defineProps<{
  aberto: boolean
  passos: PassoDoTour[]
}>()

const emit = defineEmits<{ 'update:aberto': [boolean] }>()

const { t } = useI18n()

/** Folga entre o recorte e o alvo, para o destaque não encostar na borda do elemento. */
const FOLGA = 8

/** Distância entre o recorte e o cartão. */
const RESPIRO = 12

const LARGURA_DO_CARTAO = 320

const indice = ref(0)
const recorte = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const cartao = ref<HTMLElement | null>(null)

/**
 * Os passos que de fato têm o que mostrar.
 *
 * Calculado na abertura e não na montagem: a tela muda entre uma abertura e outra — a faixa de
 * véspera aparece quando alguém chega sem documento — e um roteiro fixo apontaria para um
 * elemento que saiu do DOM desde então.
 */
const roteiro = ref<PassoDoTour[]>([])

const passoAtual = computed(() => roteiro.value[indice.value] ?? null)
const total = computed(() => roteiro.value.length)

function montarRoteiro() {
  roteiro.value = props.passos.filter(
    (passo) => !passo.alvo || document.querySelector(passo.alvo) !== null,
  )
  indice.value = 0
}

/** Mede o alvo do passo, depois de trazê-lo para a área visível. */
async function mirar() {
  const passo = passoAtual.value

  if (!passo?.alvo) {
    recorte.value = null

    return
  }

  const alvo = document.querySelector(passo.alvo)

  if (!alvo) {
    recorte.value = null

    return
  }

  /*
   * Trazer o alvo para a área visível é melhoria, não requisito.
   *
   * O `jsdom` não implementa `scrollIntoView`, e chamar direto derrubava o tutorial inteiro num
   * ambiente onde ele funcionaria — a medição e o recorte não dependem da rolagem.
   */
  alvo.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' })

  /*
   * A medida vem depois da rolagem parar. `scrollIntoView` é assíncrono e não avisa quando
   * terminou; dois quadros cobrem o caso comum e o recálculo no `scroll` cobre o resto.
   */
  await nextTick()
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))

  medir()
}

function medir() {
  const passo = passoAtual.value
  const alvo = passo?.alvo ? document.querySelector(passo.alvo) : null

  if (!alvo) {
    recorte.value = null

    return
  }

  const caixa = alvo.getBoundingClientRect()

  recorte.value = {
    top: caixa.top - FOLGA,
    left: caixa.left - FOLGA,
    width: caixa.width + FOLGA * 2,
    height: caixa.height + FOLGA * 2,
  }
}

/**
 * Onde o cartão fica.
 *
 * Abaixo do alvo quando cabe, acima quando não cabe, e no centro da tela quando o passo não tem
 * alvo. O lado é preso à janela para o cartão nunca sair pela direita numa tela estreita.
 */
const posicaoDoCartao = computed(() => {
  const area = recorte.value

  if (!area) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }

  const alturaEstimada = cartao.value?.offsetHeight ?? 190
  const cabeAbaixo = area.top + area.height + RESPIRO + alturaEstimada < window.innerHeight
  const top = cabeAbaixo ? area.top + area.height + RESPIRO : area.top - RESPIRO - alturaEstimada

  const left = Math.min(Math.max(FOLGA, area.left), window.innerWidth - LARGURA_DO_CARTAO - FOLGA)

  return {
    top: `${Math.max(FOLGA, top)}px`,
    left: `${Math.max(FOLGA, left)}px`,
    transform: 'none',
  }
})

function avancar() {
  if (indice.value < total.value - 1) {
    indice.value += 1
  } else {
    fechar()
  }
}

function voltar() {
  if (indice.value > 0) {
    indice.value -= 1
  }
}

function fechar() {
  emit('update:aberto', false)
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Escape') {
    evento.preventDefault()
    fechar()
  }

  if (evento.key === 'ArrowRight') {
    evento.preventDefault()
    avancar()
  }

  if (evento.key === 'ArrowLeft') {
    evento.preventDefault()
    voltar()
  }
}

/* Rolar ou redimensionar move o alvo; o recorte vai junto, senão ele aponta para o lugar errado. */
function acompanhar() {
  medir()
}

let focoAnterior: HTMLElement | null = null

watch(
  () => props.aberto,
  async (aberto) => {
    if (!aberto) {
      window.removeEventListener('keydown', aoTeclar)
      window.removeEventListener('scroll', acompanhar, true)
      window.removeEventListener('resize', acompanhar)
      focoAnterior?.focus()
      focoAnterior = null

      return
    }

    focoAnterior = document.activeElement as HTMLElement | null

    montarRoteiro()

    /*
     * Os atalhos entram **antes** de mirar, não depois.
     *
     * `mirar` espera a rolagem até o alvo acomodar, e nesse intervalo o Esc não fazia nada: quem
     * abrisse o tutorial sem querer ficava preso olhando a tela escurecer até o fim da animação.
     */
    window.addEventListener('keydown', aoTeclar)
    window.addEventListener('scroll', acompanhar, true)
    window.addEventListener('resize', acompanhar)

    await mirar()
    await nextTick()
    cartao.value?.focus()
  },
  /*
   * `immediate` porque montar já aberto é um estado legítimo.
   *
   * Sem ele o roteiro só era montado na **transição** de fechado para aberto: um componente que
   * nascesse com `aberto` verdadeiro ficava com o roteiro vazio e não desenhava nada — falha
   * silenciosa, porque `v-if` sem passo não é erro, é tela limpa.
   */
  { immediate: true },
)

watch(indice, () => void mirar())

onBeforeUnmount(() => {
  window.removeEventListener('keydown', aoTeclar)
  window.removeEventListener('scroll', acompanhar, true)
  window.removeEventListener('resize', acompanhar)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="aberto && passoAtual" class="tour">
      <!--
        O véu é um só, e o buraco é a sombra dele: uma sombra de 9999px para fora pinta a tela
        inteira menos o retângulo. Quatro divs em volta do alvo dariam o mesmo resultado com
        quatro vezes mais chance de uma fresta entre elas.
      -->
      <div
        class="tour__veu"
        :class="{ 'tour__veu--sem-alvo': !recorte }"
        :style="
          recorte
            ? {
                top: `${recorte.top}px`,
                left: `${recorte.left}px`,
                width: `${recorte.width}px`,
                height: `${recorte.height}px`,
              }
            : undefined
        "
        @click="fechar"
      />

      <div
        ref="cartao"
        class="tour__cartao"
        :style="posicaoDoCartao"
        role="dialog"
        aria-modal="true"
        :aria-label="passoAtual.titulo"
        tabindex="-1"
      >
        <p class="tour__contador">
          {{ t('hotel.tour.passo', { atual: indice + 1, total }) }}
        </p>

        <h2 class="tour__titulo">{{ passoAtual.titulo }}</h2>
        <p class="tour__texto">{{ passoAtual.texto }}</p>

        <div class="tour__acoes">
          <Button
            :label="t('hotel.tour.sair')"
            severity="secondary"
            text
            size="small"
            @click="fechar"
          />

          <div class="tour__navegacao">
            <Button
              v-if="indice > 0"
              :label="t('hotel.tour.anterior')"
              severity="secondary"
              outlined
              size="small"
              @click="voltar"
            />
            <Button
              :label="indice === total - 1 ? t('hotel.tour.terminar') : t('hotel.tour.proximo')"
              size="small"
              @click="avancar"
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tour {
  position: fixed;
  z-index: 1300;
  inset: 0;
  pointer-events: none;
}

/*
 * O tutorial mora no `body` (teleporte), fora da moldura que acende a cor do lugar; por isso ele
 * usa a lavanda do Hotel direto, e não `--pj-lugar`.
 *
 * O véu é a cor da barra (verde-floresta, quase preta no escuro) em transparência: escurece a
 * tela sem trocar de matiz, e o recorte aceso fica com a cor de verdade.
 */
.tour__veu {
  --tour-veu: color-mix(in oklab, var(--rail) 64%, transparent);

  position: absolute;
  border-radius: 12px;
  box-shadow:
    0 0 0 2px var(--hotel),
    0 0 0 9999px var(--tour-veu);
  pointer-events: auto;
  transition:
    top var(--pj-tempo-medio) var(--pj-curva-chega),
    left var(--pj-tempo-medio) var(--pj-curva-chega),
    width var(--pj-tempo-medio) var(--pj-curva-chega),
    height var(--pj-tempo-medio) var(--pj-curva-chega);
}

/* Sem alvo, o véu cobre tudo: não há retângulo para recortar. */
.tour__veu--sem-alvo {
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
  box-shadow: none;
  background: var(--tour-veu);
}

.tour__cartao {
  position: absolute;
  display: grid;
  width: 320px;
  max-width: calc(100vw - 32px);
  gap: 8px;
  padding: 18px 18px 14px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  box-shadow: var(--sombra-3);
  color: var(--tinta);
  pointer-events: auto;
}

.tour__cartao:focus {
  outline: none;
}

.tour__cartao:focus-visible {
  outline: 2px solid var(--hotel);
  outline-offset: 2px;
}

/* O contador é frase pequena na cor do lugar, não sobretítulo em caixa alta. */
.tour__contador {
  margin: 0;
  color: var(--hotel-tinta);
  font-family: var(--font-dados);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.tour__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.tour__texto {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.55;
}

.tour__acoes {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
}

.tour__navegacao {
  display: flex;
  gap: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .tour__veu {
    transition: none;
  }
}
</style>
