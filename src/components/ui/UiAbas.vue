<script setup lang="ts">
/**
 * As abas de um destino: as telas irmãs, lado a lado, com o que está parado em cada uma.
 *
 * Cada aba é um link de verdade (a URL da tela), então abrir em outra guia, voltar e favoritar
 * funcionam como em qualquer link.
 *
 * `pasta`: no cabeçalho do app (a faixa), as abas viram orelhas de pasta na borda de baixo dela, e a
 * aberta tem a cor da página. Fora da faixa (a moldura antiga), o sublinhado na cor do lugar.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Aba } from '@/navegacao/espacos'

const props = withDefaults(
  defineProps<{
    abas: Aba[]
    atual: string | null
    rotulo: string
    /** Orelhas de pasta na borda de baixo da faixa; a aberta tem a cor da página. */
    pasta?: boolean
  }>(),
  {
    pasta: false,
  },
)

const { t } = useI18n()

/*
 * Quando as abas não cabem (tablet, sérvio, cinco abas), a fileira rola de lado. O lado cortado
 * esmaece, para dizer que há mais, e a aba aberta entra na vista: sem isso a última aba sumia atrás
 * da ponta arredondada da trilha, e a fileira parecia acabar ali.
 */
const nav = ref<HTMLElement | null>(null)
const cortaInicio = ref(false)
const cortaFim = ref(false)

function medir() {
  const el = nav.value
  if (!el) return
  const sobra = el.scrollWidth - el.clientWidth
  // No RTL o scrollLeft vai de 0 para negativo; o módulo é a distância andada desde o início.
  const andado = Math.abs(el.scrollLeft)
  cortaInicio.value = andado > 2
  cortaFim.value = andado < sobra - 2
}

// No centro, e não rente: a primeira e a última aba levam a fileira até a ponta, sem esmaecido.
function mostrarAtual() {
  nav.value
    ?.querySelector<HTMLElement>('.abas__aba--atual')
    ?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  medir()
}

let observador: ResizeObserver | null = null

onMounted(() => {
  mostrarAtual()
  if (nav.value && typeof ResizeObserver !== 'undefined') {
    observador = new ResizeObserver(medir)
    observador.observe(nav.value)
  }
})

onBeforeUnmount(() => observador?.disconnect())

watch(
  () => [props.atual, props.abas.length],
  () => nextTick(mostrarAtual),
)
</script>

<template>
  <nav
    ref="nav"
    class="abas"
    :class="{
      'abas--pasta': pasta,
      'abas--corta-inicio': cortaInicio,
      'abas--corta-fim': cortaFim,
    }"
    :aria-label="t('espacos.abasAria', { destino: rotulo })"
    @scroll.passive="medir"
  >
    <RouterLink
      v-for="aba in abas"
      :key="aba.to"
      class="abas__aba"
      :class="{ 'abas__aba--atual': aba.to === atual }"
      :to="aba.to"
      active-class=""
      exact-active-class=""
      :aria-current="aba.to === atual ? 'page' : undefined"
      :title="aba.tituloDoSelo"
    >
      <i class="abas__icone" :class="aba.icone" aria-hidden="true" />
      <span>{{ aba.rotulo }}</span>
      <i v-if="aba.bloqueado" class="ph ph-lock-simple" aria-hidden="true" />
      <span v-else-if="aba.selo" class="abas__selo" :class="`abas__selo--${aba.tom ?? 'neutro'}`">
        {{ aba.selo }}
      </span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.abas {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  border-bottom: 1px solid var(--linha);
  scrollbar-width: none;
}

.abas::-webkit-scrollbar {
  display: none;
}

/* O lado que continua fora da vista esmaece nos últimos 48 px (no RTL o início fica à direita). */
.abas--corta-fim {
  mask-image: linear-gradient(to right, #000 calc(100% - 48px), transparent);
}

.abas--corta-inicio {
  mask-image: linear-gradient(to left, #000 calc(100% - 48px), transparent);
}

.abas--corta-inicio.abas--corta-fim {
  mask-image: linear-gradient(
    to right,
    transparent,
    #000 48px,
    #000 calc(100% - 48px),
    transparent
  );
}

[dir='rtl'] .abas--corta-fim {
  mask-image: linear-gradient(to left, #000 calc(100% - 48px), transparent);
}

[dir='rtl'] .abas--corta-inicio {
  mask-image: linear-gradient(to right, #000 calc(100% - 48px), transparent);
}

[dir='rtl'] .abas--corta-inicio.abas--corta-fim {
  mask-image: linear-gradient(
    to right,
    transparent,
    #000 48px,
    #000 calc(100% - 48px),
    transparent
  );
}

.abas__aba {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 12px;
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 550;
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.abas__aba:first-child {
  padding-left: 4px;
}

.abas__icone {
  color: var(--tinta-3);
  font-size: 17px;
  transition: color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.abas__aba:hover {
  color: var(--tinta);
}

.abas__aba:hover::after {
  position: absolute;
  right: 12px;
  bottom: -1px;
  left: 12px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--linha-media);
  content: '';
}

.abas__aba:first-child:hover::after {
  left: 4px;
}

.abas__aba:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -4px;
}

.abas__aba--atual,
.abas__aba--atual:hover {
  color: var(--tinta);
  font-weight: 650;
}

.abas__aba--atual .abas__icone {
  color: var(--pj-lugar-tinta, var(--musgo));
}

.abas__aba--atual::after,
.abas__aba--atual:hover::after {
  position: absolute;
  right: 12px;
  bottom: -1px;
  left: 12px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--pj-lugar, var(--musgo));
  content: '';
}

.abas__aba--atual:first-child::after {
  left: 4px;
}

.abas__selo {
  display: inline-grid;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}

.abas__selo--neutro {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.abas__selo--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.abas__selo--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

/* ------------------------------------------------------------------ orelhas de pasta (faixa)
 * As abas presas na borda de baixo da faixa, como as orelhas de uma pasta. A aberta tem a cor da
 * página e duas curvas para fora no pé, então ela e o conteúdo embaixo viram uma peça só. As outras
 * são orelhas de vidro (18%, o que leva o branco de 14 px a 4,6:1 sobre a sálvia).
 *
 * O vão entre as orelhas (10 px) é o lugar das curvas do pé da aberta, para elas não pisarem na
 * vizinha. A trilha ganha 10 px de cada lado pelo mesmo motivo: a rolagem de lado cortaria a curva
 * da primeira e da última.
 */

.abas--pasta {
  --pasta-curva: 10px;

  align-items: flex-end;
  gap: var(--pasta-curva);
  margin-inline: calc(var(--pasta-curva) * -1);
  padding-inline: var(--pasta-curva);
  border-bottom: 0;
}

.abas--pasta .abas__aba,
.abas--pasta .abas__aba:first-child {
  height: 44px;
  padding: 0 18px;
  border-radius: 14px 14px 0 0;
  background: rgb(0 0 0 / 18%);
  color: #fff;
  font-weight: 600;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.abas--pasta .abas__icone {
  color: #fff;
}

.abas--pasta .abas__aba:hover {
  background: rgb(0 0 0 / 26%);
  color: #fff;
}

.abas--pasta .abas__aba::after,
.abas--pasta .abas__aba:hover::after {
  display: none;
}

.abas--pasta .abas__aba:focus-visible {
  border-radius: 14px 14px 0 0;
  outline: 2px solid #fff;
  outline-offset: -3px;
}

.abas--pasta .abas__aba.abas__aba--atual,
.abas--pasta .abas__aba.abas__aba--atual:hover {
  background: var(--app-fundo);
  color: var(--app-tinta);
  font-weight: 700;
}

.abas--pasta .abas__aba--atual .abas__icone {
  color: var(--app-salvia-texto);
}

.abas--pasta .abas__aba--atual:focus-visible {
  outline-color: var(--app-salvia-texto);
}

/* As duas curvas do pé: um quadrado da cor da página com um quarto de círculo vazado. */
.abas--pasta .abas__aba--atual::before,
.abas--pasta .abas__aba.abas__aba--atual::after,
.abas--pasta .abas__aba.abas__aba--atual:hover::after {
  position: absolute;
  bottom: 0;
  display: block;
  width: var(--pasta-curva);
  height: var(--pasta-curva);
  border-radius: 0;
  pointer-events: none;
  content: '';
}

.abas--pasta .abas__aba--atual::before {
  left: calc(var(--pasta-curva) * -1);
  background: radial-gradient(
    circle at 0 0,
    transparent calc(var(--pasta-curva) - 0.5px),
    var(--app-fundo) var(--pasta-curva)
  );
}

.abas--pasta .abas__aba.abas__aba--atual::after,
.abas--pasta .abas__aba.abas__aba--atual:hover::after {
  right: calc(var(--pasta-curva) * -1);
  left: auto;
  background: radial-gradient(
    circle at 100% 0,
    transparent calc(var(--pasta-curva) - 0.5px),
    var(--app-fundo) var(--pasta-curva)
  );
}

.abas--pasta .abas__selo {
  background: rgb(0 0 0 / 20%);
  color: #fff;
}

.abas--pasta .abas__aba--atual .abas__selo {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.abas--pasta .abas__selo--risco,
.abas--pasta .abas__aba--atual .abas__selo--risco {
  background: var(--risco-fundo);
  color: color-mix(in oklab, var(--risco-tinta) 75%, #000);
}

/* No escuro o rosa do risco é tinta clara sobre fundo fundo: escurecer só derrubaria o contraste. */
.app-dark .abas--pasta .abas__selo--risco,
.app-dark .abas--pasta .abas__aba--atual .abas__selo--risco {
  color: var(--risco-tinta);
}
</style>
