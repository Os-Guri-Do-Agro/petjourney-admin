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
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'

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
    :resumo="`${campanhas.length} campanhas no período · ${numero(totais.avisados)} tutores avisados · ${numero(totais.atendidos)} animais atendidos`"
  >
    <template #acoes>
      <Button type="button" icon="ph ph-plus" label="Nova campanha" @click="novaCampanha" />
    </template>

    <div class="cp">
      <AvisoDoPrototipo />

      <!-- Uma caixa por grupo, uma linha por campanha: o que é, quando, onde e o que o aviso rendeu. -->
      <section
        v-for="grupo in [
          {
            id: 'agendadas',
            titulo: 'Agendadas',
            icone: 'ph ph-calendar-dots',
            descricao: 'O aviso já saiu; o atendimento conta depois do dia.',
            vazioTitulo: 'Nenhuma campanha agendada',
            vazioTexto:
              'Ao agendar uma campanha, o aviso sai pelo app só para os tutores com o cuidado pendente nas regiões escolhidas.',
            itens: agendadas,
          },
          {
            id: 'encerradas',
            titulo: 'Encerradas',
            icone: 'ph ph-check-circle',
            descricao: 'Quantos foram avisados, abriram o aviso e foram atendidos.',
            vazioTitulo: 'Nenhuma campanha encerrada',
            vazioTexto:
              'Passado o dia da campanha, ela vem para cá com quantos tutores foram avisados, abriram o aviso e foram atendidos.',
            itens: encerradas,
          },
        ]"
        :key="grupo.id"
        class="ui-folha ui-cartao cp-caixa"
        :aria-labelledby="`cp-${grupo.id}`"
      >
        <header class="ui-cartao__cabeca cp-cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i :class="grupo.icone" /></span>
          <span class="ui-cartao__titulos">
            <h2 :id="`cp-${grupo.id}`" class="ui-cartao__titulo">
              {{ grupo.titulo }}
              <span class="ui-contagem">{{ grupo.itens.length }}</span>
            </h2>
            <p class="ui-cartao__descricao">{{ grupo.descricao }}</p>
          </span>
        </header>

        <ul v-if="grupo.itens.length" class="cp-lista">
          <li
            v-for="campanha in grupo.itens"
            :key="campanha.id"
            class="cp-linha"
            :class="`cp-linha--${tipoDeCampanha(campanha.tipo).tom}`"
          >
            <span class="cp-linha__icone" aria-hidden="true">
              <i :class="tipoDeCampanha(campanha.tipo).icone" />
            </span>
            <span class="cp-linha__texto">
              <strong>{{ campanha.titulo }}</strong>
              <span>{{ dataPorExtenso(campanha.data) }} · {{ nomesDasRegioes(campanha) }}</span>
              <span class="cp-linha__local">
                <i class="ph ph-map-pin" aria-hidden="true" />
                {{ campanha.local }}
              </span>
            </span>
            <dl class="cp-linha__numeros">
              <div>
                <dt>Avisados</dt>
                <dd class="ui-num">{{ numero(campanha.avisados) }}</dd>
              </div>
              <div>
                <dt>Abriram</dt>
                <dd class="ui-num">
                  {{
                    campanha.abriram ? `${percentual(campanha.abriram, campanha.avisados)}%` : '—'
                  }}
                </dd>
              </div>
              <div>
                <dt>Atendidos</dt>
                <dd class="ui-num">
                  {{ campanha.atendidos === null ? '—' : numero(campanha.atendidos) }}
                </dd>
              </div>
            </dl>
          </li>
        </ul>
        <UiVazioIlustrado
          v-else
          aninhado
          :icone="grupo.icone"
          :titulo="grupo.vazioTitulo"
          :texto="grupo.vazioTexto"
        />
      </section>
    </div>

    <NovaCampanhaGaveta v-model:visible="gavetaAberta" :regiao-inicial="regiaoInicial" />
  </UiPagina>
</template>

<style scoped>
.cp {
  display: grid;
  gap: 18px;
}

/* A linha quebra pela largura da caixa (a gaveta aberta empurra a página), não da janela. */
.cp-caixa {
  container: campanhas / inline-size;
  display: grid;
  align-content: start;
  gap: 4px;
}

.cp-cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.cp-lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A linha: o ícone do tipo, o texto, e os três números à direita (embaixo, no tablet). */
.cp-linha {
  display: grid;
  align-items: center;
  gap: 10px 16px;
  padding: 14px 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.cp-linha + .cp-linha {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.cp-linha--pets {
  --tom-fundo: var(--pets-fundo);
  --tom-tinta: var(--pets-tinta);
}

.cp-linha--clinica {
  --tom-fundo: var(--clinica-fundo);
  --tom-tinta: var(--clinica-tinta);
}

.cp-linha--hotel {
  --tom-fundo: var(--hotel-fundo);
  --tom-tinta: var(--hotel-tinta);
}

.cp-linha--portal {
  --tom-fundo: var(--portal-fundo);
  --tom-tinta: var(--portal-tinta);
}

.cp-linha__icone {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  background: var(--tom-fundo);
  color: var(--tom-tinta);
  font-size: 18px;
}

.cp-linha__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
  color: var(--tinta-2);
  font-size: 13px;
}

.cp-linha__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.cp-linha__local {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--tinta-3);
  font-size: 12.5px;
}

.cp-linha__numeros {
  display: grid;
  gap: 18px;
  margin: 0;
  grid-template-columns: repeat(3, 5.5rem);
}

.cp-linha__numeros div {
  display: grid;
  gap: 1px;
}

.cp-linha__numeros dt {
  color: var(--tinta-3);
  font-size: 12px;
}

.cp-linha__numeros dd {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 700;
}

@container campanhas (max-width: 760px) {
  .cp-linha {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .cp-linha__numeros {
    grid-column: 2;
  }
}
</style>
