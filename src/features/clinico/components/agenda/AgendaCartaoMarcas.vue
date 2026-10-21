<script setup lang="ts" generic="T extends MarcaDaAgenda">
/**
 * As marcas de um atendimento na agenda (risco, aviso, estado, origem, tipo), em ordem de
 * importância, sem nunca sair pela borda do cartão.
 *
 * Na coluna estreita é o nome do paciente que encolhe, com reticências, até um mínimo; o resto da
 * largura é das marcas. Quando nem assim cabem todas, ficam as primeiras (quem chama passa a
 * lista já em ordem: risco do paciente, depois aviso, depois estado) e as outras viram um "+N"
 * discreto, com os nomes no `title`. Se o que ficou escondido tem risco ou aviso, o "+N" leva a cor
 * dele: a gravidade não some junto com o ícone. O rótulo acessível do cartão continua dizendo
 * tudo: o "+N" é só para o olho, e o grupo inteiro é `aria-hidden`.
 *
 * Como mede: o grupo quebra linha e tem a altura de uma linha só, então a marca que não cabe desce
 * para a segunda e some sem ser cortada pela metade. Como nenhuma marca sai do DOM, a largura que o
 * grupo pede é sempre a de todas juntas, e a que ele recebe é a que o cartão tem para dar: basta
 * contar quantas ficaram inteiras na primeira linha. Um `ResizeObserver` recalcula quando a coluna
 * muda (o painel do atendimento abriu, a janela estreitou).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { MarcaDaAgenda } from './agenda-icones'

const props = defineProps<{
  /** Em ordem de importância: o que vem primeiro é o último a sair. */
  itens: T[]
}>()

defineSlots<{
  default(props: { item: T }): unknown
}>()

const raiz = ref<HTMLElement | null>(null)
const grupo = ref<HTMLElement | null>(null)
const mais = ref<HTMLElement | null>(null)

/** Quantas marcas cabem inteiras. Começa com todas: a primeira medida corrige. */
const cabem = ref(props.itens.length)

/**
 * No cartão espremido ao extremo (painel aberto, botão de falta, hora fora da meia hora) pode não
 * sobrar nem a largura do "+N". Aí ele também sai, inteiro — cortado pela borda, nunca.
 */
const maisCabe = ref(true)

const ocultas = computed(() => props.itens.slice(cabem.value))

const tituloDasOcultas = computed(() => ocultas.value.map((item) => item.rotulo).join(' · '))

const tomDasOcultas = computed(() => {
  if (ocultas.value.some((item) => item.tom === 'risco')) {
    return 'risco'
  }

  return ocultas.value.some((item) => item.tom === 'atencao') ? 'atencao' : null
})

/** Meio pixel de folga: o arredondamento do subpixel não pode esconder uma marca que cabe. */
const FOLGA = 0.5

type Caixa = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>

function contem(fora: Caixa, dentro: Caixa) {
  return (
    dentro.top >= fora.top - FOLGA &&
    dentro.bottom <= fora.bottom + FOLGA &&
    dentro.left >= fora.left - FOLGA &&
    dentro.right <= fora.right + FOLGA
  )
}

function conferirMais() {
  if (raiz.value && mais.value) {
    maisCabe.value = contem(raiz.value.getBoundingClientRect(), mais.value.getBoundingClientRect())
  }
}

function medir() {
  const elemento = grupo.value

  if (!elemento) {
    return
  }

  const caixa = elemento.getBoundingClientRect()

  /*
   * Com o "+N" sozinho, ele encosta no grupo sem vão; com uma marca à vista, o vão volta e o grupo
   * perde essa largura. A conta é sempre feita como se o vão estivesse lá — senão a marca que cabe
   * por um triz entra, o vão volta, ela sai, e o cartão pisca. O vão sai do lado de onde as marcas
   * transbordam (o começo da linha: elas se alinham ao fim).
   */
  const estilo = getComputedStyle(elemento)
  const vao = cabem.value === 0 && props.itens.length > 0 ? parseFloat(estilo.columnGap) || 0 : 0
  const rtl = estilo.direction === 'rtl'
  const limite: Caixa = {
    top: caixa.top,
    bottom: caixa.bottom,
    left: rtl ? caixa.left : caixa.left + vao,
    right: rtl ? caixa.right - vao : caixa.right,
  }
  let inteiras = 0

  for (const filho of Array.from(elemento.children)) {
    if (!contem(limite, filho.getBoundingClientRect())) {
      break
    }

    inteiras += 1
  }

  cabem.value = inteiras
  conferirMais()

  /* O "+N" que acabou de nascer ainda não está no DOM: confere de novo depois de desenhado. */
  void nextTick(conferirMais)
}

/*
 * A medida vai para o quadro seguinte: mudar o "+N" dentro do próprio aviso do ResizeObserver
 * redimensionaria o grupo no mesmo ciclo, e o navegador acusa laço.
 */
let quadro = 0

function agendarMedida() {
  if (typeof requestAnimationFrame === 'undefined') {
    medir()

    return
  }

  cancelAnimationFrame(quadro)
  quadro = requestAnimationFrame(medir)
}

let observador: ResizeObserver | null = null

onMounted(() => {
  medir()

  if (typeof ResizeObserver !== 'undefined') {
    observador = new ResizeObserver(agendarMedida)

    for (const elemento of [raiz.value, grupo.value]) {
      if (elemento) {
        observador.observe(elemento)
      }
    }
  }

  /* O ícone é fonte: antes de ela chegar, a largura de cada marca é outra. */
  void document.fonts?.ready.then(agendarMedida)
})

onBeforeUnmount(() => {
  observador?.disconnect()

  if (typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(quadro)
  }
})

watch(
  () => props.itens.map((item) => item.chave).join('|'),
  async () => {
    cabem.value = props.itens.length
    await nextTick()
    medir()
  },
)
</script>

<template>
  <span ref="raiz" class="marcas" aria-hidden="true">
    <span ref="grupo" class="marcas__grupo">
      <span
        v-for="(item, indice) in itens"
        :key="item.chave"
        class="marcas__item"
        :class="{ 'marcas__item--fora': indice >= cabem }"
      >
        <slot :item="item" />
      </span>
    </span>

    <span
      v-if="ocultas.length > 0"
      ref="mais"
      class="marcas__mais ui-num"
      :class="[
        tomDasOcultas && `marcas__mais--${tomDasOcultas}`,
        { 'marcas__mais--so': cabem === 0, 'marcas__mais--fora': !maisCabe },
      ]"
      :title="tituloDasOcultas"
    >
      +{{ ocultas.length }}
    </span>
  </span>
</template>

<style scoped>
/*
 * `--marcas-vao` e `--marcas-altura` vêm de quem usa: a tabela do dia tem ícones de 15 px, o
 * cartão da linha do tempo de 13 px.
 */
.marcas {
  display: inline-flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: center;
}

.marcas__grupo {
  display: flex;
  min-width: 0;
  height: var(--marcas-altura, 20px);
  flex: 0 1 auto;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: center;
  justify-content: flex-end;
  gap: 0 var(--marcas-vao, 6px);
  overflow: hidden;
}

/* Cada marca ocupa a linha inteira de altura: a segunda linha começa exatamente onde o grupo acaba. */
.marcas__item {
  display: inline-flex;
  height: var(--marcas-altura, 20px);
  flex: none;
  align-items: center;
}

.marcas__item--fora,
.marcas__mais--fora {
  visibility: hidden;
}

/* Sem nenhuma marca à vista, o "+N" encosta: o vão seria para separá-lo de um ícone que não há. */
.marcas__mais--so {
  margin-inline-start: 0;
}

/* O "+N": pílula pequena em tinta fraca; com risco ou aviso escondido, no tom dele. */
.marcas__mais {
  display: inline-flex;
  height: 18px;
  flex: none;
  align-items: center;
  margin-inline-start: var(--marcas-vao, 6px);
  padding: 0 5px;
  border-radius: 6px;
  background: color-mix(in oklab, var(--tinta) 7%, transparent);
  color: var(--tinta-2);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.01em;
  line-height: 1;
}

.marcas__mais--risco {
  background: color-mix(in oklab, var(--risco-fundo) 85%, transparent);
  color: var(--risco-tinta);
}

.marcas__mais--atencao {
  background: color-mix(in oklab, var(--atencao-fundo) 85%, transparent);
  color: var(--atencao-tinta);
}
</style>
