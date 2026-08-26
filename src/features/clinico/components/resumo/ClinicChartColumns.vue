<script setup lang="ts">
/**
 * Colunas empilhadas por dia, com a linha de ocupação por cima.
 *
 * **As barras são CSS; só a linha é SVG.** A primeira versão desenhava tudo em SVG com
 * `preserveAspectRatio="none"` e o desenho esticava na horizontal: os pontos da linha viravam
 * elipses achatadas e qualquer texto dentro do gráfico deformava junto. Retângulo empilhado e
 * alinhado a um rótulo é exatamente o que o layout do navegador faz melhor do que um viewBox.
 * Sobra para o SVG o que ele faz bem — a poligonal —, e ali o traço é protegido por
 * `vector-effect: non-scaling-stroke`.
 *
 * Duas decisões que valem comentário:
 *
 * - **Cada coluna mostra o próprio total.** Barra sem número obriga a medir com o olho contra a
 *   grade, e em impressão preto e branco some.
 * - **A ocupação é linha, não barra.** É uma taxa, não uma contagem: na mesma escala, "80%"
 *   competiria visualmente com "8 atendimentos".
 */
import { computed } from 'vue'

import type { PontoDoDia } from '../../domain/resumo'

const props = withDefaults(
  defineProps<{
    pontos: PontoDoDia[]
    /** Rótulo curto de cada coluna, na mesma ordem dos pontos. */
    rotulos: string[]
    legenda: { finalizados: string; previstos: string; faltas: string; ocupacao: string }
    /** Dia em destaque — normalmente hoje. */
    destaque?: string
    mostrarOcupacao?: boolean
  }>(),
  { destaque: '', mostrarOcupacao: true },
)

const maximo = computed(() => {
  const maior = props.pontos.reduce(
    (topo, ponto) => Math.max(topo, ponto.finalizados + ponto.previstos + ponto.faltas),
    0,
  )

  /** Teto mínimo de 4: um dia com um atendimento não deve virar uma coluna de altura inteira. */
  return Math.max(4, Math.ceil(maior / 2) * 2)
})

type Coluna = {
  data: string
  rotulo: string
  total: number
  fechado: boolean
  destacada: boolean
  ocupacao: number
  segmentos: { classe: string; altura: string; valor: number }[]
}

const colunas = computed<Coluna[]>(() =>
  props.pontos.map((ponto, indice) => ({
    data: ponto.data,
    rotulo: props.rotulos[indice] ?? '',
    total: ponto.finalizados + ponto.previstos + ponto.faltas,
    fechado: ponto.fechado,
    destacada: ponto.data === props.destaque,
    ocupacao: Math.min(1, ponto.ocupacao),
    segmentos: (
      [
        ['finalizados', ponto.finalizados],
        ['previstos', ponto.previstos],
        ['faltas', ponto.faltas],
      ] as const
    )
      .filter(([, valor]) => valor > 0)
      .map(([classe, valor]) => ({
        classe,
        valor,
        altura: `${(valor / maximo.value) * 100}%`,
      })),
  })),
)

/**
 * Poligonal da ocupação, em coordenadas de 0–100 nos dois eixos.
 *
 * Quebra nos dias fechados: unir a linha por cima de um feriado desenharia movimento onde a
 * clínica estava de portas fechadas.
 */
const trilhas = computed(() => {
  const total = Math.max(1, colunas.value.length)
  const grupos: string[] = []
  let atual: string[] = []

  colunas.value.forEach((coluna, indice) => {
    if (coluna.fechado) {
      if (atual.length > 1) {
        grupos.push(atual.join(' '))
      }

      atual = []
      return
    }

    const x = ((indice + 0.5) / total) * 100
    const y = 100 - coluna.ocupacao * 100

    atual.push(`${x},${y}`)
  })

  if (atual.length > 1) {
    grupos.push(atual.join(' '))
  }

  return grupos
})
</script>

<template>
  <figure class="colunas">
    <div class="colunas__area">
      <!--
        A poligonal fica atrás dos marcadores, sobre a mesma caixa das barras. Só ela mora no
        SVG; tudo que precisa manter proporção está em CSS.
      -->
      <svg
        v-if="mostrarOcupacao"
        class="colunas__linha-area"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          v-for="(trilha, indice) in trilhas"
          :key="indice"
          class="colunas__linha"
          :points="trilha"
        />
      </svg>

      <div
        v-for="coluna in colunas"
        :key="coluna.data"
        class="coluna"
        :class="{ 'coluna--destacada': coluna.destacada, 'coluna--fechada': coluna.fechado }"
      >
        <span class="coluna__total clinic-value">{{ coluna.total || '' }}</span>

        <span class="coluna__pilha">
          <span
            v-for="segmento in coluna.segmentos"
            :key="segmento.classe"
            class="coluna__segmento"
            :class="`coluna__segmento--${segmento.classe}`"
            :style="{ height: segmento.altura }"
          />

          <span
            v-if="mostrarOcupacao && !coluna.fechado"
            class="coluna__marca"
            :style="{ bottom: `${coluna.ocupacao * 100}%` }"
          />
        </span>

        <span class="coluna__rotulo">{{ coluna.rotulo }}</span>
      </div>
    </div>

    <figcaption class="colunas__legenda">
      <span class="colunas__chave colunas__chave--finalizados">{{ legenda.finalizados }}</span>
      <span class="colunas__chave colunas__chave--previstos">{{ legenda.previstos }}</span>
      <span class="colunas__chave colunas__chave--faltas">{{ legenda.faltas }}</span>
      <span v-if="mostrarOcupacao" class="colunas__chave colunas__chave--ocupacao">
        {{ legenda.ocupacao }}
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.colunas {
  --altura-pilha: 9rem;

  display: grid;
  margin: 0;
  gap: 0.6rem;
}

.colunas__area {
  position: relative;
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
}

/*
 * A caixa da poligonal cobre exatamente a faixa das barras, sem o total nem o rótulo.
 *
 * A largura é explícita porque SVG é elemento substituído: posicionado com `left: 0` e
 * `right: 0` e `width: auto`, ele assume a largura intrínseca em vez de esticar, e a linha
 * inteira nascia comprimida dentro da primeira coluna.
 */
.colunas__linha-area {
  position: absolute;
  top: 1.15rem;
  left: 0;
  z-index: 1;
  width: 100%;
  height: var(--altura-pilha);
  overflow: visible;
  pointer-events: none;
}

.colunas__linha {
  fill: none;
  stroke: var(--clinic-attention-text);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.75;
  vector-effect: non-scaling-stroke;
}

.coluna {
  display: grid;
  min-width: 0;
  gap: 0.3rem;
  grid-template-rows: 1.15rem var(--altura-pilha) auto;
  justify-items: center;
  text-align: center;
}

.coluna--destacada {
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-accent-tint);
}

.coluna__total {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 800;
  line-height: 1.15rem;
}

.coluna__pilha {
  position: relative;
  display: flex;
  width: min(2.6rem, 60%);
  height: 100%;
  flex-direction: column-reverse;
  border-radius: 0.3rem;
  background: linear-gradient(var(--clinic-line-soft), var(--clinic-line-soft)) bottom / 100% 1px
    no-repeat;
}

.coluna--fechada .coluna__pilha {
  background: repeating-linear-gradient(
    135deg,
    color-mix(in srgb, var(--clinic-muted) 8%, transparent) 0 4px,
    transparent 4px 8px
  );
}

.coluna__segmento:first-child {
  border-radius: 0.3rem 0.3rem 0 0;
}

.coluna__segmento--finalizados {
  background: var(--clinic-accent-strong);
}

.coluna__segmento--previstos {
  background: var(--clinic-accent);
}

.coluna__segmento--faltas {
  background: var(--clinic-risk-text);
}

/** Marcador da ocupação: fica redondo porque é CSS, não SVG esticado. */
.coluna__marca {
  position: absolute;
  z-index: 2;
  left: 50%;
  width: 0.5rem;
  height: 0.5rem;
  border: 2px solid var(--clinic-attention-text);
  border-radius: 999px;
  background: var(--clinic-surface);
  transform: translate(-50%, 50%);
}

.coluna__rotulo {
  overflow: hidden;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coluna--destacada .coluna__rotulo {
  color: var(--clinic-accent-strong);
}

.colunas__legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.85rem;
}

.colunas__chave {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.colunas__chave::before {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 0.2rem;
  content: '';
}

.colunas__chave--finalizados::before {
  background: var(--clinic-accent-strong);
}

.colunas__chave--previstos::before {
  background: var(--clinic-accent);
}

.colunas__chave--faltas::before {
  background: var(--clinic-risk-text);
}

.colunas__chave--ocupacao::before {
  width: 0.85rem;
  height: 0.16rem;
  border-radius: 999px;
  background: var(--clinic-attention-text);
}
</style>
