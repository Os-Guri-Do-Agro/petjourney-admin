<script setup lang="ts">
/**
 * Vacinas da clínica pela API (E4-04, PJ-VQVQ0C; guia e4 3.5 e 3.6): quem chamar de volta e o que
 * a clínica aplicou. Duas vistas (`?aba=`):
 *
 * - **Lista de chamada**: do mais atrasado ao menos, com o filtro da situação (vencidas, série
 *   aberta, a vencer em até 30 dias), o responsável com o telefone e o horário já marcado.
 * - **Aplicadas**: o registro de um período (até 92 dias), com o lote e quem aplicou, as anuladas
 *   riscadas. É a lista da farmacovigilância.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  lerAplicadas,
  lerChamada,
  type Chamada,
  type PaginaDeAplicadas,
  type SituacaoDaChamada,
} from '@/service/parceiro/vacinacao-service'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

type Aba = 'chamada' | 'aplicadas'

const aba = computed<Aba>(() => (route.query.aba === 'aplicadas' ? 'aplicadas' : 'chamada'))

function trocarAba(valor: Aba) {
  const query = { ...route.query }
  if (valor === 'chamada') delete query.aba
  else query.aba = valor
  void router.replace({ query })
}

const opcoesDeAba = computed(() => [
  { valor: 'chamada', rotulo: t('vacinas.chamada.titulo') },
  { valor: 'aplicadas', rotulo: t('vacinas.aplicadas.titulo') },
])

/* ------------------------------------------------------------------- lista de chamada */

/* O SelectButton não marca a opção de valor `null`: "Todas" tem um valor próprio. */
const TODAS = 'TODAS'
const situacao = ref<SituacaoDaChamada | typeof TODAS>(TODAS)
const chamada = ref<Chamada[]>([])
const cursorDaChamada = ref<string | null>(null)
const carregando = ref(false)
const erro = ref('')
const lido = ref(false)

const opcoesDeSituacao = computed(() => [
  { valor: TODAS, rotulo: t('vacinas.chamada.todas') },
  { valor: 'VENCIDO', rotulo: t('vacinas.chamada.situacao.VENCIDO') },
  { valor: 'SERIE_INCOMPLETA', rotulo: t('vacinas.chamada.situacao.SERIE_INCOMPLETA') },
  { valor: 'PROXIMO', rotulo: t('vacinas.chamada.situacao.PROXIMO') },
])

async function carregarChamada(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await lerChamada(
      {
        situacao: situacao.value === TODAS ? null : situacao.value,
        cursor: mais ? cursorDaChamada.value : null,
      },
      parceiroQuery(),
    )
    chamada.value = mais ? [...chamada.value, ...pagina.itens] : pagina.itens
    cursorDaChamada.value = pagina.proximoCursor
    lido.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('vacinas.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

function quandoVence(item: Chamada) {
  const dias = item.diasParaVencer
  if (dias < 0) return t('vacinas.chamada.venceuHa', { n: -dias }, -dias)
  if (dias === 0) return t('vacinas.chamada.venceHoje')
  return t('vacinas.chamada.venceEm', { n: dias }, dias)
}

const TOM: Record<SituacaoDaChamada, string> = {
  VENCIDO: 'risco',
  SERIE_INCOMPLETA: 'atencao',
  PROXIMO: '',
}

/* -------------------------------------------------------------------------- aplicadas */

const periodo = ref<7 | 30 | 92>(30)
const aplicadas = ref<PaginaDeAplicadas['itens']>([])
const cursorDasAplicadas = ref<string | null>(null)

const opcoesDePeriodo = computed(() =>
  ([7, 30, 92] as const).map((valor) => ({
    valor,
    rotulo: t('vacinas.aplicadas.dias', { n: valor }),
  })),
)

function diaIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

async function carregarAplicadas(mais = false) {
  carregando.value = true
  erro.value = ''
  const ate = new Date()
  const de = new Date(ate.getTime() - (periodo.value - 1) * 86_400_000)
  try {
    const pagina = await lerAplicadas(
      { de: diaIso(de), ate: diaIso(ate), cursor: mais ? cursorDasAplicadas.value : null },
      parceiroQuery(),
    )
    aplicadas.value = mais ? [...aplicadas.value, ...pagina.itens] : pagina.itens
    cursorDasAplicadas.value = pagina.proximoCursor
    lido.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('vacinas.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

function carregar() {
  return aba.value === 'chamada' ? carregarChamada() : carregarAplicadas()
}

watch(aba, () => {
  lido.value = false
  void carregar()
})
watch(situacao, () => void carregarChamada())
watch(periodo, () => void carregarAplicadas())
onMounted(carregar)

const resumo = computed(() =>
  aba.value === 'chamada' ? t('vacinas.chamada.resumo') : t('vacinas.aplicadas.resumo'),
)
</script>

<template>
  <UiPagina
    :resumo="resumo"
    :carregando="carregando && !lido"
    :erro="lido ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <div class="vc">
      <div class="vc__filtros">
        <SelectButton
          :model-value="aba"
          :options="opcoesDeAba"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('vacinas.titulo')"
          @update:model-value="trocarAba"
        />
        <SelectButton
          v-if="aba === 'chamada'"
          v-model="situacao"
          :options="opcoesDeSituacao"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('vacinas.chamada.filtro')"
        />
        <SelectButton
          v-else
          v-model="periodo"
          :options="opcoesDePeriodo"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('vacinas.aplicadas.periodo')"
        />
      </div>

      <p v-if="erro && lido" class="vc__erro" role="alert">{{ erro }}</p>

      <!-- Lista de chamada: quem ligar hoje. -->
      <section v-if="aba === 'chamada'" class="ui-folha ui-lista" :aria-busy="carregando">
        <ul v-if="chamada.length" class="ui-lista">
          <li v-for="item in chamada" :key="item.aplicacaoId" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo vc__nome">
                <RouterLink :to="`/clinica/ficha/${item.paciente.id}`">{{
                  item.paciente.nome
                }}</RouterLink>
                <span
                  class="ui-selo"
                  :class="TOM[item.situacao] ? `ui-selo--${TOM[item.situacao]}` : ''"
                  >{{ t(`vacinas.chamada.situacao.${item.situacao}`) }}</span
                >
              </strong>
              <span class="ui-linha__meta">
                {{ item.vacina.nome }} · {{ quandoVence(item) }}
                <template v-if="item.agendamentoProxima">
                  ·
                  {{
                    t('vacinas.chamada.marcado', {
                      dia: rotulos.dia(item.agendamentoProxima.inicio.slice(0, 10)),
                    })
                  }}
                </template>
              </span>
            </span>
            <span class="ui-linha__fim vc__cliente">
              <span>{{ item.cliente.nome }}</span>
              <bdi v-if="item.cliente.telefone" dir="ltr" class="ui-num">{{
                item.cliente.telefone
              }}</bdi>
            </span>
          </li>
        </ul>
        <p v-else-if="lido && !carregando" class="ui-vazio vc__vazio">
          {{ t('vacinas.chamada.vazio') }}
        </p>
      </section>

      <!-- Aplicadas: o registro do período. -->
      <section v-else class="ui-folha ui-lista" :aria-busy="carregando">
        <ul v-if="aplicadas.length" class="ui-lista">
          <li
            v-for="item in aplicadas"
            :key="item.id"
            class="ui-linha"
            :class="{ vc__anulada: item.anulada }"
          >
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">
                <RouterLink :to="`/clinica/ficha/${item.paciente.id}`">{{
                  item.paciente.nome
                }}</RouterLink>
                · {{ item.vacina.nome }}
              </strong>
              <span class="ui-linha__meta">
                {{
                  [
                    rotulos.dia(item.aplicadaEm.slice(0, 10)),
                    t('vacinas.plano.dose', { n: item.dose, total: item.dosesNaSerie }),
                    item.lote ? t('vacinas.historico.lote', { codigo: item.lote.codigo }) : '',
                    item.origem === 'EXTERNA'
                      ? t('vacinas.aplicadas.externa')
                      : item.profissional.nome,
                    item.anulada ? t('vacinas.aplicadas.anulada') : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </span>
            </span>
          </li>
        </ul>
        <p v-else-if="lido && !carregando" class="ui-vazio vc__vazio">
          {{ t('vacinas.aplicadas.vazio') }}
        </p>
      </section>

      <Button
        v-if="aba === 'chamada' ? cursorDaChamada : cursorDasAplicadas"
        type="button"
        severity="secondary"
        outlined
        class="vc__mais"
        :label="t('vacinas.verMais')"
        :loading="carregando"
        @click="aba === 'chamada' ? carregarChamada(true) : carregarAplicadas(true)"
      />
    </div>
  </UiPagina>
</template>

<style scoped>
.vc {
  display: grid;
  gap: 16px;
}

.vc__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.vc__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.vc__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.vc__nome a,
.ui-linha__titulo a {
  color: var(--tinta);
  text-decoration: none;
}

.vc__nome a:hover,
.ui-linha__titulo a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.vc__cliente {
  display: grid;
  justify-items: end;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

.vc__vazio {
  margin: 0;
  padding: 24px 16px;
  color: var(--tinta-2);
}

.vc__anulada .ui-linha__titulo,
.vc__anulada .ui-linha__meta {
  text-decoration: line-through;
}

.vc__mais {
  justify-self: start;
}
</style>
