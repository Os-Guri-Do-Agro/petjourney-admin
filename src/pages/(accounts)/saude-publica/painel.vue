<script setup lang="ts">
/**
 * Saúde pública › Painel (protótipo, Ofício 001/2026, item 4e): o que a Superintendência de
 * Bem-Estar Animal e o Centro de Controle de Zoonoses recebem.
 *
 * Na anatomia das telas do portal: a abertura no verde dos pets com os números do programa numa
 * fileira; embaixo, uma caixa por assunto. O problema (os casos humanos de leishmaniose, da Sesau)
 * ao lado da prevenção na cidade, cujos quatro números também escolhem o que o mapa pinta; depois o
 * mapa de Campo Grande, com os 74 bairros pintados e as 7 regiões urbanas, e os bairros que pedem
 * atenção. Clicar numa região (no rótulo ou num bairro dela) abre o detalhe dela numa
 * gaveta, com o atalho para criar uma campanha.
 *
 * Os filtros (período, regiões, campanha e espécie; `FiltrosDoPrototipo`) valem para tudo o que é
 * número aqui, menos os casos humanos da Sesau, que são da cidade e do ano. A campanha escolhida
 * ganha uma linha com o que rendeu.
 */
import { computed, ref } from 'vue'

import UiAbertura, { type IndicadorDaAbertura } from '@/components/ui/UiAbertura.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import AvisoDoPrototipo from '@/features/saude-publica/components/AvisoDoPrototipo.vue'
import FiltrosDoPrototipo from '@/features/saude-publica/components/FiltrosDoPrototipo.vue'
import MapaDaCidade from '@/features/saude-publica/components/MapaDaCidade.vue'
import RegiaoGaveta from '@/features/saude-publica/components/RegiaoGaveta.vue'
import {
  CONTEXTO_LEISHMANIOSE,
  dataCurta,
  INDICADORES,
  indicador as definicaoDo,
  MINIMO_POR_BAIRRO,
  numero,
  PERIODO,
  regiao as regiaoDe,
  TOTAIS,
  tipoDeCampanha,
  type IdDaRegiao,
  type Indicador,
} from '@/features/saude-publica/dados'
import { useFiltrosDoPrototipo } from '@/features/saude-publica/filtros'
import {
  animaisNoRecorte,
  bairrosDoRecorte,
  coberturaDoBairro,
  efeitoDaCampanha,
  noPeriodo,
  pontos,
  publicoNoRecorte,
  regioesDoRecorte,
  seAplica,
} from '@/features/saude-publica/serie'

const filtros = useFiltrosDoPrototipo()
const recorte = filtros.recorte
const indicador = filtros.indicador
const definicao = computed(() => definicaoDo(indicador.value))
const aplica = computed(() => seAplica(indicador.value, recorte.value.especie))

/** Quem conta no número do indicador escolhido: "cães", "gatos" ou "cães e gatos". */
function quemConta(id: Indicador) {
  if (definicaoDo(id).publico === 'caes' || recorte.value.especie === 'caes') return 'cães'
  return recorte.value.especie === 'gatos' ? 'gatos' : 'cães e gatos'
}

/* ------------------------------------------------------------------------ a abertura */

/**
 * Os números do programa no recorte: os animais e os tutores das regiões escolhidas, na espécie;
 * os avisos e o plano completo repartidos pela parte dos animais e pelos dias do período.
 */
const abertura = computed<IndicadorDaAbertura[]>(() => {
  const regioes = regioesDoRecorte(recorte.value)
  const especie = recorte.value.especie
  const animais = regioes.reduce((soma, regiao) => soma + animaisNoRecorte(regiao, especie), 0)
  const parte = animais / (TOTAIS.caes + TOTAIS.gatos)
  const tutores = regioes.reduce(
    (soma, regiao) =>
      soma +
      Math.round(
        (regiao.tutores * animaisNoRecorte(regiao, especie)) / (regiao.caes + regiao.gatos),
      ),
    0,
  )
  const dias = recorte.value.ate - recorte.value.de
  const quem = especie === 'caes' ? 'Cães' : especie === 'gatos' ? 'Gatos' : 'Cães e gatos'
  return [
    {
      id: 'animais',
      valor: numero(animais),
      rotulo: `${quem} com histórico no app`,
      icone: 'ph ph-paw-print',
    },
    {
      id: 'tutores',
      valor: numero(tutores),
      rotulo: 'Tutores cadastrados',
      icone: 'ph ph-users-three',
    },
    {
      id: 'avisos',
      valor: numero(Math.round((TOTAIS.avisosEnviados * parte * dias) / PERIODO.dias)),
      rotulo: 'Avisos de vacina, retorno e coleira',
      icone: 'ph ph-bell-ringing',
    },
    {
      id: 'plano',
      valor: numero(Math.round(TOTAIS.planoCompleto * parte)),
      rotulo: 'Com os 3 meses do plano completo',
      icone: 'ph ph-gift',
    },
  ]
})

const ARTIGO: Record<Indicador, string> = {
  leishmaniose: 'o',
  coleira: 'a',
  antirrabica: 'a',
  castracao: 'a',
}

/** "Nos 90 dias, o exame de leishmaniose em dia passou de 29% para 42% dos cães na cidade." */
const resumo = computed(() => {
  const id = aplica.value ? indicador.value : 'antirrabica'
  const { fim, comeco } = noPeriodo(id, recorte.value)
  const periodo = filtros.periodoNaFrase.value
  const cuidado = `${ARTIGO[id]} ${definicaoDo(id).rotulo.toLowerCase()}${id === 'castracao' ? '' : ' em dia'}`
  return `${periodo.charAt(0).toUpperCase()}${periodo.slice(1)}, ${cuidado} passou de ${comeco}% para ${fim}% dos ${quemConta(id)} ${filtros.lugarNaFrase.value}.`
})

/* ------------------------------------------------------------------- a prevenção e a campanha */

const quadros = computed(() =>
  INDICADORES.map((item) => ({
    definicao: item,
    aplica: seAplica(item.id, recorte.value.especie),
    ...noPeriodo(item.id, recorte.value),
  })),
)

/** A campanha do filtro: o que ela rendeu nas regiões dela, e o alcance do aviso. */
const campanha = computed(() => {
  const alvo = filtros.campanhaEscolhida.value
  if (!alvo) return null
  const efeito = efeitoDaCampanha(alvo)
  return {
    alvo,
    tipo: tipoDeCampanha(alvo.tipo),
    efeito,
    lugares: alvo.regioes.map((id) => regiaoDe(id).nome).join(' e '),
  }
})

/** Os bairros mais atrasados no indicador escolhido, com a cor da mesma faixa do mapa. */
const FAIXAS = [40, 50, 60, 70]
function faixaDe(valor: number) {
  const indice = FAIXAS.findIndex((limite) => valor < limite)
  return indice === -1 ? FAIXAS.length : indice
}

const bairros = computed(() =>
  aplica.value
    ? bairrosDoRecorte(recorte.value)
        .map((bairro) => ({
          ...bairro,
          valor: Math.round(
            coberturaDoBairro(bairro, indicador.value, recorte.value.ate, recorte.value.especie),
          ),
          publico: publicoNoRecorte(bairro, indicador.value, recorte.value.especie),
        }))
        .sort((um, outro) => um.valor - outro.valor)
        .slice(0, 8)
    : [],
)

const regiaoEscolhida = ref<IdDaRegiao | null>(null)
const gavetaAberta = ref(false)

function escolherRegiao(id: IdDaRegiao | null) {
  regiaoEscolhida.value = id
  gavetaAberta.value = Boolean(id)
}

function aoFecharGaveta(aberta: boolean) {
  gavetaAberta.value = aberta
  if (!aberta) regiaoEscolhida.value = null
}
</script>

<template>
  <UiPagina titulo="Painel" icone="ph ph-map-trifold">
    <template #cabecalho>
      <UiAbertura
        class="sp-abertura pj-lugar--pets"
        sobre="Campo Grande · simulação de 90 dias de programa"
        titulo="Saúde de cães e gatos na cidade"
        :indicadores="abertura"
        rotulo-dos-indicadores="Números do programa"
        em-linha
      >
        <template #resumo>{{ resumo }}</template>
      </UiAbertura>
    </template>

    <div class="sp">
      <AvisoDoPrototipo />

      <FiltrosDoPrototipo />

      <!-- A campanha do filtro: o que ela rendeu, nas regiões dela, três semanas depois. -->
      <p v-if="campanha" class="sp-campanha ui-poco" role="status">
        <span class="ui-ladrilho" aria-hidden="true"><i :class="campanha.tipo.icone" /></span>
        <span>
          <strong>{{ campanha.alvo.titulo }}, {{ dataCurta(campanha.alvo.data) }}</strong>
          · {{ campanha.lugares }}:
          {{ definicaoDo(campanha.efeito.indicador).rotulo.toLowerCase() }} em dia de
          <b class="ui-num">{{ campanha.efeito.antes }}%</b> para
          <b class="ui-num">{{ campanha.efeito.depois }}%</b> em três semanas ({{
            pontos(campanha.efeito.delta)
          }}). {{ numero(campanha.alvo.avisados) }} tutores avisados,
          {{ numero(campanha.alvo.abriram) }} abriram o aviso e
          {{ numero(campanha.alvo.atendidos ?? 0) }} animais atendidos.
        </span>
      </p>

      <div class="sp-pilha">
        <!-- O problema, com os números de verdade (Sesau, citados no ofício). -->
        <section class="ui-folha ui-cartao sp-caixa" aria-labelledby="sp-leish">
          <header class="ui-cartao__cabeca sp-cabeca">
            <span class="ui-ladrilho sp-cabeca__risco" aria-hidden="true">
              <i class="ph ph-warning-octagon" />
            </span>
            <span class="ui-cartao__titulos">
              <h2 id="sp-leish" class="ui-cartao__titulo">Leishmaniose visceral</h2>
              <p class="ui-cartao__descricao">
                O cão é o principal reservatório na cidade. Prevenir depende do exame em dia e da
                coleira no prazo.
              </p>
            </span>
          </header>
          <ul class="sp-numeros sp-numeros--quatro">
            <li v-for="ano in CONTEXTO_LEISHMANIOSE.anos" :key="ano.ano" class="sp-numero">
              <strong class="sp-numero__valor ui-num">{{ ano.casos }}</strong>
              <span class="sp-numero__rotulo">casos humanos em {{ ano.ano }}</span>
              <span class="sp-numero__meta">
                {{ ano.observacao }}{{ ano.obitos ? `, ${ano.obitos} óbitos` : '' }}
              </span>
            </li>
          </ul>
          <p class="sp-fonte">Fonte: {{ CONTEXTO_LEISHMANIOSE.fonte }}.</p>
        </section>

        <!-- Os quatro indicadores da cidade; cada um também escolhe o que o mapa pinta. -->
        <section class="ui-folha ui-cartao sp-caixa" aria-labelledby="sp-prevencao">
          <header class="ui-cartao__cabeca sp-cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-shield-plus" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="sp-prevencao" class="ui-cartao__titulo">
                Prevenção {{ filtros.lugarNaFrase.value }}
              </h2>
              <p class="ui-cartao__descricao">
                Quanto estava em dia em {{ dataCurta(filtros.ate.value) }}, e quanto andou
                {{ filtros.periodoNaFrase.value }}. Escolha um para ver no mapa.
              </p>
            </span>
          </header>
          <ul class="sp-numeros sp-numeros--quatro" aria-label="Indicador do mapa">
            <li v-for="quadro in quadros" :key="quadro.definicao.id">
              <button
                type="button"
                class="sp-numero sp-numero--botao"
                :class="{ 'sp-numero--ativo': indicador === quadro.definicao.id }"
                :aria-pressed="indicador === quadro.definicao.id"
                @click="filtros.escolherIndicador(quadro.definicao.id)"
              >
                <strong class="sp-numero__valor ui-num">
                  {{ quadro.aplica ? `${quadro.fim}%` : '—' }}
                </strong>
                <span class="sp-numero__rotulo">{{ quadro.definicao.rotulo }}</span>
                <span v-if="quadro.aplica" class="sp-numero__meta sp-numero__meta--alta">
                  {{ pontos(quadro.delta) }} no período
                </span>
                <span v-else class="sp-numero__meta">Só cães</span>
              </button>
            </li>
          </ul>
        </section>
      </div>

      <div class="sp-linha">
        <section class="ui-folha ui-cartao sp-caixa" aria-labelledby="sp-mapa">
          <header class="ui-cartao__cabeca sp-cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-map-trifold" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="sp-mapa" class="ui-cartao__titulo">Mapa da cidade</h2>
              <p class="ui-cartao__descricao">
                {{ definicao.rotulo }} em cada bairro: percentual de {{ definicao.frase }}. As
                linhas fortes separam as 7 regiões urbanas; clique numa para ver o detalhe.
              </p>
            </span>
          </header>
          <MapaDaCidade
            :indicador="indicador"
            :recorte="recorte"
            :selecionada="regiaoEscolhida"
            @update:selecionada="escolherRegiao"
          />
        </section>

        <section class="ui-folha ui-cartao sp-caixa" aria-labelledby="sp-bairros">
          <header class="ui-cartao__cabeca sp-cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-map-pin" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="sp-bairros" class="ui-cartao__titulo">Bairros que pedem atenção</h2>
              <p class="ui-cartao__descricao">
                Os oito com o menor percentual de {{ quemConta(indicador) }} com
                {{ definicao.rotulo.toLowerCase() }}{{ indicador === 'castracao' ? '' : ' em dia' }}
                {{ filtros.lugarNaFrase.value }}, em {{ dataCurta(filtros.ate.value) }}.
              </p>
            </span>
          </header>
          <p v-if="!aplica" class="sp-fonte">
            {{ definicao.rotulo }} é só de cães: escolha "Cães" ou "Cães e gatos" nos filtros.
          </p>
          <ol v-else class="sp-bairros">
            <li v-for="bairro in bairros" :key="bairro.nome" class="sp-bairro">
              <span class="sp-bairro__nome">{{ bairro.nome }}</span>
              <span class="sp-bairro__valor ui-num">{{ bairro.valor }}%</span>
              <span class="sp-bairro__trilho" aria-hidden="true">
                <span
                  class="sp-bairro__barra"
                  :class="`sp-faixa-${faixaDe(bairro.valor)}`"
                  :style="{ width: `${bairro.valor}%` }"
                />
              </span>
              <span class="sp-bairro__publico">
                {{ numero(bairro.publico) }}
                {{ quemConta(indicador) }}
              </span>
            </li>
          </ol>
          <p class="sp-fonte">
            <i class="ph ph-lock-simple" aria-hidden="true" />
            Só contagens e percentuais, sem tutor identificado. Bairro com menos de
            {{ MINIMO_POR_BAIRRO }} animais não aparece.
          </p>
        </section>
      </div>
    </div>

    <RegiaoGaveta
      :visible="gavetaAberta"
      :regiao-id="regiaoEscolhida"
      :recorte="recorte"
      @update:visible="aoFecharGaveta"
    />
  </UiPagina>
</template>

<style scoped>
/* A abertura ocupa a largura toda, como a do Início (o cabeçalho da página é flex). */
.sp-abertura {
  flex: 1;
  min-width: 0;
}

.sp {
  display: grid;
  gap: 18px;
}

/* Duas caixas lado a lado; abaixo de ~1100 px de conteúdo, uma embaixo da outra. */
.sp-linha {
  display: grid;
  align-items: start;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 26rem), 1fr));
}

/* O problema e a prevenção: cada um na largura toda, como os cartões dos espaços no Início. */
.sp-pilha {
  display: grid;
  gap: 18px;
}

.sp-caixa {
  display: grid;
  align-content: start;
  gap: 16px;
}

.sp-cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* A campanha do filtro: uma linha de papel com o ícone do tipo, antes das caixas. */
.sp-campanha {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.sp-campanha strong,
.sp-campanha b {
  color: var(--tinta);
}

/* Urgência no ícone, não na caixa. */
.sp-cabeca__risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

/* ------------------------------------------------------- os números, como os do Início */

.sp-numeros {
  display: grid;
  gap: 12px 14px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 112px), 1fr));
  list-style: none;
}

/* Quatro colunas fixas: os dois números da doença alinham com os quatro da prevenção embaixo. */
.sp-numeros--quatro {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 900px) {
  .sp-numeros--quatro {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.sp-numero {
  display: grid;
  align-content: start;
  gap: 2px;
}

.sp-numero__valor {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.sp-numero__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.3;
}

.sp-numero__meta {
  color: var(--tinta-3);
  font-size: 11.5px;
  line-height: 1.35;
}

.sp-numero__meta--alta {
  color: var(--ok-tinta);
  font-weight: 600;
}

/* O número que escolhe o mapa: o véu do hover sai um pouco para fora, como no Início. */
.sp-numero--botao {
  width: calc(100% + 14px);
  margin: -6px -7px;
  padding: 6px 7px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition:
    background-color var(--pj-tempo-curto) ease,
    border-color var(--pj-tempo-curto) ease;
}

.sp-numero--botao:hover {
  border-color: var(--linha-suave);
  background: var(--superficie-2);
}

.sp-numero--botao:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 1px;
}

/* O escolhido: o verde dos pets por trás, e o mapa embaixo pinta ele. */
.sp-numero--ativo,
.sp-numero--ativo:hover {
  border-color: color-mix(in oklab, var(--pets) 45%, transparent);
  background: color-mix(in oklab, var(--pets-fundo) 45%, transparent);
}

.sp-fonte {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--tinta-3);
  font-size: 12px;
}

.sp-fonte i {
  margin-top: 2px;
}

/* ---------------------------------------------------------------------------- bairros */

.sp-bairros {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sp-bairro {
  display: grid;
  align-items: center;
  gap: 4px 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.sp-bairro__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-bairro__valor {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 700;
}

.sp-bairro__trilho {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--superficie);
  grid-column: 1 / -1;
}

.sp-bairro__barra {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
}

.sp-bairro__publico {
  color: var(--tinta-3);
  font-size: 12px;
  grid-column: 1 / -1;
}

/* As mesmas cinco faixas do mapa: a barra do bairro tem a cor que o hexágono teria. */
.sp-faixa-0 {
  background: #a4d8c4;
}

.sp-faixa-1 {
  background: #6fb89d;
}

.sp-faixa-2 {
  background: #4f9f85;
}

.sp-faixa-3 {
  background: #357d66;
}

.sp-faixa-4 {
  background: #24604f;
}

.app-dark .sp-faixa-0 {
  background: #2f6655;
}

.app-dark .sp-faixa-1 {
  background: #3d8069;
}

.app-dark .sp-faixa-2 {
  background: #4d9a80;
}

.app-dark .sp-faixa-3 {
  background: #6fb89d;
}

.app-dark .sp-faixa-4 {
  background: #8fd1b8;
}

@media (prefers-reduced-motion: reduce) {
  .sp-numero--botao {
    transition: none;
  }
}
</style>
