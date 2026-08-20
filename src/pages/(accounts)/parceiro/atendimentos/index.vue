<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerPanelLoading from '@/components/parceiro/PartnerPanelLoading.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import VincularCodigoDialog from '@/components/parceiro/VincularCodigoDialog.vue'
import { useAgora } from '@/composables/useAgora'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getCompartilhamentos } from '@/service/parceiro/compartilhamentos-service'
import {
  MAX_BUSCA_PACIENTES,
  type CompartilhamentoDetalhe,
  type CompartilhamentoResumo,
  type EspeciePet,
  type OrdenacaoPacientes,
  type StatusCompartilhamento,
  type TipoServicoPrestador,
} from '@/service/parceiro/types'
import { currentColors } from '@/theme/color-mode'
import { calcularTempoRestante } from '@/utils/format/expiracao'
import { carimboDoResumo } from '@/utils/parceiro/snapshot-compartilhado'

const ATENDIMENTO_TABS = ['ativos', 'historico'] as const
type AtendimentoTab = (typeof ATENDIMENTO_TABS)[number]

const PAGE_SIZE = 20
/** Espera entre teclas antes de ir à rede: a busca dispara a cada digitação. */
const BUSCA_DEBOUNCE_MS = 350

const ESPECIES: EspeciePet[] = ['CACHORRO', 'GATO', 'AVE', 'ROEDOR', 'COELHO', 'PEIXE', 'REPTIL']
const TIPOS_SERVICO: TipoServicoPrestador[] = [
  'BANHO',
  'TOSA',
  'CONSULTA',
  'EXAME',
  'HOTEL',
  'OUTRO',
]
const ORDENACOES: OrdenacaoPacientes[] = ['recentes', 'nome', 'expiraEm']

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(ATENDIMENTO_TABS, 'ativos')
const agora = useAgora()

const items = ref<CompartilhamentoResumo[]>([])
/** Cursor único: o servidor resolve status, filtros e ordem numa consulta só. */
const cursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')

const vincularVisible = ref(false)

const filtros = reactive({
  q: '',
  especie: null as EspeciePet | null,
  tipoServico: null as TipoServicoPrestador | null,
  ordenarPor: 'recentes' as OrdenacaoPacientes,
  comProntuario: false,
  vinculadoDe: '',
  vinculadoAte: '',
})

const temFiltroAtivo = computed(
  () =>
    Boolean(filtros.q.trim()) ||
    filtros.especie != null ||
    filtros.tipoServico != null ||
    filtros.ordenarPor !== 'recentes' ||
    filtros.comProntuario ||
    Boolean(filtros.vinculadoDe) ||
    Boolean(filtros.vinculadoAte),
)

/**
 * Data do resumo quando o responsável o regerou depois de entregar o acesso.
 * String vazia quando o resumo ainda é o da criação: aí não há o que avisar.
 */
function resumoAtualizado(item: CompartilhamentoResumo) {
  const carimbo = carimboDoResumo(item)

  if (!carimbo.atualizado) {
    return ''
  }

  return new Date(carimbo.data).toLocaleDateString(INTL_LOCALE[locale.value as Locale])
}

const especieOptions = computed(() =>
  ESPECIES.map((value) => ({ value, label: t(`atendimentos.especie.${value}`) })),
)

const tipoServicoOptions = computed(() =>
  TIPOS_SERVICO.map((value) => ({ value, label: t(`atendimentos.servico.${value}`) })),
)

const ordenacaoOptions = computed(() =>
  ORDENACOES.map((value) => ({ value, label: t(`atendimentos.filtros.ordem.${value}`) })),
)

const ordenacaoLabel = computed(() => t(`atendimentos.filtros.ordem.${filtros.ordenarPor}`))

/** O grupo de datas é um filtro só; o leitor de tela anuncia assim. */
const periodoAriaLabel = computed(() => t('atendimentos.filtros.periodo'))

/**
 * A lista do Select é teleportada para fora da `.partner-page`, então não herda os
 * tokens `--partner-*`: eles vão junto no `pt`. Sem isso o painel cai no fundo claro
 * que o preset do PrimeVue usa para superfície de formulário no dark.
 */
const selectPt = computed(() => {
  const colors = currentColors.value

  return {
    overlay: {
      class: 'atend-filtros__overlay',
      style: {
        '--atend-ov-bg': colors.dashboard.surface,
        '--atend-ov-line': colors.dashboard.line,
        '--atend-ov-text': colors.dashboard.text,
        '--atend-ov-muted': colors.dashboard.muted,
        '--atend-ov-hover': colors.dashboard.surfaceSoft,
        '--atend-ov-selected-bg': colors.dashboard.successBg,
        '--atend-ov-selected-text': colors.dashboard.successText,
      },
    },
  }
})

const tabs = computed(() => [
  {
    id: 'ativos',
    label: t('atendimentos.tabs.ativos.label'),
    description: t('atendimentos.tabs.ativos.description'),
  },
  {
    id: 'historico',
    label: t('atendimentos.tabs.historico.label'),
    description: t('atendimentos.tabs.historico.description'),
  },
])

const tabsAriaLabel = computed(() =>
  t('frame.tabs.aria', { labels: tabs.value.map((tab) => tab.label).join(', ') }),
)

const hasMore = computed(() => cursor.value != null)

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

/**
 * Digitar rápido dispara várias buscas; a resposta lenta de uma tecla antiga pode
 * chegar depois da nova e sobrescrever a lista. Só a requisição mais recente
 * escreve no estado.
 */
let requestId = 0

/** `YYYY-MM-DD` do input vira ISO no fuso local; vazio some da query. */
function dataFiltro(valor: string) {
  if (!valor.trim()) {
    return undefined
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim())

  if (!match) {
    return undefined
  }

  const data = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  return Number.isNaN(data.getTime()) ? undefined : data.toISOString()
}

function queryAtual(cursorAtual?: string) {
  return {
    ...parceiroQuery(),
    // O histórico usa o status virtual: um cursor só para expirados e revogados.
    status: activeTab.value === 'ativos' ? ('ATIVO' as const) : ('ENCERRADO' as const),
    q: filtros.q.trim() || undefined,
    especie: filtros.especie ?? undefined,
    tipoServico: filtros.tipoServico ?? undefined,
    ordenarPor: filtros.ordenarPor,
    comProntuario: filtros.comProntuario || undefined,
    vinculadoDe: dataFiltro(filtros.vinculadoDe),
    vinculadoAte: dataFiltro(filtros.vinculadoAte),
    cursor: cursorAtual,
    limit: PAGE_SIZE,
  }
}

async function loadFirstPage() {
  const id = ++requestId

  loading.value = true
  error.value = ''

  try {
    await ensureContext()
    const page = await getCompartilhamentos(queryAtual())

    if (id !== requestId) {
      return
    }

    items.value = page.data
    cursor.value = page.meta.proximoCursor ?? null
  } catch (err) {
    if (id !== requestId) {
      return
    }

    items.value = []
    cursor.value = null

    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('atendimentos.list.errorLoad')
  } finally {
    if (id === requestId) {
      loading.value = false
    }
  }
}

async function loadMore() {
  if (loadingMore.value || cursor.value == null) {
    return
  }

  const id = requestId
  loadingMore.value = true

  try {
    const page = await getCompartilhamentos(queryAtual(cursor.value))

    // Filtro trocado no meio do carregamento: a página velha não entra na lista.
    if (id !== requestId) {
      return
    }

    // A ordem vem do servidor (`ordenarPor`): concatenar, nunca reordenar aqui.
    items.value = [...items.value, ...page.data]
    cursor.value = page.meta.proximoCursor ?? null
  } catch (err) {
    if (id === requestId) {
      error.value = err instanceof Error ? err.message : t('atendimentos.list.errorLoad')
    }
  } finally {
    loadingMore.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined

function agendarBusca() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void loadFirstPage()
  }, BUSCA_DEBOUNCE_MS)
}

function limparFiltros() {
  filtros.q = ''
  filtros.especie = null
  filtros.tipoServico = null
  filtros.ordenarPor = 'recentes'
  filtros.comProntuario = false
  filtros.vinculadoDe = ''
  filtros.vinculadoAte = ''
}

function servicoLabel(item: CompartilhamentoResumo) {
  if (item.tipoServico === 'OUTRO' && item.servicoOutroLabel) {
    return item.servicoOutroLabel
  }

  return t(`atendimentos.servico.${item.tipoServico}`)
}

function expiraLabel(item: CompartilhamentoResumo) {
  if (item.status !== 'ATIVO') {
    return new Date(item.expiraEm).toLocaleDateString(INTL_LOCALE[locale.value as Locale])
  }

  const restante = calcularTempoRestante(item.expiraEm, agora.value)

  switch (restante.estado) {
    case 'dias':
      return t('atendimentos.expira.dias', { d: restante.dias, h: restante.horas })
    case 'horas':
      return t('atendimentos.expira.horas', { h: restante.horas, m: restante.minutos })
    case 'minutos':
      return t('atendimentos.expira.minutos', { m: restante.minutos })
    default:
      return t('atendimentos.expira.expirado')
  }
}

function statusBadge(status: StatusCompartilhamento) {
  const map: Record<StatusCompartilhamento, 'ATIVO' | 'SUSPENSO' | 'REJEITADO'> = {
    ATIVO: 'ATIVO',
    EXPIRADO: 'SUSPENSO',
    REVOGADO: 'REJEITADO',
  }

  return map[status]
}

function openDetalhe(id: string) {
  void router.push(`/parceiro/atendimentos/${id}`)
}

function onVinculado(detalhe: CompartilhamentoDetalhe) {
  void router.push(`/parceiro/atendimentos/${detalhe.id}`)
}

watch(activeTab, () => {
  void loadFirstPage()
})

/** Busca é debounced; os demais filtros são discretos e vão direto. */
watch(() => filtros.q, agendarBusca)

watch(
  () => [
    filtros.especie,
    filtros.tipoServico,
    filtros.ordenarPor,
    filtros.comProntuario,
    filtros.vinculadoDe,
    filtros.vinculadoAte,
  ],
  () => {
    clearTimeout(debounceTimer)
    void loadFirstPage()
  },
)

onUnmounted(() => {
  clearTimeout(debounceTimer)
})

onMounted(() => {
  // Deep link legado: ?atendimento=:id virou rota própria de detalhe.
  const deepLink = route.query.atendimento

  if (typeof deepLink === 'string' && deepLink) {
    void router.replace(`/parceiro/atendimentos/${deepLink}`)
    return
  }

  void loadFirstPage()
})
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('atendimentos.subtitle')"
    :title="t('atendimentos.title')"
    :loading="false"
    :error="loadError"
    :no-partner-access="store.semAcessoParceiro"
    @retry="ensureContext(true)"
  >
    <template #actions>
      <Button
        :label="t('atendimentos.vincular.cta')"
        icon="pi pi-link"
        :disabled="!store.podeOperar"
        :title="!store.podeOperar ? t('atendimentos.vincular.bloqueado') : undefined"
        @click="vincularVisible = true"
      />
    </template>

    <!-- Leitura não é gated por auditoria (seção 4): suspenso lê a lista e o
         prontuário, e perde só o claim e a anotação. O banner explica no lugar
         do gate de página cheia. -->
    <PartnerOperabilityBanner cover-suspended />

    <p class="atend-lede">{{ t('atendimentos.lede') }}</p>

    <PartnerSectionTabs
      :tabs="tabs"
      :active-tab="activeTab"
      :aria-label="tabsAriaLabel"
      @select="setTab($event as AtendimentoTab)"
    />

    <!-- Rótulos existem para leitor de tela, mas ficam ocultos: cinco textos
         empilhados sobre controles pequenos viram ruído. Cada controle carrega o
         próprio nome no placeholder. -->
    <section class="atend-filtros" :aria-label="t('atendimentos.filtros.aria')">
      <div class="atend-filtros__topo">
        <label class="atend-filtros__sr" for="atend-q">{{ t('atendimentos.filtros.q') }}</label>
        <span class="atend-filtros__search">
          <i class="pi pi-search" aria-hidden="true" />
          <InputText
            id="atend-q"
            v-model="filtros.q"
            :maxlength="MAX_BUSCA_PACIENTES"
            :placeholder="t('atendimentos.filtros.qPlaceholder')"
            autocomplete="off"
          />
        </span>

        <Button
          v-if="temFiltroAtivo"
          class="atend-filtros__limpar"
          :label="t('atendimentos.filtros.limpar')"
          icon="pi pi-filter-slash"
          severity="secondary"
          text
          size="small"
          @click="limparFiltros"
        />
      </div>

      <div class="atend-filtros__controles">
        <label class="atend-filtros__sr" for="atend-especie">
          {{ t('atendimentos.filtros.especie') }}
        </label>
        <Select
          id="atend-especie"
          v-model="filtros.especie"
          class="atend-filtros__select"
          :options="especieOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('atendimentos.filtros.especie')"
          show-clear
          size="small"
          :pt="selectPt"
        />

        <label class="atend-filtros__sr" for="atend-tipo">
          {{ t('atendimentos.filtros.tipoServico') }}
        </label>
        <Select
          id="atend-tipo"
          v-model="filtros.tipoServico"
          class="atend-filtros__select"
          :options="tipoServicoOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('atendimentos.filtros.tipoServico')"
          show-clear
          size="small"
          :pt="selectPt"
        />

        <label class="atend-filtros__sr" for="atend-ordem">
          {{ t('atendimentos.filtros.ordenarPor') }}
        </label>
        <Select
          id="atend-ordem"
          v-model="filtros.ordenarPor"
          class="atend-filtros__select"
          :options="ordenacaoOptions"
          option-label="label"
          option-value="value"
          size="small"
          :pt="selectPt"
        >
          <!-- Ordenação sempre tem valor, então o placeholder nunca aparece:
               o ícone é o que diz que aquele controle é a ordem da lista. -->
          <template #value>
            <span class="atend-filtros__ordem">
              <i class="pi pi-sort-alt" aria-hidden="true" />
              {{ ordenacaoLabel }}
            </span>
          </template>
        </Select>

        <!-- Filtro binário: acesso com prontuário pede leitura antes do
             atendimento, acesso só de identidade não. `aria-pressed` porque é
             um estado que fica ligado, não uma ação que dispara e passa. -->
        <button
          type="button"
          class="atend-filtros__toggle"
          :class="{ 'atend-filtros__toggle--on': filtros.comProntuario }"
          :aria-pressed="filtros.comProntuario"
          @click="filtros.comProntuario = !filtros.comProntuario"
        >
          <i class="pi pi-folder-open" aria-hidden="true" />
          {{ t('atendimentos.filtros.comProntuario') }}
        </button>

        <div class="atend-filtros__periodo" role="group" :aria-label="periodoAriaLabel">
          <span class="atend-filtros__periodo-label" aria-hidden="true">
            {{ t('atendimentos.filtros.periodo') }}
          </span>
          <label class="atend-filtros__sr" for="atend-de">
            {{ t('atendimentos.filtros.vinculadoDe') }}
          </label>
          <input
            id="atend-de"
            v-model="filtros.vinculadoDe"
            class="atend-filtros__date"
            type="date"
            :max="filtros.vinculadoAte || undefined"
          />
          <i class="pi pi-arrow-right atend-filtros__periodo-sep" aria-hidden="true" />
          <label class="atend-filtros__sr" for="atend-ate">
            {{ t('atendimentos.filtros.vinculadoAte') }}
          </label>
          <input
            id="atend-ate"
            v-model="filtros.vinculadoAte"
            class="atend-filtros__date"
            type="date"
            :min="filtros.vinculadoDe || undefined"
          />
        </div>
      </div>
    </section>

    <div class="atend-panel" role="tabpanel">
      <PartnerPanelLoading
        v-if="loading"
        :title="t('atendimentos.list.loadingTitle')"
        :description="t('atendimentos.list.loadingDesc')"
      />

      <div v-else-if="error" class="atend-state atend-state--error" role="alert">
        <p>{{ error }}</p>
        <Button :label="t('common.retry')" severity="secondary" @click="loadFirstPage" />
      </div>

      <!-- Vazio por filtro é outro problema do usuário: a saída é limpar o filtro,
           não vincular um código novo. -->
      <div v-else-if="items.length === 0 && temFiltroAtivo" class="atend-state atend-state--empty">
        <i class="pi pi-filter-slash" aria-hidden="true" />
        <strong>{{ t('atendimentos.list.emptyFiltroTitle') }}</strong>
        <p>{{ t('atendimentos.list.emptyFiltroBody') }}</p>
        <Button
          :label="t('atendimentos.filtros.limpar')"
          icon="pi pi-filter-slash"
          severity="secondary"
          @click="limparFiltros"
        />
      </div>

      <div v-else-if="items.length === 0" class="atend-state atend-state--empty">
        <i class="pi pi-inbox" aria-hidden="true" />
        <strong>
          {{
            activeTab === 'ativos'
              ? t('atendimentos.list.emptyAtivosTitle')
              : t('atendimentos.list.emptyHistoricoTitle')
          }}
        </strong>
        <p>
          {{
            activeTab === 'ativos'
              ? t('atendimentos.list.emptyAtivosBody')
              : t('atendimentos.list.emptyHistoricoBody')
          }}
        </p>
        <Button
          v-if="activeTab === 'ativos' && store.podeOperar"
          :label="t('atendimentos.vincular.cta')"
          icon="pi pi-link"
          @click="vincularVisible = true"
        />
      </div>

      <template v-else>
        <div class="atend-list">
          <button
            v-for="item in items"
            :key="item.id"
            type="button"
            class="atend-row"
            @click="openDetalhe(item.id)"
          >
            <div class="atend-row__pet">
              <img
                v-if="item.petFoto"
                :src="item.petFoto"
                :alt="''"
                class="atend-row__foto"
                aria-hidden="true"
              />
              <span v-else class="atend-row__foto atend-row__foto--empty" aria-hidden="true">
                <i class="pi pi-heart" />
              </span>
              <div>
                <strong>{{ item.petNome }}</strong>
                <p>{{ item.especieLabel }}</p>
              </div>
            </div>

            <span class="atend-row__chip">{{ servicoLabel(item) }}</span>

            <div class="atend-row__meta">
              <span class="atend-row__expira">
                <i class="pi pi-clock" aria-hidden="true" />
                {{ expiraLabel(item) }}
              </span>
              <span class="atend-row__anotacoes">
                <i class="pi pi-comment" aria-hidden="true" />
                {{ t('atendimentos.list.anotacoes', { n: item.totalAnotacoes }) }}
              </span>
              <!-- Prontuário junto: decide a ordem de leitura antes de abrir. -->
              <span v-if="item.totalDocumentos" class="atend-row__prontuario">
                <i class="pi pi-file" aria-hidden="true" />
                {{ t('atendimentos.list.documentos', { n: item.totalDocumentos }) }}
              </span>
              <span v-if="item.temDiario" class="atend-row__prontuario">
                <i class="pi pi-book" aria-hidden="true" />
                {{ t('atendimentos.list.diario') }}
              </span>
              <!-- O responsável mexeu depois de entregar: o que foi lido ontem
                   pode não valer mais, e em estadia isso muda a conduta. -->
              <span v-if="resumoAtualizado(item)" class="atend-row__atualizado">
                <i class="pi pi-refresh" aria-hidden="true" />
                {{ t('atendimentos.list.resumoAtualizado', { data: resumoAtualizado(item) }) }}
              </span>
            </div>

            <PartnerStatusBadge :status="statusBadge(item.status)" />
          </button>
        </div>

        <div v-if="hasMore" class="atend-more">
          <Button
            :label="t('atendimentos.list.loadMore')"
            severity="secondary"
            :loading="loadingMore"
            @click="loadMore"
          />
        </div>
      </template>
    </div>

    <VincularCodigoDialog v-model:visible="vincularVisible" @vinculado="onVinculado" />
  </PartnerPageFrame>
</template>

<style scoped>
.atend-lede {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.94rem;
  line-height: 1.5;
}

/* Superfície mais discreta que os cards da lista: a barra é ferramenta, não
   conteúdo, e não deve competir com as linhas de atendimento. */
.atend-filtros {
  display: grid;
  gap: 0.6rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--partner-line) 88%, transparent);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--partner-surface) 78%, var(--partner-card));
}

.atend-filtros__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Linha 1: a busca manda, e cresce até empurrar o botão para a direita. */
.atend-filtros__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.atend-filtros__search {
  position: relative;
  display: block;
  flex: 1 1 14rem;
  min-width: 0;
}

.atend-filtros__search i {
  position: absolute;
  top: 50%;
  left: 0.75rem;
  transform: translateY(-50%);
  color: var(--partner-faint);
  font-size: 0.82rem;
  pointer-events: none;
}

.atend-filtros__search :deep(.p-inputtext) {
  width: 100%;
  padding-left: 2.1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.7rem;
  background: var(--partner-card);
  /* O preset pinta o texto do campo com a cor de superfície: no dark isso some
     dentro do próprio fundo. */
  color: var(--partner-text);
}

.atend-filtros__search :deep(.p-inputtext::placeholder) {
  color: var(--partner-faint);
  opacity: 1;
}

.atend-filtros__search :deep(.p-inputtext:focus) {
  border-color: var(--partner-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--partner-primary) 20%, transparent);
}

.atend-filtros__limpar {
  flex: 0 0 auto;
}

/* Linha 2: controles compactos que quebram sozinhos, sem grid rígido. */
.atend-filtros__controles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

/* A classe cai na raiz do próprio Select (`.p-select`), então o fundo vem daqui —
   com `:deep(.p-select)` a regra nunca casaria e o campo herdaria a superfície de
   formulário do preset, que é clara mesmo no dark. */
.atend-filtros__select {
  flex: 0 1 auto;
  width: auto;
  min-width: 8.5rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.7rem;
  background: var(--partner-card);
  color: var(--partner-text);
}

.atend-filtros__select:not(.p-disabled):hover {
  border-color: color-mix(in srgb, var(--partner-primary) 40%, var(--partner-line));
}

/* Mesma altura e raio dos selects do lado: é mais um filtro na fileira. */
.atend-filtros__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex: 0 1 auto;
  min-height: 2.25rem;
  padding: 0 0.75rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.7rem;
  background: var(--partner-card);
  color: var(--partner-muted);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 650;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.atend-filtros__toggle:hover {
  border-color: color-mix(in srgb, var(--partner-primary) 40%, var(--partner-line));
}

.atend-filtros__toggle:focus-visible {
  border-color: var(--partner-primary);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--partner-primary) 20%, transparent);
}

.atend-filtros__toggle--on {
  border-color: var(--partner-primary);
  background: color-mix(in srgb, var(--partner-primary-soft) 45%, var(--partner-card));
  color: var(--partner-primary-strong);
}

.atend-filtros__select:not(.p-disabled).p-focus {
  border-color: var(--partner-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--partner-primary) 20%, transparent);
}

.atend-filtros__select :deep(.p-select-label) {
  color: var(--partner-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.atend-filtros__select :deep(.p-select-label.p-placeholder) {
  color: var(--partner-muted);
  font-weight: 500;
}

.atend-filtros__select :deep(.p-select-dropdown),
.atend-filtros__select :deep(.p-select-clear-icon) {
  color: var(--partner-muted);
}

.atend-filtros__ordem {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.atend-filtros__ordem i {
  color: var(--partner-primary-strong);
  font-size: 0.75rem;
}

/* Período é um filtro só: as duas datas vivem dentro da mesma cápsula. */
.atend-filtros__periodo {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.2rem 0.55rem 0.2rem 0.7rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.7rem;
  background: var(--partner-card);
}

.atend-filtros__periodo-label {
  color: var(--partner-muted);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.atend-filtros__periodo-sep {
  color: var(--partner-faint);
  font-size: 0.68rem;
}

.atend-filtros__date {
  min-width: 0;
  width: 8.2rem;
  padding: 0.32rem 0.4rem;
  border: 0;
  border-radius: 0.45rem;
  background: transparent;
  color: var(--partner-text);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
}

.atend-filtros__date:hover {
  background: color-mix(in srgb, var(--partner-primary) 8%, transparent);
}

.atend-filtros__date:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--partner-primary) 45%, transparent);
  outline-offset: 1px;
}

/* O ícone já vem claro no dark pelo `color-scheme` que o color-mode aplica na raiz:
   inverter aqui o pintava de escuro sobre fundo escuro. */
.atend-filtros__date::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.6;
}

@media (max-width: 640px) {
  .atend-filtros__select,
  .atend-filtros__periodo {
    flex: 1 1 100%;
  }

  .atend-filtros__date {
    flex: 1 1 0;
    width: auto;
  }
}

.atend-panel {
  display: grid;
  gap: 0.85rem;
}

.atend-state {
  display: grid;
  gap: 0.6rem;
  justify-items: center;
  padding: 2.2rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.1rem;
  background: var(--partner-card);
  color: var(--partner-muted);
  text-align: center;
}

.atend-state--error p {
  margin: 0;
  color: var(--partner-warm-text);
}

.atend-state--empty i {
  font-size: 1.4rem;
  color: var(--partner-primary-strong);
}

.atend-state--empty strong {
  color: var(--partner-text);
}

.atend-state--empty p {
  margin: 0;
  max-width: 26rem;
  font-size: 0.88rem;
  line-height: 1.5;
}

.atend-list {
  display: grid;
  gap: 0.55rem;
}

.atend-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) auto minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  width: 100%;
  padding: 0.8rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.atend-row:hover,
.atend-row:focus-visible {
  border-color: var(--partner-primary-strong);
  box-shadow: 0 10px 22px rgb(var(--partner-shadow-rgb) / 0.08);
  transform: translateY(-1px);
}

.atend-row:focus-visible {
  outline: 2px solid var(--partner-primary);
  outline-offset: 2px;
}

.atend-row__pet {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.atend-row__foto {
  width: 2.6rem;
  height: 2.6rem;
  flex: 0 0 auto;
  border-radius: 0.8rem;
  object-fit: cover;
}

.atend-row__foto--empty {
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--partner-primary) 15%, var(--partner-card));
  color: var(--partner-primary-strong);
}

.atend-row__pet strong {
  display: block;
  overflow: hidden;
  color: var(--partner-text);
  font-size: 0.92rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atend-row__pet p {
  margin: 0.1rem 0 0;
  color: var(--partner-muted);
  font-size: 0.78rem;
}

.atend-row__chip {
  display: inline-flex;
  padding: 0.26rem 0.6rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 14%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
}

.atend-row__meta {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.atend-row__expira,
.atend-row__anotacoes,
.atend-row__prontuario,
.atend-row__atualizado {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--partner-muted);
  font-size: 0.78rem;
}

/* Indicador de conteúdo: informa, não alarma. */
.atend-row__prontuario {
  color: var(--partner-primary-strong);
  font-weight: 650;
}

/* O resumo mudou depois da entrega: precisa saltar mais que os demais. */
.atend-row__atualizado {
  color: var(--partner-warm-text);
  font-weight: 650;
}

.atend-row__expira {
  color: var(--partner-amber-text);
  font-weight: 650;
}

.atend-more {
  display: flex;
  justify-content: center;
  padding-top: 0.25rem;
}

@media (max-width: 860px) {
  .atend-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'pet badge'
      'chip meta';
    row-gap: 0.6rem;
  }

  .atend-row__pet {
    grid-area: pet;
  }

  .atend-row__chip {
    grid-area: chip;
    justify-self: start;
  }

  .atend-row__meta {
    grid-area: meta;
    justify-items: end;
  }

  .atend-row > :last-child {
    grid-area: badge;
    justify-self: end;
  }
}
</style>

<style>
/* Painel teleportado: os tokens chegam pelo `pt` (inline) e cascateiam daqui. */
.atend-filtros__overlay.p-select-overlay {
  border: 1px solid var(--atend-ov-line);
  background: var(--atend-ov-bg);
  color: var(--atend-ov-text);
}

.atend-filtros__overlay .p-select-option {
  color: var(--atend-ov-text);
}

.atend-filtros__overlay .p-select-option:not(.p-disabled):hover,
.atend-filtros__overlay .p-select-option.p-focus:not(.p-select-option-selected) {
  background: var(--atend-ov-hover);
  color: var(--atend-ov-text);
}

.atend-filtros__overlay .p-select-option.p-select-option-selected {
  background: var(--atend-ov-selected-bg);
  color: var(--atend-ov-selected-text);
}

.atend-filtros__overlay .p-select-empty-message {
  color: var(--atend-ov-muted);
}
</style>
