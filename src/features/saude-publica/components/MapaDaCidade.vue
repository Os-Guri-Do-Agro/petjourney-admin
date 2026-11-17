<script setup lang="ts">
/**
 * O mapa de Campo Grande do painel (17/11/2026, "mapa de calor de Campo Grande"): os 74 bairros
 * oficiais pintados pelo indicador escolhido, as 7 regiões urbanas com a divisa mais forte e um
 * rótulo cada, sobre as ruas da cidade.
 *
 * - **Contornos**: IBGE, Censo 2022 (`mapa/campo-grande.json`), gravados no projeto: nenhuma API
 *   em tempo real para desenhar a cidade.
 * - **Ruas**: MapLibre com o OpenFreeMap (sem chave nem cadastro), estilo claro ou escuro conforme
 *   o tema. Sem rede, o mapa abre sem as ruas e os bairros continuam pintados.
 * - **Cor**: a mesma escala de um verde só, em cinco faixas, do esquema anterior; o número da região
 *   vai escrito no rótulo, então a cor nunca fala sozinha.
 * - **Gestos**: rolar a página não mexe no mapa (Ctrl + rolagem aproxima; no tablet, dois dedos).
 *
 * Passar o mouse num bairro mostra o detalhe dele; clicar num bairro ou no rótulo escolhe a região.
 * O rótulo é botão, então o teclado também escolhe. Sem WebGL, volta o esquema em hexágonos.
 */
import type {
  ExpressionSpecification,
  FilterSpecification,
  Map as MapaLibre,
  MapLayerMouseEvent,
  Marker,
  StyleSpecification,
} from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import Skeleton from 'primevue/skeleton'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import MapaDasRegioes from '@/features/saude-publica/components/MapaDasRegioes.vue'
import {
  BAIRROS,
  indicador as definicaoDo,
  numero,
  publicoDaRegiao,
  publicoDoBairro,
  regiao as regiaoDe,
  REGIOES,
  type IdDaRegiao,
  type Indicador,
} from '@/features/saude-publica/dados'
import { isDarkMode } from '@/theme/color-mode'

const props = defineProps<{ indicador: Indicador }>()
const selecionada = defineModel<IdDaRegiao | null>('selecionada', { default: null })

const definicao = computed(() => definicaoDo(props.indicador))

/* ------------------------------------------------------------------------------- a cidade */

/** O retângulo dos 74 bairros (IBGE), e a folga até onde dá para arrastar. */
const LIMITES: [[number, number], [number, number]] = [
  [-54.7632, -20.5909],
  [-54.5035, -20.3708],
]
const FOLGA = 0.12

const ESTILO_DE_FUNDO = {
  claro: 'https://tiles.openfreemap.org/styles/positron',
  escuro: 'https://tiles.openfreemap.org/styles/dark',
}

/** Cinco faixas fixas, as mesmas do esquema e da lista de bairros. */
const FAIXAS = [40, 50, 60, 70]
const LEGENDA = ['menos de 40%', '40 a 49%', '50 a 59%', '60 a 69%', '70% ou mais']

/* ---------------------------------------------------------------------------------- estado */

const figura = ref<HTMLElement | null>(null)
const palco = ref<HTMLDivElement | null>(null)
const mapa = shallowRef<MapaLibre | null>(null)
const carregando = ref(true)
const semRuas = ref(false)
/** Sem WebGL (ou o MapLibre não abriu): volta o esquema em hexágonos. */
const semMapa = ref(false)

/** Um elemento por região, onde o MapLibre põe o rótulo; o Vue desenha o rótulo dentro. */
const alvosDosRotulos = shallowRef<{ id: IdDaRegiao; elemento: HTMLElement }[]>([])
let marcadores: Marker[] = []

type BairroApontado = {
  nome: string
  regiao: IdDaRegiao
  valor: number | null
  publico: number
  x: number
  y: number
}
const apontado = ref<BairroApontado | null>(null)

const rotulos = computed(() =>
  alvosDosRotulos.value.map(({ id, elemento }) => {
    const regiao = regiaoDe(id)
    const valor = regiao.cobertura[props.indicador]
    return {
      id,
      elemento,
      regiao,
      valor,
      delta: valor - regiao.inicio[props.indicador],
    }
  }),
)

/* ---------------------------------------------------------------------------------- cores */

type Paleta = {
  faixas: string[]
  opacidade: number
  divisa: string
  fio: string
  escolhida: string
  fundo: string
}

function lerPaleta(): Paleta {
  const estilo = getComputedStyle(figura.value ?? document.documentElement)
  const ler = (nome: string) => estilo.getPropertyValue(nome).trim()
  return {
    faixas: [0, 1, 2, 3, 4].map((indice) => ler(`--faixa-${indice}`)),
    opacidade: Number(ler('--mapa-opacidade')) || 0.74,
    divisa: ler('--mapa-divisa'),
    fio: ler('--mapa-fio'),
    escolhida: ler('--mapa-escolhida'),
    fundo: ler('--mapa-fundo'),
  }
}

function corDoIndicador(paleta: Paleta): ExpressionSpecification {
  const [f0, f1, f2, f3, f4] = paleta.faixas as [string, string, string, string, string]
  const [l0, l1, l2, l3] = FAIXAS as [number, number, number, number]
  return [
    'case',
    ['has', props.indicador],
    ['step', ['get', props.indicador], f0, l0, f1, l1, f2, l2, f3, l3, f4],
    'rgba(0, 0, 0, 0)',
  ]
}

/* ------------------------------------------------------------------------------- montagem */

/** O estilo das ruas, sem os pontos de interesse; sem rede, só o fundo liso. */
async function estiloDeFundo(paleta: Paleta): Promise<StyleSpecification> {
  try {
    const resposta = await fetch(isDarkMode.value ? ESTILO_DE_FUNDO.escuro : ESTILO_DE_FUNDO.claro)
    if (!resposta.ok) throw new Error(String(resposta.status))
    const estilo = (await resposta.json()) as StyleSpecification
    /* Sem pontos de interesse nem nomes de lugar: o nome da cidade caía em cima do rótulo do
     * Centro, e os bairros já têm nome no detalhe. Os nomes das ruas ficam. */
    const tirar = new Set(['poi', 'housenumber', 'aerodrome_label', 'place'])
    estilo.layers = estilo.layers.filter(
      (camada) => !('source-layer' in camada && tirar.has(camada['source-layer'] ?? '')),
    )
    semRuas.value = false
    return estilo
  } catch {
    semRuas.value = true
    return {
      version: 8,
      sources: {},
      layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': paleta.fundo } }],
    }
  }
}

async function montar() {
  carregando.value = true
  apontado.value = null

  try {
    const [maplibregl, { default: geo }, { default: urlDoWorker }] = await Promise.all([
      import('maplibre-gl'),
      import('@/features/saude-publica/mapa/campo-grande.json'),
      /* O worker vem separado: o pré-empacotamento do Vite não leva o arquivo vizinho junto. */
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])
    maplibregl.setWorkerUrl(urlDoWorker)
    await nextTick()
    if (!palco.value) return

    const paleta = lerPaleta()
    const estilo = await estiloDeFundo(paleta)
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const instancia = new maplibregl.Map({
      container: palco.value,
      style: estilo,
      bounds: LIMITES,
      fitBoundsOptions: { padding: 18 },
      maxBounds: [
        [LIMITES[0][0] - FOLGA, LIMITES[0][1] - FOLGA],
        [LIMITES[1][0] + FOLGA, LIMITES[1][1] + FOLGA],
      ],
      minZoom: 9.5,
      maxZoom: 15.5,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      cooperativeGestures: true,
      fadeDuration: reduzido ? 0 : 300,
      attributionControl: { compact: true },
      locale: {
        'Map.Title': 'Mapa de Campo Grande',
        'NavigationControl.ZoomIn': 'Aproximar',
        'NavigationControl.ZoomOut': 'Afastar',
        'AttributionControl.ToggleAttribution': 'Créditos do mapa',
        'CooperativeGesturesHandler.WindowsHelpText': 'Use Ctrl + rolagem para aproximar o mapa',
        'CooperativeGesturesHandler.MacHelpText': 'Use ⌘ + rolagem para aproximar o mapa',
        'CooperativeGesturesHandler.MobileHelpText': 'Use dois dedos para mover o mapa',
      },
    })
    instancia.touchZoomRotate.disableRotation()
    instancia.addControl(
      new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
      'top-right',
    )
    mapa.value = instancia

    instancia.on('load', () => {
      /* Os números ilustrativos de cada bairro entram nas propriedades do contorno. */
      const porNome = new Map(BAIRROS.map((bairro) => [bairro.nome, bairro]))
      const bairros = {
        ...geo.bairros,
        features: geo.bairros.features.map((feature) => {
          const dados = porNome.get(feature.properties.nome)
          return {
            ...feature,
            properties: {
              ...feature.properties,
              ...(dados ? { ...dados.cobertura, caes: dados.caes, gatos: dados.gatos } : {}),
            },
          }
        }),
      } as FeatureCollection

      /* Os bairros e as divisas ficam embaixo dos nomes das ruas. */
      const antesDosNomes = instancia
        .getStyle()
        .layers.find((camada) => camada.type === 'symbol')?.id

      instancia.addSource('bairros', { type: 'geojson', data: bairros })
      instancia.addSource('regioes', {
        type: 'geojson',
        data: geo.regioes as FeatureCollection,
      })

      instancia.addLayer(
        {
          id: 'bairros-cor',
          type: 'fill',
          source: 'bairros',
          paint: { 'fill-color': corDoIndicador(paleta), 'fill-opacity': paleta.opacidade },
        },
        antesDosNomes,
      )
      instancia.addLayer(
        {
          id: 'bairros-fio',
          type: 'line',
          source: 'bairros',
          paint: { 'line-color': paleta.fio, 'line-width': 0.8 },
        },
        antesDosNomes,
      )
      instancia.addLayer(
        {
          id: 'regioes-divisa',
          type: 'line',
          source: 'regioes',
          layout: { 'line-join': 'round' },
          paint: { 'line-color': paleta.divisa, 'line-width': 1.8 },
        },
        antesDosNomes,
      )
      instancia.addLayer({
        id: 'bairro-apontado',
        type: 'line',
        source: 'bairros',
        filter: filtroDoBairro(null),
        layout: { 'line-join': 'round' },
        paint: { 'line-color': paleta.escolhida, 'line-width': 2.4 },
      })
      instancia.addLayer({
        id: 'regiao-escolhida',
        type: 'line',
        source: 'regioes',
        filter: filtroDaRegiao(selecionada.value),
        layout: { 'line-join': 'round' },
        paint: { 'line-color': paleta.escolhida, 'line-width': 3.4 },
      })

      instancia.on('mousemove', 'bairros-cor', apontar)
      instancia.on('mouseleave', 'bairros-cor', () => {
        apontado.value = null
        instancia.getCanvas().style.cursor = ''
        instancia.setFilter('bairro-apontado', filtroDoBairro(null))
      })
      instancia.on('click', 'bairros-cor', (evento) => {
        const regiao = evento.features?.[0]?.properties?.regiao as IdDaRegiao | undefined
        if (regiao) escolher(regiao)
      })

      /* Um rótulo por região, no ponto de dentro dela; o Vue desenha o conteúdo. */
      marcadores = []
      alvosDosRotulos.value = REGIOES.map(({ id }) => {
        const elemento = document.createElement('div')
        elemento.className = 'mapa-cidade__alvo'
        const ponto = geo.rotulos[id as keyof typeof geo.rotulos] as [number, number]
        marcadores.push(
          new maplibregl.Marker({ element: elemento, anchor: 'center' })
            .setLngLat(ponto)
            .addTo(instancia),
        )
        return { id, elemento }
      })

      carregando.value = false
    })
  } catch {
    semMapa.value = true
    carregando.value = false
  }
}

function desmontar() {
  for (const marcador of marcadores) marcador.remove()
  marcadores = []
  alvosDosRotulos.value = []
  mapa.value?.remove()
  mapa.value = null
}

function filtroDoBairro(nome: string | null): FilterSpecification {
  return ['==', ['get', 'nome'], nome ?? '']
}

function filtroDaRegiao(id: IdDaRegiao | null): FilterSpecification {
  return ['==', ['get', 'regiao'], id ?? '']
}

/* ---------------------------------------------------------------------------- interação */

function apontar(evento: MapLayerMouseEvent) {
  const feature = evento.features?.[0]
  const instancia = mapa.value
  if (!feature || !instancia) return
  const propriedades = feature.properties as Record<string, unknown>
  const nome = String(propriedades.nome)
  const valor =
    typeof propriedades[props.indicador] === 'number' ? propriedades[props.indicador] : null
  const publico =
    typeof propriedades.caes === 'number'
      ? publicoDoBairro(
          { caes: propriedades.caes, gatos: Number(propriedades.gatos ?? 0) },
          props.indicador,
        )
      : 0

  instancia.getCanvas().style.cursor = 'pointer'
  instancia.setFilter('bairro-apontado', filtroDoBairro(nome))
  apontado.value = {
    nome,
    regiao: propriedades.regiao as IdDaRegiao,
    valor: valor as number | null,
    publico,
    x: evento.point.x,
    y: evento.point.y,
  }
}

function escolher(id: IdDaRegiao) {
  selecionada.value = selecionada.value === id ? null : id
}

function rotuloAcessivel(item: (typeof rotulos.value)[number]) {
  return `Região ${item.regiao.nome}: ${item.valor}% (${item.delta >= 0 ? '+' : ''}${item.delta} pontos desde o início). Abrir o detalhe.`
}

watch(
  () => props.indicador,
  () => {
    if (!mapa.value?.getLayer('bairros-cor')) return
    mapa.value.setPaintProperty('bairros-cor', 'fill-color', corDoIndicador(lerPaleta()))
  },
)

watch(selecionada, (id) => {
  if (mapa.value?.getLayer('regiao-escolhida')) {
    mapa.value.setFilter('regiao-escolhida', filtroDaRegiao(id))
  }
})

/* O tema troca o estilo das ruas e as cores: o mapa monta de novo. */
watch(isDarkMode, async () => {
  if (semMapa.value) return
  desmontar()
  await nextTick()
  await montar()
})

onMounted(() => void montar())
onBeforeUnmount(desmontar)
</script>

<template>
  <figure ref="figura" class="mapa-cidade">
    <MapaDasRegioes
      v-if="semMapa"
      :indicador="indicador"
      :selecionada="selecionada"
      @update:selecionada="selecionada = $event"
    />

    <div v-else class="mapa-cidade__moldura" @mouseleave="apontado = null">
      <div
        ref="palco"
        class="mapa-cidade__palco"
        role="region"
        :aria-label="`Mapa de Campo Grande por bairro: ${definicao.frase}`"
      />
      <Skeleton v-if="carregando" class="mapa-cidade__esqueleto" height="100%" />

      <!-- O detalhe do bairro, perto do ponteiro e fora do caminho dele. -->
      <div
        v-if="apontado"
        class="mapa-cidade__dica"
        :style="{ left: `${apontado.x}px`, top: `${apontado.y}px` }"
        aria-hidden="true"
      >
        <strong>{{ apontado.nome }}</strong>
        <span class="mapa-cidade__regiao">Região {{ regiaoDe(apontado.regiao).nome }}</span>
        <span v-if="apontado.valor !== null">
          <b class="ui-num">{{ apontado.valor }}%</b> dos {{ numero(apontado.publico) }}
          {{ definicao.publico === 'caes' ? 'cães' : 'cães e gatos' }}
        </span>
      </div>
    </div>

    <!-- Os rótulos das regiões, dentro dos marcadores do MapLibre. -->
    <Teleport v-for="item in rotulos" :key="item.id" :to="item.elemento">
      <button
        type="button"
        class="mapa-cidade__rotulo"
        :class="{ 'mapa-cidade__rotulo--escolhido': selecionada === item.id }"
        :aria-pressed="selecionada === item.id"
        :aria-label="rotuloAcessivel(item)"
        @click="escolher(item.id)"
      >
        <span class="mapa-cidade__rotulo-nome">{{ item.regiao.nome }}</span>
        <span class="mapa-cidade__rotulo-valor ui-num">{{ item.valor }}%</span>
      </button>
    </Teleport>

    <figcaption v-if="!semMapa" class="mapa-cidade__legenda">
      <span class="mapa-cidade__titulo-legenda">{{ definicao.rotulo }}, em dia</span>
      <ol class="mapa-cidade__faixas">
        <li v-for="(rotulo, indice) in LEGENDA" :key="rotulo">
          <span class="mapa-cidade__amostra" :style="{ background: `var(--faixa-${indice})` }" />
          {{ rotulo }}
        </li>
      </ol>
      <span class="mapa-cidade__fonte">
        Bairros e regiões urbanas: IBGE, Censo 2022.
        <template v-if="semRuas"
          >As ruas não carregaram agora; os bairros continuam no lugar.</template
        >
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
          <th scope="col">Animais</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="regiao in REGIOES" :key="regiao.id">
          <th scope="row">{{ regiao.nome }}</th>
          <td>{{ regiao.cobertura[indicador] }}%</td>
          <td>{{ regiao.inicio[indicador] }}%</td>
          <td>{{ numero(publicoDaRegiao(regiao, indicador)) }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
/*
 * A escala de um verde só (a mesma do esquema). Claro: do quase branco ao verde-floresta. Escuro: a
 * âncora inverte, do verde perto do fundo ao verde-água claro. As divisas: a tinta da casa no claro,
 * um fio claro no escuro.
 */
.mapa-cidade {
  --faixa-0: #cdeadf;
  --faixa-1: #a4d8c4;
  --faixa-2: #6fb89d;
  --faixa-3: #357d66;
  --faixa-4: #24604f;
  --mapa-divisa: #1d3557;
  --mapa-fio: rgb(255 255 255 / 85%);
  --mapa-escolhida: #10302a;
  --mapa-fundo: #eef2f0;
  --mapa-opacidade: 0.74;

  display: grid;
  gap: 14px;
  margin: 0;
}

.app-dark .mapa-cidade {
  --faixa-0: #1f332c;
  --faixa-1: #26493e;
  --faixa-2: #2f6655;
  --faixa-3: #4d9a80;
  --faixa-4: #8fd1b8;
  --mapa-divisa: #dfe9e5;
  --mapa-fio: rgb(18 25 23 / 80%);
  --mapa-escolhida: #ffffff;
  --mapa-fundo: #18211e;
  --mapa-opacidade: 0.88;
}

.mapa-cidade__moldura {
  position: relative;
  overflow: hidden;
  height: clamp(420px, 58vh, 560px);
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--mapa-fundo);
}

.mapa-cidade__palco {
  position: absolute;
  inset: 0;
}

.mapa-cidade__esqueleto {
  position: absolute;
  inset: 0;
  border-radius: 0;
}

/* O rótulo da região: uma pílula na superfície, nome e número, por cima dos bairros. */
.mapa-cidade__rotulo {
  display: grid;
  justify-items: center;
  padding: 4px 10px 5px;
  border: 1px solid color-mix(in oklab, var(--tinta) 14%, transparent);
  border-radius: 12px;
  background: color-mix(in oklab, var(--superficie) 92%, transparent);
  box-shadow: 0 6px 16px -10px rgb(0 0 0 / 45%);
  color: var(--tinta);
  cursor: pointer;
  /* O MapLibre põe Helvetica/Arial no mapa inteiro: o rótulo volta à letra do portal. */
  font-family: var(--font-texto);
  line-height: 1.1;
  white-space: nowrap;
}

.mapa-cidade__rotulo:hover {
  border-color: color-mix(in oklab, var(--tinta) 32%, transparent);
}

.mapa-cidade__rotulo:focus-visible {
  outline: 2px solid var(--mapa-escolhida);
  outline-offset: 2px;
}

.mapa-cidade__rotulo--escolhido {
  border-color: var(--mapa-escolhida);
  box-shadow: 0 0 0 1px var(--mapa-escolhida);
}

.mapa-cidade__rotulo-nome {
  font-size: 11.5px;
  font-weight: 650;
}

.mapa-cidade__rotulo-valor {
  font-family: var(--font-dados);
  font-size: 16px;
  font-weight: 750;
}

/* O detalhe do bairro: acima e à direita do ponteiro. O mapa não espelha no árabe. */
.mapa-cidade__dica {
  position: absolute;
  z-index: 3;
  display: grid;
  width: max-content;
  max-width: 15rem;
  gap: 2px;
  padding: 9px 12px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie);
  box-shadow: 0 10px 28px -12px rgb(0 0 0 / 35%);
  color: var(--tinta-2);
  font-size: 12.5px;
  pointer-events: none;
  transform: translate(14px, calc(-100% - 10px));
}

.mapa-cidade__dica strong {
  color: var(--tinta);
  font-size: 13.5px;
}

.mapa-cidade__dica b {
  color: var(--tinta);
}

.mapa-cidade__regiao {
  font-size: 12px;
}

.mapa-cidade__legenda {
  display: grid;
  gap: 8px;
  justify-items: center;
  color: var(--tinta-2);
  font-size: 12.5px;
  text-align: center;
}

.mapa-cidade__titulo-legenda {
  color: var(--tinta);
  font-weight: 650;
}

.mapa-cidade__faixas {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mapa-cidade__faixas li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mapa-cidade__amostra {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--tinta) 12%, transparent);
}

/* No escuro, as faixas baixas ficam perto do fundo da caixa: o contorno da amostra aparece mais. */
.app-dark .mapa-cidade__amostra {
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--tinta) 38%, transparent);
}

.mapa-cidade__fonte {
  color: var(--tinta-3);
  font-size: 11.5px;
}

/* Os controles do MapLibre no desenho da casa: + e − em véu, cantos de 12. */
.mapa-cidade :deep(.maplibregl-ctrl-group) {
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie);
  box-shadow: none;
}

.mapa-cidade :deep(.maplibregl-ctrl-group button + button) {
  border-top: 1px solid var(--linha);
}

.app-dark .mapa-cidade :deep(.maplibregl-ctrl-icon) {
  filter: invert(1);
}

.mapa-cidade :deep(.maplibregl-ctrl-attrib) {
  font-size: 10.5px;
}

.mapa-cidade :deep(.maplibregl-cooperative-gesture-screen) {
  font-family: inherit;
  font-size: 15px;
}
</style>
