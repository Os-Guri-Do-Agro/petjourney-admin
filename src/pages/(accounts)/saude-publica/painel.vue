<script setup lang="ts">
/**
 * Saúde pública › Painel (protótipo, Ofício 001/2026, item 4e): o que a Superintendência de
 * Bem-Estar Animal e o Centro de Controle de Zoonoses recebem. A abertura com os números do
 * programa; o problema (os casos humanos de leishmaniose, da Sesau); os quatro indicadores de
 * prevenção da cidade, que também escolhem o que o mapa pinta; o mapa das 7 regiões; e os bairros
 * que pedem atenção. Clicar numa região abre o detalhe dela, com o atalho para criar uma campanha.
 */
import { computed, ref } from 'vue'

import UiAbertura, { type IndicadorDaAbertura } from '@/components/ui/UiAbertura.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import AvisoDoPrototipo from '@/features/saude-publica/components/AvisoDoPrototipo.vue'
import MapaDasRegioes from '@/features/saude-publica/components/MapaDasRegioes.vue'
import RegiaoGaveta from '@/features/saude-publica/components/RegiaoGaveta.vue'
import {
  BAIRROS,
  CONTEXTO_LEISHMANIOSE,
  coberturaDaCidade,
  INDICADORES,
  indicador as definicaoDo,
  MINIMO_POR_BAIRRO,
  numero,
  TOTAIS,
  type IdDaRegiao,
  type Indicador,
} from '@/features/saude-publica/dados'

const indicador = ref<Indicador>('leishmaniose')
const definicao = computed(() => definicaoDo(indicador.value))

const abertura: IndicadorDaAbertura[] = [
  {
    id: 'animais',
    valor: numero(TOTAIS.caes + TOTAIS.gatos),
    rotulo: 'Cães e gatos com histórico no app',
    icone: 'ph ph-paw-print',
  },
  {
    id: 'tutores',
    valor: numero(TOTAIS.tutores),
    rotulo: 'Tutores cadastrados',
    icone: 'ph ph-users-three',
  },
  {
    id: 'avisos',
    valor: numero(TOTAIS.avisosEnviados),
    rotulo: 'Avisos de vacina, retorno e coleira',
    icone: 'ph ph-bell-ringing',
  },
  {
    id: 'plano',
    valor: numero(TOTAIS.planoCompleto),
    rotulo: 'Com os 3 meses do plano completo',
    icone: 'ph ph-gift',
  },
]

const exameHoje = coberturaDaCidade('leishmaniose')
const exameInicio = coberturaDaCidade('leishmaniose', 'inicio')

const quadros = computed(() =>
  INDICADORES.map((item) => {
    const hoje = coberturaDaCidade(item.id)
    const inicio = coberturaDaCidade(item.id, 'inicio')
    return { definicao: item, hoje, inicio, delta: hoje - inicio }
  }),
)

/** Os bairros mais atrasados no indicador escolhido, com a cor da mesma faixa do mapa. */
const FAIXAS = [40, 50, 60, 70]
function faixaDe(valor: number) {
  const indice = FAIXAS.findIndex((limite) => valor < limite)
  return indice === -1 ? FAIXAS.length : indice
}

const bairros = computed(() =>
  [...BAIRROS]
    .sort((um, outro) => um.cobertura[indicador.value] - outro.cobertura[indicador.value])
    .slice(0, 8)
    .map((bairro) => ({
      ...bairro,
      valor: bairro.cobertura[indicador.value],
      publico: definicao.value.publico === 'caes' ? bairro.caes : bairro.caes + bairro.gatos,
    })),
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
        class="pj-lugar--pets"
        sobre="Campo Grande · simulação de 90 dias de programa"
        titulo="Saúde de cães e gatos na cidade"
        :indicadores="abertura"
        rotulo-dos-indicadores="Números do programa"
        em-linha
      >
        <template #resumo>
          Em 90 dias, o exame de leishmaniose em dia passou de {{ exameInicio }}% para
          {{ exameHoje }}% dos cães acompanhados.
        </template>
      </UiAbertura>
    </template>

    <div class="sp">
      <AvisoDoPrototipo />

      <!-- O problema, com os números de verdade (Sesau, citados no ofício). -->
      <section class="sp-contexto" aria-labelledby="sp-contexto-titulo">
        <span class="ui-ladrilho sp-contexto__icone" aria-hidden="true">
          <i class="ph ph-warning-octagon" />
        </span>
        <div class="sp-contexto__texto">
          <h2 id="sp-contexto-titulo">Leishmaniose visceral em Campo Grande</h2>
          <p>
            O cão é o principal reservatório na cidade. A prevenção depende do exame em dia e da
            coleira trocada no prazo, e é isso que o painel acompanha por região e bairro.
          </p>
          <small>Fonte dos casos humanos: {{ CONTEXTO_LEISHMANIOSE.fonte }}.</small>
        </div>
        <dl class="sp-contexto__numeros">
          <div v-for="ano in CONTEXTO_LEISHMANIOSE.anos" :key="ano.ano">
            <dt>{{ ano.ano }} · {{ ano.observacao }}</dt>
            <dd>
              <strong class="ui-num">{{ ano.casos }}</strong> casos humanos
              <template v-if="ano.obitos">
                · <strong class="ui-num">{{ ano.obitos }}</strong> óbitos</template
              >
            </dd>
          </div>
        </dl>
      </section>

      <!-- Os quatro indicadores da cidade: cada um também escolhe o que o mapa mostra. -->
      <UiSecao titulo="Prevenção na cidade" icone="ph ph-shield-plus">
        <div class="sp-quadros" role="group" aria-label="Indicador do mapa">
          <button
            v-for="quadro in quadros"
            :key="quadro.definicao.id"
            type="button"
            class="sp-quadro"
            :class="{ 'sp-quadro--ativo': indicador === quadro.definicao.id }"
            :aria-pressed="indicador === quadro.definicao.id"
            @click="indicador = quadro.definicao.id"
          >
            <span class="sp-quadro__topo">
              <i :class="quadro.definicao.icone" aria-hidden="true" />
              {{ quadro.definicao.rotulo }}
            </span>
            <span class="sp-quadro__valor ui-num">{{ quadro.hoje }}%</span>
            <span class="sp-quadro__delta">
              <i class="ph ph-trend-up" aria-hidden="true" />
              +{{ quadro.delta }} pontos (era {{ quadro.inicio }}%)
            </span>
            <span class="sp-quadro__regra">{{ quadro.definicao.regra }}</span>
          </button>
        </div>
      </UiSecao>

      <div class="sp-duas">
        <UiSecao
          titulo="Por região urbana"
          :descricao="`Percentual de ${definicao.frase}. Clique numa região para ver o detalhe.`"
          icone="ph ph-map-trifold"
          folha
        >
          <MapaDasRegioes
            :indicador="indicador"
            :selecionada="regiaoEscolhida"
            @update:selecionada="escolherRegiao"
          />
        </UiSecao>

        <UiSecao
          titulo="Bairros que pedem atenção"
          :descricao="`Os oito com o menor percentual de ${definicao.frase}.`"
          icone="ph ph-map-pin"
          folha
        >
          <ol class="sp-bairros">
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
                {{ definicao.publico === 'caes' ? 'cães' : 'cães e gatos' }}
              </span>
            </li>
          </ol>
          <p class="sp-nota">
            <i class="ph ph-lock-simple" aria-hidden="true" />
            Só contagens e percentuais, sem nenhum tutor identificado. Bairro com menos de
            {{ MINIMO_POR_BAIRRO }} animais não aparece.
          </p>
        </UiSecao>
      </div>
    </div>

    <RegiaoGaveta
      :visible="gavetaAberta"
      :regiao-id="regiaoEscolhida"
      @update:visible="aoFecharGaveta"
    />
  </UiPagina>
</template>

<style scoped>
.sp {
  display: grid;
  gap: 22px;
}

/* ------------------------------------------------------------------------------ contexto */

.sp-contexto {
  display: grid;
  align-items: center;
  gap: 14px 18px;
  padding: 16px 18px;
  border: 1px solid color-mix(in oklab, var(--risco-tinta) 25%, var(--linha));
  border-radius: 18px;
  background: color-mix(in oklab, var(--risco-fundo) 35%, var(--superficie));
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.sp-contexto__icone {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.sp-contexto__texto {
  display: grid;
  gap: 4px;
}

.sp-contexto__texto h2 {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 750;
}

.sp-contexto__texto p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.sp-contexto__texto small {
  color: var(--tinta-3);
  font-size: 12px;
}

.sp-contexto__numeros {
  display: flex;
  gap: 10px;
  margin: 0;
}

.sp-contexto__numeros div {
  display: grid;
  gap: 2px;
  min-width: 9.5rem;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--superficie);
}

.sp-contexto__numeros dt {
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 650;
}

.sp-contexto__numeros dd {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.sp-contexto__numeros strong {
  color: var(--risco-tinta);
  font-size: 22px;
  font-weight: 800;
}

@media (max-width: 1100px) {
  .sp-contexto {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .sp-contexto__numeros {
    grid-column: 1 / -1;
  }
}

/* ------------------------------------------------------------------------------- quadros */

.sp-quadros {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
}

.sp-quadro {
  display: grid;
  align-content: start;
  gap: 4px;
  padding: 14px 16px;
  border: 1.5px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition:
    border-color var(--pj-tempo-curto) var(--pj-curva-chega),
    background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.sp-quadro:hover {
  border-color: var(--linha-media);
}

.sp-quadro:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

/* O escolhido: a borda e o fundo do verde dos pets, e o mapa ao lado pinta ele. */
.sp-quadro--ativo,
.sp-quadro--ativo:hover {
  border-color: var(--pets);
  background: color-mix(in oklab, var(--pets-fundo) 40%, var(--superficie));
}

.sp-quadro__topo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 700;
}

.sp-quadro__topo i {
  font-size: 18px;
}

.sp-quadro__valor {
  color: var(--tinta);
  font-size: 30px;
  font-weight: 800;
  line-height: 1.15;
}

.sp-quadro__delta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ok-tinta);
  font-size: 13px;
  font-weight: 650;
}

.sp-quadro__regra {
  color: var(--tinta-3);
  font-size: 12px;
}

/* ------------------------------------------------------------------- mapa e bairros */

.sp-duas {
  display: grid;
  align-items: start;
  gap: 22px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 26rem), 1fr));
}

.sp-bairros {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: bairro;
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
  font-weight: 750;
}

.sp-bairro__trilho {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: var(--superficie-3);
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
  background: #b4e0cf;
}

.sp-faixa-1 {
  background: #7fc4aa;
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

.sp-nota {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 16px 0 0;
  color: var(--tinta-3);
  font-size: 12.5px;
}

.sp-nota i {
  margin-top: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .sp-quadro {
    transition: none;
  }
}
</style>
