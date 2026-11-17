<script setup lang="ts">
/**
 * O mapa esquemático das 7 regiões urbanas de Campo Grande: um hexágono por região, cada um na
 * posição dela em volta do Centro (Segredo ao norte, Prosa a nordeste, Bandeira a sudeste,
 * Anhanduizinho ao sul, Lagoa a sudoeste, Imbirussu a noroeste). Não é o contorno de verdade: é a
 * vizinhança, que é o que o gestor precisa para ver onde agir.
 *
 * A cor é a magnitude do indicador escolhido, numa escala de um verde só, do claro (pouco em dia)
 * ao escuro (muito em dia); no tema escuro a escala inverte a âncora (pouco = perto do fundo). O
 * número vai escrito no hexágono, então a cor nunca fala sozinha. Passar o mouse (ou o foco) mostra
 * o detalhe; clicar escolhe a região. Para leitor de tela, a mesma informação vai numa tabela.
 */
import { computed, ref } from 'vue'

import {
  indicador as definicaoDo,
  numero,
  publicoDaRegiao,
  REGIOES,
  type IdDaRegiao,
  type Indicador,
  type Posicao,
  type Regiao,
} from '@/features/saude-publica/dados'

const props = defineProps<{ indicador: Indicador }>()
const selecionada = defineModel<IdDaRegiao | null>('selecionada', { default: null })

/* ------------------------------------------------------------------------------ geometria */

/** Raio do hexágono (vértice ao centro). Hexágono de topo reto: vizinhos a √3·R na vertical. */
const R = 64
const RAIZ3 = Math.sqrt(3)

const CENTRO_DA_POSICAO: Record<Posicao, [number, number]> = {
  centro: [0, 0],
  n: [0, -RAIZ3 * R],
  s: [0, RAIZ3 * R],
  ne: [1.5 * R, (-RAIZ3 / 2) * R],
  se: [1.5 * R, (RAIZ3 / 2) * R],
  sw: [-1.5 * R, (RAIZ3 / 2) * R],
  nw: [-1.5 * R, (-RAIZ3 / 2) * R],
}

const LARGURA = 5 * R
const ALTURA = 3 * RAIZ3 * R

function pontos(cx: number, cy: number, raio: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angulo = (Math.PI / 3) * i
    return `${(cx + raio * Math.cos(angulo)).toFixed(1)},${(cy + raio * Math.sin(angulo)).toFixed(1)}`
  }).join(' ')
}

/* -------------------------------------------------------------------------------- escala */

/** Cinco faixas fixas, iguais para todos os indicadores: dá para comparar um mapa com o outro. */
const FAIXAS = [40, 50, 60, 70]

function faixaDe(valor: number) {
  const indice = FAIXAS.findIndex((limite) => valor < limite)
  return indice === -1 ? FAIXAS.length : indice
}

const LEGENDA = ['menos de 40%', '40 a 49%', '50 a 59%', '60 a 69%', '70% ou mais']

const hexagonos = computed(() =>
  REGIOES.map((regiao) => {
    const [cx, cy] = CENTRO_DA_POSICAO[regiao.posicao]
    const valor = regiao.cobertura[props.indicador]
    return {
      regiao,
      cx,
      cy,
      valor,
      faixa: faixaDe(valor),
      delta: valor - regiao.inicio[props.indicador],
    }
  }),
)

const definicao = computed(() => definicaoDo(props.indicador))

/* ----------------------------------------------------------------------------- detalhe */

const apontada = ref<IdDaRegiao | null>(null)

const dica = computed(() => {
  const alvo = hexagonos.value.find((item) => item.regiao.id === apontada.value)
  if (!alvo) return null
  return {
    ...alvo,
    esquerda: ((alvo.cx + LARGURA / 2) / LARGURA) * 100,
    topo: ((alvo.cy + ALTURA / 2) / ALTURA) * 100,
  }
})

function publico(regiao: Regiao) {
  return publicoDaRegiao(regiao, props.indicador)
}

function escolher(id: IdDaRegiao) {
  selecionada.value = selecionada.value === id ? null : id
}

function rotuloAcessivel(item: (typeof hexagonos.value)[number]) {
  return `${item.regiao.nome}: ${item.valor}% (${item.delta >= 0 ? '+' : ''}${item.delta} pontos desde o início)`
}
</script>

<template>
  <figure class="mapa-regioes">
    <div class="mapa-regioes__palco" @mouseleave="apontada = null">
      <svg
        class="mapa-regioes__svg"
        :viewBox="`${-LARGURA / 2} ${-ALTURA / 2} ${LARGURA} ${ALTURA}`"
        role="group"
        :aria-label="`Mapa esquemático das regiões: ${definicao.frase}`"
      >
        <g
          v-for="item in hexagonos"
          :key="item.regiao.id"
          class="hexagono"
          :class="[
            `hexagono--faixa-${item.faixa}`,
            { 'hexagono--escolhida': selecionada === item.regiao.id },
          ]"
          tabindex="0"
          role="button"
          :aria-pressed="selecionada === item.regiao.id"
          :aria-label="rotuloAcessivel(item)"
          @mouseenter="apontada = item.regiao.id"
          @focus="apontada = item.regiao.id"
          @blur="apontada = null"
          @click="escolher(item.regiao.id)"
          @keydown.enter.prevent="escolher(item.regiao.id)"
          @keydown.space.prevent="escolher(item.regiao.id)"
        >
          <polygon class="hexagono__forma" :points="pontos(item.cx, item.cy, R)" />
          <polygon class="hexagono__anel" :points="pontos(item.cx, item.cy, R - 7)" />
          <text class="hexagono__nome" :x="item.cx" :y="item.cy - 9" text-anchor="middle">
            {{ item.regiao.nome }}
          </text>
          <text class="hexagono__valor" :x="item.cx" :y="item.cy + 17" text-anchor="middle">
            {{ item.valor }}%
          </text>
        </g>
      </svg>

      <!-- O detalhe ao passar o mouse ou focar: maior que o hexágono, fora do caminho do dedo. -->
      <div
        v-if="dica"
        class="mapa-regioes__dica"
        :style="{ left: `${dica.esquerda}%`, top: `${dica.topo}%` }"
        aria-hidden="true"
      >
        <strong>{{ dica.regiao.nome }}</strong>
        <span>
          <b class="ui-num">{{ dica.valor }}%</b> dos {{ numero(publico(dica.regiao)) }}
          {{ definicao.publico === 'caes' ? 'cães' : 'cães e gatos' }}
        </span>
        <span class="mapa-regioes__delta">
          <i class="ph ph-arrow-up-right" aria-hidden="true" />
          +{{ dica.delta }} pontos desde o início
        </span>
      </div>
    </div>

    <figcaption class="mapa-regioes__legenda">
      <span class="mapa-regioes__titulo-legenda">{{ definicao.rotulo }}, em dia</span>
      <ol class="mapa-regioes__faixas">
        <li v-for="(rotulo, indice) in LEGENDA" :key="rotulo">
          <span
            class="mapa-regioes__amostra"
            :class="`hexagono--faixa-${indice}`"
            aria-hidden="true"
          />
          {{ rotulo }}
        </li>
      </ol>
      <span class="mapa-regioes__nota">
        Mapa esquemático: cada hexágono é uma região urbana, na posição dela em volta do Centro.
      </span>
    </figcaption>

    <table class="sr-only">
      <caption>
        {{
          definicao.rotulo
        }}
        por região urbana
      </caption>
      <thead>
        <tr>
          <th scope="col">Região</th>
          <th scope="col">Em dia hoje</th>
          <th scope="col">No início</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in hexagonos" :key="item.regiao.id">
          <th scope="row">{{ item.regiao.nome }}</th>
          <td>{{ item.valor }}%</td>
          <td>{{ item.regiao.inicio[indicador] }}%</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
/*
 * A escala de um verde só. Claro: do quase branco ao verde-floresta, com a tinta escura nas três
 * primeiras faixas e a clara nas duas últimas (contraste de leitura em todas). Escuro: a âncora
 * inverte, do verde perto do fundo ao verde-água claro.
 */
.mapa-regioes {
  --faixa-0: #dff2ea;
  --faixa-1: #b4e0cf;
  --faixa-2: #7fc4aa;
  --faixa-3: #357d66;
  --faixa-4: #24604f;
  --tinta-0: #142721;
  --tinta-1: #142721;
  --tinta-2: #142721;
  --tinta-3: #ffffff;
  --tinta-4: #ffffff;

  display: grid;
  gap: 14px;
  margin: 0;
}

.app-dark .mapa-regioes {
  --faixa-0: #1f332c;
  --faixa-1: #26493e;
  --faixa-2: #2f6655;
  --faixa-3: #4d9a80;
  --faixa-4: #8fd1b8;
  --tinta-0: #e8f2ee;
  --tinta-1: #e8f2ee;
  --tinta-2: #ffffff;
  --tinta-3: #0f1f1a;
  --tinta-4: #0f1f1a;
}

.mapa-regioes__palco {
  position: relative;
  width: min(100%, 420px);
  justify-self: center;
}

.mapa-regioes__svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.hexagono {
  cursor: pointer;
  outline: none;
}

.hexagono__forma {
  stroke: var(--superficie);
  stroke-linejoin: round;
  stroke-width: 5;
  transition: filter var(--pj-tempo-curto) var(--pj-curva-chega);
}

.hexagono__anel {
  fill: none;
  stroke: transparent;
  stroke-linejoin: round;
  stroke-width: 3;
}

.hexagono:hover .hexagono__forma {
  filter: brightness(0.96);
}

.app-dark .hexagono:hover .hexagono__forma {
  filter: brightness(1.12);
}

/* Escolhida: um anel por dentro na cor da tinta da faixa. Foco: o mesmo anel, tracejado. */
.hexagono--escolhida .hexagono__anel {
  stroke: var(--tinta-hex);
}

.hexagono:focus-visible .hexagono__anel {
  stroke: var(--tinta-hex);
  stroke-dasharray: 6 4;
}

.hexagono__nome {
  fill: var(--tinta-hex);
  font-size: 12.5px;
  font-weight: 700;
  pointer-events: none;
}

.hexagono__valor {
  fill: var(--tinta-hex);
  font-family: var(--font-dados);
  font-size: 22px;
  font-weight: 750;
  pointer-events: none;
}

.hexagono--faixa-0 {
  --tinta-hex: var(--tinta-0);
  fill: var(--faixa-0);
}

.hexagono--faixa-1 {
  --tinta-hex: var(--tinta-1);
  fill: var(--faixa-1);
}

.hexagono--faixa-2 {
  --tinta-hex: var(--tinta-2);
  fill: var(--faixa-2);
}

.hexagono--faixa-3 {
  --tinta-hex: var(--tinta-3);
  fill: var(--faixa-3);
}

.hexagono--faixa-4 {
  --tinta-hex: var(--tinta-4);
  fill: var(--faixa-4);
}

/* O detalhe: um cartão pequeno acima do hexágono, sem cobrir o número dele. O mapa não espelha
 * no árabe (a geografia é a mesma), então a posição é sempre pela esquerda. */
.mapa-regioes__dica {
  position: absolute;
  z-index: 2;
  display: grid;
  width: max-content;
  max-width: 15rem;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie);
  box-shadow: 0 10px 28px -12px rgb(0 0 0 / 35%);
  color: var(--tinta-2);
  font-size: 12.5px;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 44px));
}

.mapa-regioes__dica strong {
  color: var(--tinta);
  font-size: 13.5px;
}

.mapa-regioes__dica b {
  color: var(--tinta);
}

.mapa-regioes__delta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ok-tinta);
  font-weight: 650;
}

.mapa-regioes__legenda {
  display: grid;
  gap: 8px;
  justify-items: center;
  color: var(--tinta-2);
  font-size: 12.5px;
  text-align: center;
}

.mapa-regioes__titulo-legenda {
  color: var(--tinta);
  font-weight: 650;
}

.mapa-regioes__faixas {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mapa-regioes__faixas li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mapa-regioes__amostra {
  width: 14px;
  height: 14px;
  border: 1px solid var(--linha-media);
  border-radius: 4px;
}

.mapa-regioes__amostra.hexagono--faixa-0 {
  background: var(--faixa-0);
}

.mapa-regioes__amostra.hexagono--faixa-1 {
  background: var(--faixa-1);
}

.mapa-regioes__amostra.hexagono--faixa-2 {
  background: var(--faixa-2);
}

.mapa-regioes__amostra.hexagono--faixa-3 {
  background: var(--faixa-3);
}

.mapa-regioes__amostra.hexagono--faixa-4 {
  background: var(--faixa-4);
}

.mapa-regioes__nota {
  color: var(--tinta-3);
  font-size: 12px;
}

.sr-only {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .hexagono__forma {
    transition: none;
  }
}
</style>
