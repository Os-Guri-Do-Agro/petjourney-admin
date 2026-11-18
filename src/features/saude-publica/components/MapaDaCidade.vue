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
 * - **Recorte** (`serie.ts`): os números são os do fim do período escolhido, na espécie escolhida;
 *   com regiões escolhidas, o mapa se aproxima delas e os bairros de fora ficam em cinza.
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
  regiao as regiaoDe,
  REGIOES,
  type IdDaRegiao,
  type Indicador,
} from '@/features/saude-publica/dados'
import {
  coberturaDaRegiao,
  coberturaDoBairro,
  pontos,
  publicoNoRecorte,
  RECORTE_INTEIRO,
  seAplica,
  type Recorte,
} from '@/features/saude-publica/serie'
import '@/features/saude-publica/escala-de-perigo.css'
import { isDarkMode } from '@/theme/color-mode'

const props = withDefaults(defineProps<{ indicador: Indicador; recorte?: Recorte }>(), {
  recorte: () => RECORTE_INTEIRO,
})
const selecionada = defineModel<IdDaRegiao | null>('selecionada', { default: null })

const definicao = computed(() => definicaoDo(props.indicador))
const aplica = computed(() => seAplica(props.indicador, props.recorte.especie))

/** Quem conta no número: "cães", "gatos" ou "cães e gatos". */
const quemConta = computed(() => {
  if (definicao.value.publico === 'caes' || props.recorte.especie === 'caes') return 'cães'
  return props.recorte.especie === 'gatos' ? 'gatos' : 'cães e gatos'
})

const dentro = (id: IdDaRegiao) =>
  !props.recorte.regioes.length || props.recorte.regioes.includes(id)

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
  delta: number | null
  publico: number
  x: number
  y: number
}
const apontado = ref<BairroApontado | null>(null)

/** O número da região no fim do período e quanto andou nele (nulo quando não se aplica). */
function daRegiao(id: IdDaRegiao) {
  const regiao = regiaoDe(id)
  if (!aplica.value) return { regiao, valor: null, delta: null }
  const { de, ate, especie } = props.recorte
  const valor = Math.round(coberturaDaRegiao(regiao, props.indicador, ate, especie))
  const comeco = Math.round(coberturaDaRegiao(regiao, props.indicador, de, especie))
  return { regiao, valor, delta: valor - comeco }
}

const rotulos = computed(() =>
  alvosDosRotulos.value.map(({ id, elemento }) => ({
    id,
    elemento,
    fora: !dentro(id),
    ...daRegiao(id),
  })),
)

/* ---------------------------------------------------------------------------------- cores */

type Paleta = {
  faixas: string[]
  fora: string
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
    fora: ler('--mapa-fora'),
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
    ['==', ['get', 'fora'], true],
    paleta.fora,
    ['has', 'valor'],
    ['step', ['get', 'valor'], f0, l0, f1, l1, f2, l2, f3, l3, f4],
    'rgba(0, 0, 0, 0)',
  ]
}

/* --------------------------------------------------------------------------- os números */

type Geo = typeof import('@/features/saude-publica/mapa/campo-grande.json')
let geoCarregado: Geo | null = null

/** Os contornos com o número de cada bairro no recorte: `valor` (se aplica), `delta` e `fora`. */
function bairrosNoRecorte(geo: Geo): FeatureCollection {
  const porNome = new Map(BAIRROS.map((bairro) => [bairro.nome, bairro]))
  const { de, ate, especie } = props.recorte
  return {
    ...geo.bairros,
    features: geo.bairros.features.map((feature) => {
      const bairro = porNome.get(feature.properties.nome)
      const regiao = feature.properties.regiao as IdDaRegiao
      let numeros = {}
      if (bairro && aplica.value) {
        const valor = Math.round(coberturaDoBairro(bairro, props.indicador, ate, especie))
        const comeco = Math.round(coberturaDoBairro(bairro, props.indicador, de, especie))
        numeros = {
          valor,
          delta: valor - comeco,
          publico: publicoNoRecorte(bairro, props.indicador, especie),
        }
      }
      return {
        ...feature,
        properties: { ...feature.properties, ...numeros, fora: !dentro(regiao) },
      }
    }),
  } as FeatureCollection
}

/** O retângulo das regiões escolhidas (ou da cidade), para o mapa se aproximar delas. */
function limitesDoRecorte(geo: Geo): [[number, number], [number, number]] {
  if (!props.recorte.regioes.length) return LIMITES
  let [oeste, sul, leste, norte] = [180, 90, -180, -90]
  const visitar = (coordenadas: unknown): void => {
    if (typeof (coordenadas as number[])[0] === 'number') {
      const [x, y] = coordenadas as [number, number]
      oeste = Math.min(oeste, x)
      leste = Math.max(leste, x)
      sul = Math.min(sul, y)
      norte = Math.max(norte, y)
      return
    }
    for (const filho of coordenadas as unknown[]) visitar(filho)
  }
  for (const feature of geo.regioes.features) {
    if (props.recorte.regioes.includes(feature.properties.regiao as IdDaRegiao)) {
      visitar(feature.geometry.coordinates)
    }
  }
  return [
    [oeste, sul],
    [leste, norte],
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
    const [maplibregl, modulo, { default: urlDoWorker }] = await Promise.all([
      import('maplibre-gl'),
      import('@/features/saude-publica/mapa/campo-grande.json'),
      /* O worker vem separado: o pré-empacotamento do Vite não leva o arquivo vizinho junto. */
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])
    maplibregl.setWorkerUrl(urlDoWorker)
    const geo = modulo.default as Geo
    geoCarregado = geo
    await nextTick()
    if (!palco.value) return

    const paleta = lerPaleta()
    const estilo = await estiloDeFundo(paleta)
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const instancia = new maplibregl.Map({
      container: palco.value,
      style: estilo,
      bounds: limitesDoRecorte(geo),
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
    /* O estilo escuro pede texturas que ele não traz: uma imagem vazia no lugar, sem aviso. */
    instancia.setMissingStyleImageResolver((id) => {
      if (!instancia.hasImage(id)) {
        instancia.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) })
      }
    })
    instancia.addControl(
      new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
      'top-right',
    )
    mapa.value = instancia

    instancia.on('load', () => {
      /*
       * Os bairros e as divisas ficam por cima das ruas e embaixo dos nomes. O estilo escuro tem
       * rótulos no meio das camadas de rua: a cor entra antes do primeiro nome depois da última rua.
       */
      const camadas = instancia.getStyle().layers
      const ultimaRua = camadas.reduce(
        (ultima, camada, indice) => (camada.type === 'symbol' ? ultima : indice),
        -1,
      )
      const antesDosNomes = camadas
        .slice(ultimaRua + 1)
        .find((camada) => camada.type === 'symbol')?.id

      instancia.addSource('bairros', { type: 'geojson', data: bairrosNoRecorte(geo) })
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
      /*
       * O rótulo da região mora dentro do mapa (marcador), e o clique nele chega também ao bairro de
       * baixo: escolhia a região e, logo em seguida, desfazia a escolha (17/11/2026, "abre e fecha
       * sozinho"). O rótulo cuida do próprio clique; o bairro só escolhe a região, nunca desfaz.
       */
      instancia.on('click', 'bairros-cor', (evento) => {
        if (noRotulo(evento)) return
        const regiao = evento.features?.[0]?.properties?.regiao as IdDaRegiao | undefined
        if (regiao) selecionada.value = regiao
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

/** O evento veio de um rótulo de região (marcador), e não do bairro embaixo dele? */
function noRotulo(evento: MapLayerMouseEvent) {
  const alvo = evento.originalEvent.target
  return alvo instanceof Element && Boolean(alvo.closest('.maplibregl-marker'))
}

function apontar(evento: MapLayerMouseEvent) {
  const feature = evento.features?.[0]
  const instancia = mapa.value
  if (!feature || !instancia) return
  /* Em cima do rótulo, a dica do bairro de baixo taparia o próprio rótulo. */
  if (noRotulo(evento)) {
    apontado.value = null
    instancia.setFilter('bairro-apontado', filtroDoBairro(null))
    return
  }
  const propriedades = feature.properties as Record<string, unknown>
  const nome = String(propriedades.nome)
  const numeroOuNulo = (valor: unknown) => (typeof valor === 'number' ? valor : null)

  instancia.getCanvas().style.cursor = 'pointer'
  instancia.setFilter('bairro-apontado', filtroDoBairro(nome))
  apontado.value = {
    nome,
    regiao: propriedades.regiao as IdDaRegiao,
    valor: numeroOuNulo(propriedades.valor),
    delta: numeroOuNulo(propriedades.delta),
    publico: numeroOuNulo(propriedades.publico) ?? 0,
    x: evento.point.x,
    y: evento.point.y,
  }
}

function escolher(id: IdDaRegiao) {
  selecionada.value = selecionada.value === id ? null : id
}

/** A mesma informação do mapa, para leitor de tela: só as regiões do recorte. */
const tabela = computed(() =>
  REGIOES.filter((regiao) => dentro(regiao.id)).map((regiao) => daRegiao(regiao.id)),
)

function rotuloAcessivel(item: (typeof rotulos.value)[number]) {
  const numero =
    item.valor === null
      ? 'não se aplica a gatos'
      : `${item.valor}% (${pontos(item.delta ?? 0)} no período)`
  return `Região ${item.regiao.nome}: ${numero}. Abrir o detalhe.`
}

/* O indicador, o período, as regiões ou a espécie mudaram: os números e a cor se refazem. */
watch(
  () => [props.indicador, props.recorte] as const,
  ([, recorte], [, antes]) => {
    const instancia = mapa.value
    if (!instancia?.getLayer('bairros-cor') || !geoCarregado) return
    const fonte = instancia.getSource('bairros') as { setData?: (dados: FeatureCollection) => void }
    fonte.setData?.(bairrosNoRecorte(geoCarregado))
    instancia.setPaintProperty('bairros-cor', 'fill-color', corDoIndicador(lerPaleta()))
    if (recorte.regioes.join() !== antes.regioes.join()) {
      const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      instancia.fitBounds(limitesDoRecorte(geoCarregado), {
        padding: 28,
        duration: reduzido ? 0 : 600,
      })
    }
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
  <figure ref="figura" class="mapa-cidade sp-escala">
    <MapaDasRegioes
      v-if="semMapa"
      :indicador="indicador"
      :recorte="recorte"
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
        <template v-if="apontado.valor !== null">
          <span>
            <b class="ui-num">{{ apontado.valor }}%</b> dos {{ numero(apontado.publico) }}
            {{ quemConta }}
          </span>
          <span v-if="apontado.delta !== null" class="mapa-cidade__delta">
            {{ pontos(apontado.delta) }} no período
          </span>
        </template>
        <span v-else>Não se aplica a gatos</span>
      </div>
    </div>

    <!-- Os rótulos das regiões, dentro dos marcadores do MapLibre. -->
    <Teleport v-for="item in rotulos" :key="item.id" :to="item.elemento">
      <button
        type="button"
        class="mapa-cidade__rotulo"
        :class="{
          'mapa-cidade__rotulo--escolhido': selecionada === item.id,
          'mapa-cidade__rotulo--fora': item.fora,
        }"
        :aria-pressed="selecionada === item.id"
        :aria-label="rotuloAcessivel(item)"
        :data-regiao="item.id"
        @click="escolher(item.id)"
      >
        <span class="mapa-cidade__rotulo-nome">{{ item.regiao.nome }}</span>
        <span class="mapa-cidade__rotulo-valor ui-num">
          {{ item.valor === null ? '—' : `${item.valor}%` }}
        </span>
      </button>
    </Teleport>

    <figcaption v-if="!semMapa" class="mapa-cidade__legenda">
      <span class="mapa-cidade__titulo-legenda">
        {{ definicao.rotulo }}, em dia
        <template v-if="!aplica"> (só cães: escolha "Cães" ou "Cães e gatos")</template>
      </span>
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
        por região urbana, no período escolhido
      </caption>
      <thead>
        <tr>
          <th scope="col">Região</th>
          <th scope="col">Em dia no fim do período</th>
          <th scope="col">Pontos no período</th>
          <th scope="col">Animais</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="linha in tabela" :key="linha.regiao.id">
          <th scope="row">{{ linha.regiao.nome }}</th>
          <td>{{ linha.valor === null ? 'não se aplica' : `${linha.valor}%` }}</td>
          <td>{{ linha.delta === null ? '—' : pontos(linha.delta) }}</td>
          <td>{{ numero(publicoNoRecorte(linha.regiao, indicador, recorte.especie)) }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
/*
 * A cor dos bairros é a escala de perigo (`escala-de-perigo.css`, a mesma do esquema e das
 * barras), um pouco transparente para as ruas aparecerem. As divisas: a tinta da casa no claro, um fio claro
 * no escuro.
 */
.mapa-cidade {
  --mapa-divisa: #1d3557;
  --mapa-fio: rgb(255 255 255 / 85%);
  --mapa-escolhida: #10302a;
  --mapa-fundo: #eef2f0;
  --mapa-opacidade: 0.78;
  /* O bairro fora das regiões escolhidas: cinza, para o recorte saltar. */
  --mapa-fora: #d9dedc;

  display: grid;
  gap: 14px;
  margin: 0;
}

.app-dark .mapa-cidade {
  --mapa-divisa: #dfe9e5;
  --mapa-fio: rgb(18 25 23 / 80%);
  --mapa-escolhida: #ffffff;
  --mapa-fundo: #18211e;
  --mapa-opacidade: 0.82;
  --mapa-fora: #232b28;
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

/* Região fora do recorte: o rótulo recua, mas continua clicável. */
.mapa-cidade__rotulo--fora {
  opacity: 0.55;
}

.mapa-cidade__rotulo--fora:hover,
.mapa-cidade__rotulo--fora:focus-visible {
  opacity: 1;
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

.mapa-cidade__delta {
  color: var(--ok-tinta);
  font-weight: 650;
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
