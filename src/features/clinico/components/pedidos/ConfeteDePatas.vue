<script setup lang="ts">
/**
 * A comemoração do pedido enviado: patinhas, pontos e fitas saindo do selo, uma vez, em ~1 s.
 *
 * É o "foi" do envio — a pessoa acabou de marcar a consulta ou a hospedagem do bicho dela. Mora
 * dentro do selo (`.enviado__selo`, com `position: relative`) e parte do centro dele. As cores são
 * as pastéis da paleta da casa, que leem bem no claro e no escuro.
 *
 * As peças são fixas, e não sorteadas: a mesma explosão toda vez, e nenhuma peça cai em cima do
 * título por acaso. Com movimento reduzido, não aparece.
 */
import { PhPawPrint } from '@phosphor-icons/vue'

/* Sálvia, pêssego, periwinkle, ciano claro, rosa claro e coral — os pastéis da paleta. */
const CORES = ['#84a59d', '#ffb7a1', '#bdb2ff', '#a8dadc', '#fad2e1', '#f28482']
const TOTAL = 14
const DISTANCIAS = [66, 88, 58, 78]

const PECAS = Array.from({ length: TOTAL }, (_, indice) => {
  const angulo = (indice / TOTAL) * Math.PI * 2 + (indice % 2 ? 0.18 : -0.12)
  const distancia = DISTANCIAS[indice % DISTANCIAS.length]!

  return {
    id: indice,
    forma: indice % 3 === 0 ? 'pata' : indice % 3 === 1 ? 'ponto' : 'fita',
    estilo: {
      '--dx': `${Math.round(Math.cos(angulo) * distancia)}px`,
      /* Um pouco mais para cima que para baixo: o confete sobe e depois cai. */
      '--dy': `${Math.round(Math.sin(angulo) * distancia * 0.85 - 12)}px`,
      '--giro': `${(indice % 2 ? 1 : -1) * (90 + indice * 17)}deg`,
      '--atraso': `${(indice % 4) * 18}ms`,
      color: CORES[indice % CORES.length],
    },
  }
})
</script>

<template>
  <span class="confete" aria-hidden="true">
    <span
      v-for="peca in PECAS"
      :key="peca.id"
      class="confete__peca"
      :class="`confete__peca--${peca.forma}`"
      :style="peca.estilo"
    >
      <PhPawPrint v-if="peca.forma === 'pata'" weight="fill" />
    </span>
  </span>
</template>

<style scoped>
.confete {
  position: absolute;
  z-index: 1;
  inset: 0;
  pointer-events: none;
}

.confete__peca {
  position: absolute;
  top: 50%;
  left: 50%;
  opacity: 0;
  /* Junto da decolagem do avião (`enviado-aviao`, 240 ms): os dois são o mesmo "foi". */
  animation: confete-voa 1200ms linear calc(260ms + var(--atraso)) both;
}

.confete__peca--pata svg {
  display: block;
  width: 1.1rem;
  height: 1.1rem;
}

.confete__peca--ponto {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: currentColor;
}

.confete__peca--fita {
  width: 0.32rem;
  height: 0.85rem;
  border-radius: 2px;
  background: currentColor;
}

/*
 * Física de confete: o lançamento perde velocidade até o alto (desacelera), e a queda ganha
 * velocidade (acelera), sumindo enquanto cai. Cada trecho com a sua curva.
 */
@keyframes confete-voa {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.4) rotate(0deg);
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }

  8% {
    opacity: 1;
  }

  55% {
    opacity: 1;
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1)
      rotate(var(--giro));
    animation-timing-function: cubic-bezier(0.45, 0, 0.8, 0.5);
  }

  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx) * 1.08), calc(-50% + var(--dy) + 30px)) scale(0.85)
      rotate(calc(var(--giro) * 1.5));
  }
}

@media (prefers-reduced-motion: reduce) {
  .confete {
    display: none;
  }
}
</style>
