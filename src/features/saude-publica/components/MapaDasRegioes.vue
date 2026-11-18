<script setup lang="ts">
/**
 * O mapa esquemático das 7 regiões urbanas de Campo Grande: um hexágono por região, cada um na
 * posição dela em volta do Centro (Segredo ao norte, Prosa a nordeste, Bandeira a sudeste,
 * Anhanduizinho ao sul, Lagoa a sudoeste, Imbirussu a noroeste). Não é o contorno de verdade: é a
 * vizinhança, que é o que o gestor precisa para ver onde agir.
 *
 * A cor é a escala de perigo (`escala-de-perigo.css`, 17/11/2026): vermelho com menos de 40% em
 * dia, verde com 70% ou mais. O número vai escrito no hexágono, então a cor nunca fala sozinha.
 * Passar o mouse (ou o foco) mostra o detalhe; clicar escolhe a região. Para leitor de tela, a mesma
 * informação vai numa tabela.
 *
 * Segue o recorte dos filtros, como o mapa da cidade: o número do fim do período, na espécie; as
 * regiões fora das escolhidas recuam.
 */
import { computed, ref } from 'vue'

import {
  indicador as definicaoDo,
  numero,
  REGIOES,
  type IdDaRegiao,
  type Indicador,
  type Posicao,
} from '@/features/saude-publica/dados'
import '@/features/saude-publica/escala-de-perigo.css'
import {
  coberturaDaRegiao,
  pontos as pontosNoPeriodo,
  publicoNoRecorte,
  RECORTE_INTEIRO,
  seAplica,
  type Recorte,
} from '@/features/saude-publica/serie'

const props = withDefaults(defineProps<{ indicador: Indicador; recorte?: Recorte }>(), {
  recorte: () => RECORTE_INTEIRO,
})
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

/** A faixa da cor; sem número (gato num indicador só de cães), a faixa "sem". */
function faixaDe(valor: number | null) {
  if (valor === null) return 'sem'
  const indice = FAIXAS.findIndex((limite) => valor < limite)
  return indice === -1 ? FAIXAS.length : indice
}

const LEGENDA = ['menos de 40%', '40 a 49%', '50 a 59%', '60 a 69%', '70% ou mais']

const aplica = computed(() => seAplica(props.indicador, props.recorte.especie))

const hexagonos = computed(() =>
  REGIOES.map((regiao) => {
    const [cx, cy] = CENTRO_DA_POSICAO[regiao.posicao]
    const { de, ate, especie, regioes } = props.recorte
    const valor = aplica.value
      ? Math.round(coberturaDaRegiao(regiao, props.indicador, ate, especie))
      : null
    const comeco = aplica.value
      ? Math.round(coberturaDaRegiao(regiao, props.indicador, de, especie))
      : null
    return {
      regiao,
      cx,
      cy,
      valor,
      faixa: faixaDe(valor),
      delta: valor !== null && comeco !== null ? valor - comeco : null,
      fora: regioes.length > 0 && !regioes.includes(regiao.id),
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

function publico(regiao: (typeof REGIOES)[number]) {
  return publicoNoRecorte(regiao, props.indicador, props.recorte.especie)
}

/** Quem conta no número: "cães", "gatos" ou "cães e gatos". */
const quemConta = computed(() => {
  if (definicao.value.publico === 'caes' || props.recorte.especie === 'caes') return 'cães'
  return props.recorte.especie === 'gatos' ? 'gatos' : 'cães e gatos'
})

function escolher(id: IdDaRegiao) {
  selecionada.value = selecionada.value === id ? null : id
}

function rotuloAcessivel(item: (typeof hexagonos.value)[number]) {
  if (item.valor === null) return `${item.regiao.nome}: não se aplica a gatos`
  return `${item.regiao.nome}: ${item.valor}% (${pontosNoPeriodo(item.delta ?? 0)} no período)`
}
</script>

<template>
  <figure class="mapa-regioes sp-escala">
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
            {
              'hexagono--escolhida': selecionada === item.regiao.id,
              'hexagono--fora': item.fora,
            },
          ]"
          tabindex="0"
          role="button"
          :aria-pressed="selecionada === item.regiao.id"
          :aria-label="rotuloAcessivel(item)"
          :data-regiao="item.regiao.id"
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
            {{ item.valor === null ? '—' : `${item.valor}%` }}
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
        <template v-if="dica.valor !== null">
          <span>
            <b class="ui-num">{{ dica.valor }}%</b> dos {{ numero(publico(dica.regiao)) }}
            {{ quemConta }}
          </span>
          <span class="mapa-regioes__delta">
            <i class="ph ph-arrow-up-right" aria-hidden="true" />
            {{ pontosNoPeriodo(dica.delta ?? 0) }} no período
          </span>
        </template>
        <span v-else>Não se aplica a gatos</span>
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
          <th scope="col">Em dia no fim do período</th>
          <th scope="col">Pontos no período</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in hexagonos.filter((hexagono) => !hexagono.fora)" :key="item.regiao.id">
          <th scope="row">{{ item.regiao.nome }}</th>
          <td>{{ item.valor === null ? 'não se aplica' : `${item.valor}%` }}</td>
          <td>{{ item.delta === null ? '—' : pontosNoPeriodo(item.delta) }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
/* A escala de perigo vem de `escala-de-perigo.css` (`sp-escala`), com a tinta escura por cima. */
.mapa-regioes {
  display: grid;
  gap: 14px;
  margin: 0;
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
  /* O fio entre os hexágonos é o fundo da caixa em que o mapa mora. */
  stroke: var(--app-painel, var(--app-veu, var(--superficie)));
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
  --tinta-hex: var(--tinta-faixa);
  fill: var(--faixa-0);
}

.hexagono--faixa-1 {
  --tinta-hex: var(--tinta-faixa);
  fill: var(--faixa-1);
}

.hexagono--faixa-2 {
  --tinta-hex: var(--tinta-faixa);
  fill: var(--faixa-2);
}

.hexagono--faixa-3 {
  --tinta-hex: var(--tinta-faixa);
  fill: var(--faixa-3);
}

.hexagono--faixa-4 {
  --tinta-hex: var(--tinta-faixa);
  fill: var(--faixa-4);
}

/* Sem número (gato num indicador só de cães): a região fica em papel, com a tinta da casa. */
.hexagono--faixa-sem {
  --tinta-hex: var(--tinta-2);
  fill: var(--superficie-2, #e9eeec);
}

/*
 * Fora das regiões escolhidas: em cinza com a tinta da casa (transparência deixava o número escuro
 * sobre o fundo escuro), como os bairros de fora no mapa da cidade. Continua clicável.
 */
.hexagono.hexagono--fora {
  --tinta-hex: var(--tinta-2);
  fill: #dfe4e2;
}

.app-dark .hexagono.hexagono--fora {
  fill: #2a3330;
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
