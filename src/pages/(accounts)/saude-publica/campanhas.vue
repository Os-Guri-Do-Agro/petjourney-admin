<script setup lang="ts">
/**
 * Saúde pública › Campanhas (protótipo, Ofício 001/2026, item 4d): as campanhas públicas de
 * vacinação antirrábica, castração, encoleiramento e exame, avisadas pelo app só a quem está com o
 * cuidado pendente. As agendadas em cima, as encerradas embaixo, com o que cada aviso rendeu.
 * "Nova campanha" abre a gaveta em passos; do mapa, `?nova=1&regiao=` abre com a região marcada.
 */
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import AvisoDoPrototipo from '@/features/saude-publica/components/AvisoDoPrototipo.vue'
import NovaCampanhaGaveta from '@/features/saude-publica/components/NovaCampanhaGaveta.vue'
import {
  dataPorExtenso,
  numero,
  regiao,
  REGIOES,
  tipoDeCampanha,
  type Campanha,
  type IdDaRegiao,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'

const route = useRoute()
const router = useRouter()
const { campanhas } = useEstadoDoPrototipo()

const agendadas = computed(() => campanhas.value.filter((item) => item.situacao === 'agendada'))
const encerradas = computed(() => campanhas.value.filter((item) => item.situacao === 'encerrada'))

const totais = computed(() => ({
  avisados: campanhas.value.reduce((soma, item) => soma + item.avisados, 0),
  atendidos: encerradas.value.reduce((soma, item) => soma + (item.atendidos ?? 0), 0),
}))

function percentual(parte: number, todo: number) {
  return todo ? Math.round((parte / todo) * 100) : 0
}

function nomesDasRegioes(campanha: Campanha) {
  return campanha.regioes.map((id) => regiao(id).nome).join(', ')
}

/* ------------------------------------------------------------------------ nova campanha */

const gavetaAberta = ref(false)
const regiaoInicial = ref<IdDaRegiao | null>(null)

function novaCampanha() {
  regiaoInicial.value = null
  gavetaAberta.value = true
}

/* Do detalhe da região no Painel: a gaveta abre com a região marcada, e o pedido sai da URL. */
watch(
  () => route.query.nova,
  (pedido) => {
    if (pedido !== '1') return
    const pedida = String(route.query.regiao ?? '')
    regiaoInicial.value = REGIOES.some((item) => item.id === pedida) ? (pedida as IdDaRegiao) : null
    gavetaAberta.value = true
    const query = { ...route.query }
    delete query.nova
    delete query.regiao
    void router.replace({ query })
  },
  { immediate: true },
)
</script>

<template>
  <UiPagina
    titulo="Campanhas"
    icone="ph ph-megaphone"
    resumo="O aviso chega no celular de quem está com o cuidado pendente, na região da campanha."
  >
    <template #acoes>
      <Button type="button" icon="ph ph-plus" label="Nova campanha" @click="novaCampanha" />
    </template>

    <div class="cp">
      <AvisoDoPrototipo />

      <dl class="cp-totais">
        <div>
          <dt>Campanhas no período</dt>
          <dd class="ui-num">{{ campanhas.length }}</dd>
        </div>
        <div>
          <dt>Tutores avisados</dt>
          <dd class="ui-num">{{ numero(totais.avisados) }}</dd>
        </div>
        <div>
          <dt>Animais atendidos nas encerradas</dt>
          <dd class="ui-num">{{ numero(totais.atendidos) }}</dd>
        </div>
      </dl>

      <UiSecao
        v-for="grupo in [
          { id: 'agendadas', titulo: 'Agendadas', itens: agendadas },
          { id: 'encerradas', titulo: 'Encerradas', itens: encerradas },
        ]"
        :key="grupo.id"
        :titulo="grupo.titulo"
        :contagem="grupo.itens.length"
      >
        <ul v-if="grupo.itens.length" class="cp-lista">
          <li
            v-for="campanha in grupo.itens"
            :key="campanha.id"
            class="cp-cartao"
            :class="`cp-cartao--${tipoDeCampanha(campanha.tipo).tom}`"
          >
            <div class="cp-cartao__topo">
              <span class="cp-cartao__icone" aria-hidden="true">
                <i :class="tipoDeCampanha(campanha.tipo).icone" />
              </span>
              <span class="cp-cartao__titulo">
                <strong>{{ campanha.titulo }}</strong>
                <span>{{ dataPorExtenso(campanha.data) }} · {{ nomesDasRegioes(campanha) }}</span>
              </span>
              <span
                class="cp-cartao__situacao"
                :class="`cp-cartao__situacao--${campanha.situacao}`"
              >
                <i
                  :class="
                    campanha.situacao === 'agendada' ? 'ph ph-calendar-dots' : 'ph ph-check-circle'
                  "
                  aria-hidden="true"
                />
                {{ campanha.situacao === 'agendada' ? 'Agendada' : 'Encerrada' }}
              </span>
            </div>

            <p class="cp-cartao__local">
              <i class="ph ph-map-pin" aria-hidden="true" />
              {{ campanha.local }}
            </p>

            <dl class="cp-cartao__numeros">
              <div>
                <dt>Avisados</dt>
                <dd class="ui-num">{{ numero(campanha.avisados) }}</dd>
              </div>
              <div>
                <dt>Abriram o aviso</dt>
                <dd class="ui-num">
                  {{
                    campanha.abriram ? `${percentual(campanha.abriram, campanha.avisados)}%` : '—'
                  }}
                </dd>
              </div>
              <div>
                <dt>Atendidos</dt>
                <dd class="ui-num">
                  <template v-if="campanha.atendidos !== null">
                    {{ numero(campanha.atendidos) }}
                  </template>
                  <span v-else class="cp-cartao__depois">depois do dia</span>
                </dd>
              </div>
            </dl>
          </li>
        </ul>
        <p v-else class="ui-vazio cp-vazio">Nenhuma campanha.</p>
      </UiSecao>
    </div>

    <NovaCampanhaGaveta v-model:visible="gavetaAberta" :regiao-inicial="regiaoInicial" />
  </UiPagina>
</template>

<style scoped>
.cp {
  display: grid;
  gap: 22px;
}

.cp-totais {
  display: grid;
  gap: 12px;
  margin: 0;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
}

.cp-totais div {
  display: grid;
  gap: 2px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
}

.cp-totais dt {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.cp-totais dd {
  margin: 0;
  color: var(--tinta);
  font-size: 26px;
  font-weight: 800;
}

.cp-lista {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  list-style: none;
}

.cp-cartao {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--linha);
  border-radius: 18px;
  background: var(--superficie);
}

.cp-cartao--pets {
  --tom-fundo: var(--pets-fundo);
  --tom-tinta: var(--pets-tinta);
}

.cp-cartao--clinica {
  --tom-fundo: var(--clinica-fundo);
  --tom-tinta: var(--clinica-tinta);
}

.cp-cartao--hotel {
  --tom-fundo: var(--hotel-fundo);
  --tom-tinta: var(--hotel-tinta);
}

.cp-cartao--portal {
  --tom-fundo: var(--portal-fundo);
  --tom-tinta: var(--portal-tinta);
}

.cp-cartao__topo {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.cp-cartao__icone {
  display: grid;
  flex: none;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 13px;
  background: var(--tom-fundo);
  color: var(--tom-tinta);
  font-size: 21px;
}

.cp-cartao__titulo {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

.cp-cartao__titulo strong {
  color: var(--tinta);
  font-size: 15px;
}

.cp-cartao__situacao {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.cp-cartao__situacao--agendada {
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
}

.cp-cartao__situacao--encerrada {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.cp-cartao__local {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.cp-cartao__numeros {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--linha-suave);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.cp-cartao__numeros div {
  display: grid;
  gap: 1px;
}

.cp-cartao__numeros dt {
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 600;
}

.cp-cartao__numeros dd {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 750;
}

.cp-cartao__depois {
  color: var(--tinta-3);
  font-size: 12.5px;
  font-weight: 500;
}

.cp-vazio {
  margin: 0;
  color: var(--tinta-2);
}
</style>
