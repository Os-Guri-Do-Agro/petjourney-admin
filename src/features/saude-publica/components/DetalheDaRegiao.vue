<script setup lang="ts">
/**
 * A região escolhida no mapa do Painel, aberta ao lado dele (17/11/2026). Ela ocupa a coluna dos
 * bairros da cidade, e o mapa continua inteiro e do mesmo tamanho enquanto se lê o detalhe. Antes
 * era uma gaveta, que empurrava a página e espremia o mapa numa coluna só.
 *
 * Mostra quantos animais e tutores a região tem, os quatro indicadores com o começo e o fim do
 * período, os bairros dela que pedem atenção no indicador do mapa, as campanhas que passaram por
 * ela e o atalho para criar uma campanha já com a região marcada. É a pergunta do gestor: "e no
 * Anhanduizinho, o que eu faço?".
 *
 * O painel não passa da altura do mapa nem da área que rola, e fica preso ao alto dela enquanto o
 * mapa passa. O que não cabe rola por dentro, e o título e os botões ficam sempre à vista.
 */
import Button from 'primevue/button'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import ListaDeBairros from '@/features/saude-publica/components/ListaDeBairros.vue'
import {
  BAIRROS,
  dataCurta,
  INDICADORES,
  indicador as definicaoDo,
  numero,
  regiao as regiaoDe,
  tipoDeCampanha,
  type IdDaRegiao,
  type Indicador,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'
import {
  coberturaDaRegiao,
  coberturaDoBairro,
  dataDoDia,
  pontos,
  publicoNoRecorte,
  seAplica,
  type Recorte,
} from '@/features/saude-publica/serie'

const props = defineProps<{
  regiaoId: IdDaRegiao
  recorte: Recorte
  indicador: Indicador
  /** A altura da caixa do mapa ao lado, em pixels: o painel não passa dela. */
  alturaDoMapa?: number | null
}>()
const emit = defineEmits<{ fechar: [] }>()

const router = useRouter()
const { campanhas } = useEstadoDoPrototipo()

const regiao = computed(() => regiaoDe(props.regiaoId))
const definicao = computed(() => definicaoDo(props.indicador))

const fimDoPeriodo = computed(() => dataCurta(dataDoDia(props.recorte.ate)))
const comecoDoPeriodo = computed(() => dataCurta(dataDoDia(props.recorte.de)))

/** Quem conta no número de um indicador: "cães", "gatos" ou "cães e gatos". */
function quemConta(id: Indicador) {
  const { especie } = props.recorte
  if (definicaoDo(id).publico === 'caes' || especie === 'caes') return 'cães'
  return especie === 'gatos' ? 'gatos' : 'cães e gatos'
}

const linhas = computed(() => {
  const { de, ate, especie } = props.recorte
  return INDICADORES.filter((item) => seAplica(item.id, especie)).map((item) => ({
    definicao: item,
    fim: Math.round(coberturaDaRegiao(regiao.value, item.id, ate, especie)),
    comeco: Math.round(coberturaDaRegiao(regiao.value, item.id, de, especie)),
    publico: publicoNoRecorte(regiao.value, item.id, especie),
    quem: quemConta(item.id),
  }))
})

/** Os bairros da região mais atrasados no indicador que o mapa pinta. */
const QUANTOS_BAIRROS = 4

const bairrosDaRegiao = computed(() => BAIRROS.filter((item) => item.regiao === props.regiaoId))

const bairros = computed(() => {
  const { ate, especie } = props.recorte
  if (!seAplica(props.indicador, especie)) return []
  return bairrosDaRegiao.value
    .map((item) => ({
      nome: item.nome,
      valor: Math.round(coberturaDoBairro(item, props.indicador, ate, especie)),
      publico: publicoNoRecorte(item, props.indicador, especie),
    }))
    .sort((um, outro) => um.valor - outro.valor)
    .slice(0, QUANTOS_BAIRROS)
})

const daRegiao = computed(() =>
  campanhas.value.filter((item) => item.regioes.includes(props.regiaoId)),
)

function criarCampanha() {
  void router.push({
    path: '/saude-publica/campanhas',
    query: { nova: '1', regiao: props.regiaoId },
  })
}

/*
 * A altura da área que rola (o palco do portal), para o painel caber nela inteiro: o título em
 * cima, os botões embaixo e o resto rolando por dentro. Sem o palco, a altura da janela.
 */
const raiz = ref<HTMLElement | null>(null)
const alturaDaArea = ref<number | null>(null)
let observador: ResizeObserver | null = null

/*
 * O corpo rola por dentro quando não cabe. Enquanto houver mais embaixo, o pé dele esmaece, para
 * ficar claro que a lista continua.
 */
const corpo = ref<HTMLElement | null>(null)
const temMais = ref(false)

function medirCorpo() {
  const elemento = corpo.value
  if (!elemento) return
  temMais.value = elemento.scrollTop + elemento.clientHeight < elemento.scrollHeight - 4
}

onMounted(() => {
  medirCorpo()
  if (typeof ResizeObserver === 'undefined') return
  const area = raiz.value?.closest<HTMLElement>('.palco__conteudo')
  observador = new ResizeObserver(() => {
    if (area) alturaDaArea.value = area.clientHeight
    medirCorpo()
  })
  if (area) observador.observe(area)
  if (corpo.value) observador.observe(corpo.value)
})

onBeforeUnmount(() => observador?.disconnect())

/* Outra região, outro indicador ou outro recorte: o corpo volta ao começo e mede de novo. */
watch(
  () => [props.regiaoId, props.indicador, props.recorte] as const,
  async ([regiaoId], [regiaoAntes]) => {
    if (regiaoId !== regiaoAntes) corpo.value?.scrollTo({ top: 0 })
    await nextTick()
    medirCorpo()
  },
)

/** O limite da altura: a da área que rola (menos o respiro de cima e de baixo) e a do mapa. */
const limite = computed(() => {
  const area = alturaDaArea.value === null ? '100dvh' : `${alturaDaArea.value}px`
  const mapa = props.alturaDoMapa ? `${props.alturaDoMapa}px` : '100dvh'
  return { '--dr-limite': `min(calc(${area} - 32px), ${mapa})` }
})
</script>

<template>
  <aside ref="raiz" class="ui-folha ui-cartao dr" aria-labelledby="dr-titulo" :style="limite">
    <header class="ui-cartao__cabeca dr__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-map-pin-area" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="dr-titulo" class="ui-cartao__titulo">Região {{ regiao.nome }}</h2>
        <p class="ui-cartao__descricao">
          Os números em {{ fimDoPeriodo }}. O traço na régua marca onde cada um estava em
          {{ comecoDoPeriodo }}.
        </p>
      </span>
      <Button
        type="button"
        icon="ph ph-x"
        severity="secondary"
        outlined
        rounded
        size="small"
        aria-label="Fechar o detalhe da região"
        @click="emit('fechar')"
      />
    </header>

    <div
      ref="corpo"
      class="dr__corpo"
      :class="{ 'dr__corpo--mais': temMais }"
      tabindex="0"
      role="group"
      aria-label="Detalhe da região"
      @scroll.passive="medirCorpo"
    >
      <dl class="dr__numeros">
        <div>
          <dt>Cães</dt>
          <dd class="ui-num">{{ numero(regiao.caes) }}</dd>
        </div>
        <div>
          <dt>Gatos</dt>
          <dd class="ui-num">{{ numero(regiao.gatos) }}</dd>
        </div>
        <div>
          <dt>Tutores no app</dt>
          <dd class="ui-num">{{ numero(regiao.tutores) }}</dd>
        </div>
      </dl>

      <section class="dr__secao" aria-labelledby="dr-prevencao">
        <h3 id="dr-prevencao" class="dr__titulo">Prevenção na região</h3>
        <ul class="dr__indicadores">
          <li v-for="linha in linhas" :key="linha.definicao.id" class="dr__indicador">
            <span class="dr__rotulo">
              <i :class="linha.definicao.icone" aria-hidden="true" />
              {{ linha.definicao.rotulo }}
            </span>
            <span class="dr__valor ui-num">{{ linha.fim }}%</span>
            <!-- O começo (traço) e o fim (barra) na mesma régua de 0 a 100%. -->
            <span class="dr__regua" aria-hidden="true">
              <span class="dr__barra" :style="{ width: `${linha.fim}%` }" />
              <span class="dr__comeco" :style="{ insetInlineStart: `${linha.comeco}%` }" />
            </span>
            <span class="dr__frase">
              Era {{ linha.comeco }}% em {{ comecoDoPeriodo }}:
              {{ pontos(linha.fim - linha.comeco) }}, de {{ numero(linha.publico) }}
              {{ linha.quem }}.
            </span>
          </li>
        </ul>
      </section>

      <section v-if="bairros.length" class="dr__secao" aria-labelledby="dr-bairros">
        <h3 id="dr-bairros" class="dr__titulo">Bairros que pedem atenção</h3>
        <p class="dr__dica">
          Os mais atrasados em {{ definicao.rotulo.toLowerCase() }}, entre os
          {{ bairrosDaRegiao.length }} bairros da região.
        </p>
        <ListaDeBairros :bairros="bairros" :quem="quemConta(indicador)" />
      </section>

      <section class="dr__secao" aria-labelledby="dr-campanhas">
        <h3 id="dr-campanhas" class="dr__titulo">Campanhas na região</h3>
        <ul v-if="daRegiao.length" class="dr__campanhas">
          <li v-for="campanha in daRegiao" :key="campanha.id">
            <i :class="tipoDeCampanha(campanha.tipo).icone" aria-hidden="true" />
            <span>
              <strong>{{ campanha.titulo }}</strong>
              {{ dataCurta(campanha.data) }} ·
              {{ campanha.situacao === 'encerrada' ? 'encerrada' : 'agendada' }}
            </span>
          </li>
        </ul>
        <p v-else class="dr__dica">Nenhuma campanha nesta região no período.</p>
      </section>
    </div>

    <footer class="ui-cartao__pe dr__pe">
      <Button type="button" severity="secondary" outlined label="Fechar" @click="emit('fechar')" />
      <Button
        type="button"
        icon="ph ph-megaphone"
        label="Criar campanha aqui"
        @click="criarCampanha"
      />
    </footer>
  </aside>
</template>

<style scoped>
/*
 * Preso ao alto da área que rola, na altura dela: título em cima, botões embaixo e o meio rolando.
 * Entra deslizando de leve do lado do mapa.
 */
.dr {
  position: sticky;
  top: 16px;
  display: grid;
  max-height: var(--dr-limite, calc(100dvh - 32px));
  grid-template-rows: auto minmax(0, 1fr) auto;
  animation: dr-entra 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes dr-entra {
  from {
    opacity: 0;
    transform: translateX(14px);
  }
}

.dr__cabeca {
  align-items: flex-start;
}

.dr__corpo {
  display: grid;
  align-content: start;
  gap: 22px;
  min-height: 0;
  /* O respiro de lado deixa o anel de foco inteiro dentro da área que rola. */
  margin-inline: -4px;
  padding: 16px 4px 18px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dr__corpo:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: -2px;
  border-radius: 12px;
}

/* Tem mais embaixo: o pé esmaece. */
.dr__corpo--mais {
  mask-image: linear-gradient(to bottom, #000 calc(100% - 48px), transparent);
}

.dr__pe {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

/* Os três números da região, como os do Painel: número e rótulo, sem caixa própria. */
.dr__numeros {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.dr__numeros div {
  display: grid;
  gap: 2px;
}

.dr__numeros dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.dr__numeros dd {
  margin: 0;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.dr__secao {
  display: grid;
  gap: 10px;
}

.dr__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 700;
}

.dr__dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.dr__indicadores {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dr__indicador {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 10px;
}

.dr__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
}

.dr__valor {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 700;
}

.dr__regua {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--superficie);
  grid-column: 1 / -1;
}

.dr__barra {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--pets);
}

.dr__comeco {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-inline-start: -1px;
  border-radius: 2px;
  background: var(--tinta);
}

.dr__frase {
  color: var(--tinta-2);
  font-size: 12.5px;
  grid-column: 1 / -1;
}

.dr__campanhas {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dr__campanhas li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13px;
}

.dr__campanhas i {
  margin-top: 2px;
  color: var(--tinta);
  font-size: 16px;
}

.dr__campanhas strong {
  display: block;
  color: var(--tinta);
  font-size: 13.5px;
}

@media (prefers-reduced-motion: reduce) {
  .dr {
    animation: none;
  }
}
</style>
