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
import VincularCodigoDialog from '@/components/parceiro/VincularCodigoDialog.vue'
import { useAgora } from '@/composables/useAgora'
import { useRevalidarAoVoltar } from '@/composables/useRevalidarAoVoltar'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
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
  ESPECIES.map((value) => ({ value, label: t(`acessos.especie.${value}`) })),
)

const tipoServicoOptions = computed(() =>
  TIPOS_SERVICO.map((value) => ({ value, label: t(`acessos.servico.${value}`) })),
)

const ordenacaoOptions = computed(() =>
  ORDENACOES.map((value) => ({ value, label: t(`acessos.filtros.ordem.${value}`) })),
)

const ordenacaoLabel = computed(() => t(`acessos.filtros.ordem.${filtros.ordenarPor}`))

/** O grupo de datas é um filtro só; o leitor de tela anuncia assim. */
const periodoAriaLabel = computed(() => t('acessos.filtros.periodo'))

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
    label: t('acessos.tabs.ativos.label'),
    description: t('acessos.tabs.ativos.description'),
  },
  {
    id: 'historico',
    label: t('acessos.tabs.historico.label'),
    description: t('acessos.tabs.historico.description'),
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

/**
 * `silencioso` é a releitura de fundo — a que acontece ao voltar para a aba.
 *
 * Ela troca a lista quando dá certo e não faz nada quando dá errado: acender o spinner ou
 * esvaziar a lista por causa de uma falha de rede em segundo plano tiraria da tela dados que
 * continuavam bons.
 */
async function loadFirstPage(silencioso = false) {
  const id = ++requestId

  if (!silencioso) {
    loading.value = true
    error.value = ''
  }

  try {
    await ensureContext()
    const page = await getCompartilhamentos(queryAtual())

    if (id !== requestId) {
      return
    }

    items.value = page.data
    cursor.value = page.meta.proximoCursor ?? null
  } catch (err) {
    if (id !== requestId || silencioso) {
      return
    }

    items.value = []
    cursor.value = null

    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('acessos.list.errorLoad')
  } finally {
    if (id === requestId && !silencioso) {
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
      error.value = err instanceof Error ? err.message : t('acessos.list.errorLoad')
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

  return t(`acessos.servico.${item.tipoServico}`)
}

/**
 * Prazo do card: contagem regressiva enquanto o acesso vive, data de encerramento
 * depois. No histórico a data solta com ícone de relógio parecia contagem viva;
 * dizer "encerrado em" custa uma palavra e tira a dúvida.
 */
function prazoLabel(item: CompartilhamentoResumo) {
  if (item.status !== 'ATIVO') {
    return t('acessos.list.encerradoEm', {
      data: new Date(item.expiraEm).toLocaleDateString(INTL_LOCALE[locale.value as Locale]),
    })
  }

  const restante = calcularTempoRestante(item.expiraEm, agora.value)

  switch (restante.estado) {
    case 'dias':
      return t('acessos.expira.dias', { d: restante.dias, h: restante.horas })
    case 'horas':
      return t('acessos.expira.horas', { h: restante.horas, m: restante.minutos })
    case 'minutos':
      return t('acessos.expira.minutos', { m: restante.minutos })
    default:
      return t('acessos.expira.expirado')
  }
}

/**
 * Só o acesso que fecha hoje ganha âmbar. Pintar toda contagem de alerta fazia a
 * lista inteira gritar, e aí nenhum card gritava.
 */
function prazoUrgente(item: CompartilhamentoResumo) {
  if (item.status !== 'ATIVO') {
    return false
  }

  return calcularTempoRestante(item.expiraEm, agora.value).estado !== 'dias'
}

/** Ativo, expirado ou revogado — o que o parceiro precisa ler, sem apelido de auditoria. */
function statusLabel(item: CompartilhamentoResumo) {
  return t(`acessos.list.status.${item.status}`)
}

function openDetalhe(id: string) {
  void router.push(`/parceiro/acessos/${id}`)
}

function onVinculado(detalhe: CompartilhamentoDetalhe) {
  void router.push(`/parceiro/acessos/${detalhe.id}`)
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
    void router.replace(`/parceiro/acessos/${deepLink}`)
    return
  }

  void loadFirstPage()
})

/**
 * Mesma razão do detalhe: a validade de um acesso pode ter encurtado sem aviso, e esta lista
 * mostra contagem regressiva. Relendo na volta, o número volta a valer.
 */
useRevalidarAoVoltar(() => void loadFirstPage(true))
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('acessos.subtitle')"
    :title="t('acessos.title')"
    :loading="false"
    :error="loadError"
    :no-partner-access="store.semAcessoParceiro"
    guidance
    @retry="ensureContext(true)"
  >
    <template #actions>
      <Button
        :label="t('acessos.vincular.cta')"
        icon="pi pi-link"
        :disabled="!store.podeOperar"
        :title="!store.podeOperar ? t('acessos.vincular.bloqueado') : undefined"
        @click="vincularVisible = true"
      />
    </template>

    <!-- Leitura não é gated por auditoria (seção 4): suspenso lê a lista e o
         prontuário, e perde só o claim e a anotação. O banner explica no lugar
         do gate de página cheia. -->
    <PartnerOperabilityBanner cover-suspended />

    <p v-if="isGuidanceVisible" class="atend-lede">{{ t('acessos.lede') }}</p>

    <PartnerSectionTabs
      :tabs="tabs"
      :active-tab="activeTab"
      :aria-label="tabsAriaLabel"
      @select="setTab($event as AtendimentoTab)"
    />

    <!-- Rótulos existem para leitor de tela, mas ficam ocultos: cinco textos
         empilhados sobre controles pequenos viram ruído. Cada controle carrega o
         próprio nome no placeholder. -->
    <section class="atend-filtros" :aria-label="t('acessos.filtros.aria')">
      <div class="atend-filtros__topo">
        <label class="atend-filtros__sr" for="atend-q">{{ t('acessos.filtros.q') }}</label>
        <span class="atend-filtros__search">
          <i class="pi pi-search" aria-hidden="true" />
          <InputText
            id="atend-q"
            v-model="filtros.q"
            :maxlength="MAX_BUSCA_PACIENTES"
            :placeholder="t('acessos.filtros.qPlaceholder')"
            autocomplete="off"
          />
        </span>

        <Button
          v-if="temFiltroAtivo"
          class="atend-filtros__limpar"
          :label="t('acessos.filtros.limpar')"
          icon="pi pi-filter-slash"
          severity="secondary"
          text
          size="small"
          @click="limparFiltros"
        />
      </div>

      <div class="atend-filtros__controles">
        <label class="atend-filtros__sr" for="atend-especie">
          {{ t('acessos.filtros.especie') }}
        </label>
        <Select
          id="atend-especie"
          v-model="filtros.especie"
          class="atend-filtros__select"
          :options="especieOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('acessos.filtros.especie')"
          show-clear
          size="small"
          :pt="selectPt"
        />

        <label class="atend-filtros__sr" for="atend-tipo">
          {{ t('acessos.filtros.tipoServico') }}
        </label>
        <Select
          id="atend-tipo"
          v-model="filtros.tipoServico"
          class="atend-filtros__select"
          :options="tipoServicoOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('acessos.filtros.tipoServico')"
          show-clear
          size="small"
          :pt="selectPt"
        />

        <label class="atend-filtros__sr" for="atend-ordem">
          {{ t('acessos.filtros.ordenarPor') }}
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
        <Button
          type="button"
          class="atend-filtros__toggle"
          :class="{ 'atend-filtros__toggle--on': filtros.comProntuario }"
          icon="pi pi-folder-open"
          :label="t('acessos.filtros.comProntuario')"
          severity="secondary"
          outlined
          :aria-pressed="filtros.comProntuario"
          @click="filtros.comProntuario = !filtros.comProntuario"
        />

        <div class="atend-filtros__periodo" role="group" :aria-label="periodoAriaLabel">
          <span class="atend-filtros__periodo-label" aria-hidden="true">
            {{ t('acessos.filtros.periodo') }}
          </span>
          <label class="atend-filtros__sr" for="atend-de">
            {{ t('acessos.filtros.vinculadoDe') }}
          </label>
          <InputText
            id="atend-de"
            v-model="filtros.vinculadoDe"
            class="atend-filtros__date"
            type="date"
            :max="filtros.vinculadoAte || undefined"
          />
          <i class="pi pi-arrow-right atend-filtros__periodo-sep" aria-hidden="true" />
          <label class="atend-filtros__sr" for="atend-ate">
            {{ t('acessos.filtros.vinculadoAte') }}
          </label>
          <InputText
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
        :title="t('acessos.list.loadingTitle')"
        :description="t('acessos.list.loadingDesc')"
      />

      <div v-else-if="error" class="atend-state atend-state--error" role="alert">
        <p>{{ error }}</p>
        <Button :label="t('common.retry')" severity="secondary" @click="loadFirstPage()" />
      </div>

      <!-- Vazio por filtro é outro problema do usuário: a saída é limpar o filtro,
           não vincular um código novo. -->
      <div v-else-if="items.length === 0 && temFiltroAtivo" class="atend-state atend-state--empty">
        <i class="pi pi-filter-slash" aria-hidden="true" />
        <strong>{{ t('acessos.list.emptyFiltroTitle') }}</strong>
        <p>{{ t('acessos.list.emptyFiltroBody') }}</p>
        <Button
          :label="t('acessos.filtros.limpar')"
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
              ? t('acessos.list.emptyAtivosTitle')
              : t('acessos.list.emptyHistoricoTitle')
          }}
        </strong>
        <p>
          {{
            activeTab === 'ativos'
              ? t('acessos.list.emptyAtivosBody')
              : t('acessos.list.emptyHistoricoBody')
          }}
        </p>
        <Button
          v-if="activeTab === 'ativos' && store.podeOperar"
          :label="t('acessos.vincular.cta')"
          icon="pi pi-link"
          @click="vincularVisible = true"
        />
      </div>

      <template v-else>
        <ul class="atend-list">
          <li v-for="item in items" :key="item.id">
            <!-- O cartão inteiro é o alvo: o parceiro clica no nome do pet, não
                 num link escondido no canto. -->
            <Button
              type="button"
              class="atend-card"
              :class="{ 'atend-card--encerrado': item.status !== 'ATIVO' }"
              @click="openDetalhe(item.id)"
            >
              <span class="atend-card__foto" aria-hidden="true">
                <img v-if="item.petFoto" :src="item.petFoto" alt="" />
                <i v-else class="pi pi-heart" />
              </span>

              <span class="atend-card__corpo">
                <span class="atend-card__topo">
                  <strong class="atend-card__nome">{{ item.petNome }}</strong>
                  <span class="atend-card__especie">{{ item.especieLabel }}</span>
                  <span class="atend-card__servico">{{ servicoLabel(item) }}</span>
                </span>

                <!-- Fatos do acesso numa linha só: antes eram cinco frases
                     empilhadas, todas do mesmo tamanho, e o card virava parágrafo. -->
                <span class="atend-card__fatos">
                  <span class="atend-fato" :class="{ 'atend-fato--prazo': prazoUrgente(item) }">
                    <i
                      class="pi"
                      :class="item.status === 'ATIVO' ? 'pi-clock' : 'pi-calendar'"
                      aria-hidden="true"
                    />
                    {{ prazoLabel(item) }}
                  </span>

                  <!-- Contagens viram número com ícone; a frase inteira fica no
                       rótulo acessível, que é onde ela ainda serve. -->
                  <span
                    class="atend-fato"
                    :class="{ 'atend-fato--vazio': !item.totalAnotacoes }"
                    :title="t('acessos.list.anotacoes', { n: item.totalAnotacoes }, item.totalAnotacoes)"
                  >
                    <i class="pi pi-comment" aria-hidden="true" />
                    <span aria-hidden="true">{{ item.totalAnotacoes }}</span>
                    <span class="atend-sr">
                      {{ t('acessos.list.anotacoes', { n: item.totalAnotacoes }, item.totalAnotacoes) }}
                    </span>
                  </span>

                  <!-- Prontuário junto: decide a ordem de leitura antes de abrir. -->
                  <span
                    v-if="item.totalDocumentos"
                    class="atend-fato atend-fato--conteudo"
                    :title="t('acessos.list.documentos', { n: item.totalDocumentos }, item.totalDocumentos)"
                  >
                    <i class="pi pi-file" aria-hidden="true" />
                    <span aria-hidden="true">{{ item.totalDocumentos }}</span>
                    <span class="atend-sr">
                      {{ t('acessos.list.documentos', { n: item.totalDocumentos }, item.totalDocumentos) }}
                    </span>
                  </span>

                  <span v-if="item.temDiario" class="atend-fato atend-fato--conteudo">
                    <i class="pi pi-book" aria-hidden="true" />
                    {{ t('acessos.list.diario') }}
                  </span>

                  <!-- O responsável mexeu depois de entregar: o que foi lido ontem
                       pode não valer mais, e em estadia isso muda a conduta. -->
                  <span v-if="resumoAtualizado(item)" class="atend-fato atend-fato--alerta">
                    <i class="pi pi-refresh" aria-hidden="true" />
                    {{ t('acessos.list.resumoAtualizado', { data: resumoAtualizado(item) }) }}
                  </span>
                </span>
              </span>

              <span class="atend-card__lado">
                <span class="atend-card__status" :class="`atend-card__status--${item.status}`">
                  {{ statusLabel(item) }}
                </span>
                <i class="pi pi-chevron-right atend-card__seta" aria-hidden="true" />
              </span>
            </Button>
          </li>
        </ul>

        <div v-if="hasMore" class="atend-more">
          <Button
            :label="t('acessos.list.loadMore')"
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
  inset-inline-start: 0.75rem;
  transform: translateY(-50%);
  color: var(--partner-faint);
  font-size: 0.82rem;
  pointer-events: none;
}

.atend-filtros__search :deep(.p-inputtext) {
  width: 100%;
  padding-inline-start: 2.1rem;
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
/* Filtro liga/desliga (aria-pressed): Button com o mesmo desenho dos outros campos da barra. */
.atend-filtros__toggle.p-button {
  flex: 0 1 auto;
  gap: 0.4rem;
  min-height: 2.25rem;
  padding: 0 0.75rem;
  border-color: var(--partner-line);
  border-radius: 0.7rem;
  background: var(--partner-card);
  color: var(--partner-muted);
  font-size: 0.82rem;
}

.atend-filtros__toggle.p-button :deep(.p-button-label) {
  font-weight: 650;
}

.atend-filtros__toggle.p-button:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--partner-primary) 40%, var(--partner-line));
  background: var(--partner-card);
  color: var(--partner-muted);
}

.atend-filtros__toggle.p-button:focus-visible {
  border-color: var(--partner-primary);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--partner-primary) 20%, transparent);
}

.atend-filtros__toggle--on.p-button,
.atend-filtros__toggle--on.p-button:not(:disabled):hover {
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
  padding-block: 0.2rem;
  padding-inline: 0.7rem 0.55rem;
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

/* InputText type=date embutido na pílula do período: sem moldura própria. */
.atend-filtros__date.p-inputtext {
  min-width: 0;
  width: 8.2rem;
  padding: 0.32rem 0.4rem;
  border: 0;
  border-radius: 0.45rem;
  background: transparent;
  box-shadow: none;
  color: var(--partner-text);
  font-size: 0.8rem;
  font-weight: 600;
}

.atend-filtros__date.p-inputtext:enabled:hover {
  background: color-mix(in srgb, var(--partner-primary) 8%, transparent);
}

.atend-filtros__date.p-inputtext:enabled:focus {
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

  .atend-filtros__date.p-inputtext {
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

/* Sequência de itens, não decoração: o leitor de tela anuncia quantos acessos há. */
.atend-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Cartão clicável rico: Button com slot, sem o visual de CTA do preset. */
.atend-card.p-button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.85rem;
  align-items: center;
  width: 100%;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.9rem;
  background: var(--partner-card);
  color: inherit;
  font-size: inherit;
  text-align: start;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.atend-card.p-button:not(:disabled):hover,
.atend-card.p-button:not(:disabled):active,
.atend-card.p-button:focus-visible {
  border-color: var(--partner-primary-strong);
  background: var(--partner-card);
  box-shadow: 0 8px 18px rgb(var(--partner-shadow-rgb) / 0.08);
  color: inherit;
}

.atend-card.p-button:focus-visible {
  outline: 2px solid var(--partner-primary);
  outline-offset: 2px;
}

.atend-card__foto {
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--partner-primary) 14%, var(--partner-card));
  color: var(--partner-primary-strong);
}

.atend-card__foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.atend-card__corpo {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}

/* Identidade numa linha só: nome, espécie e serviço andam juntos. O chip solto
   no meio do card não pertencia a nada. */
.atend-card__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.atend-card__nome {
  overflow: hidden;
  max-width: 100%;
  color: var(--partner-text);
  font-size: 0.95rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atend-card__especie {
  color: var(--partner-faint);
  font-size: 0.78rem;
}

.atend-card__servico {
  padding: 0.14rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 13%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

/* Os fatos do acesso correm na horizontal e quebram sozinhos. Empilhados, cinco
   frases do mesmo peso viravam parágrafo e o card crescia sem dizer mais. */
.atend-card__fatos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.4rem;
  min-width: 0;
}

.atend-fato {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.16rem 0.45rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--partner-surface) 70%, var(--partner-card));
  color: var(--partner-muted);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.atend-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.atend-fato i {
  font-size: 0.72rem;
}

/* Zero anotações continua sendo informação, mas não merece o mesmo peso de uma. */
.atend-fato--vazio {
  color: var(--partner-faint);
  font-weight: 500;
}

/* Indicador de conteúdo: informa, não alarma. */
.atend-fato--conteudo {
  background: color-mix(in srgb, var(--partner-primary) 10%, var(--partner-card));
  color: var(--partner-primary-strong);
}

/* Âmbar só no acesso que fecha hoje; ver a lista inteira em alerta era o mesmo
   que não ter alerta nenhum. */
.atend-fato--prazo {
  background: var(--partner-amber-bg);
  color: var(--partner-amber-text);
}

/* O resumo mudou depois da entrega: precisa saltar mais que os demais. */
.atend-fato--alerta {
  background: var(--partner-warm-bg);
  color: var(--partner-warm-text);
  white-space: normal;
}

.atend-card__lado {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.atend-card__status {
  padding: 0.24rem 0.58rem;
  border: 1px solid var(--partner-line);
  border-radius: 999px;
  background: var(--partner-surface);
  color: var(--partner-muted);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.atend-card__status--ATIVO {
  background: var(--partner-success-bg);
  color: var(--partner-success-text);
}

.atend-card__status--REVOGADO {
  background: var(--partner-warm-bg);
  color: var(--partner-warm-text);
}

.atend-card__seta {
  color: var(--partner-faint);
  font-size: 0.78rem;
}

/* Encerrado é a mesma forma em tom apagado: o histórico se lê como arquivo e não
   deve competir com um acesso vivo na aba ao lado. O hover devolve o contraste
   para deixar claro que o card ainda abre. */
.atend-card--encerrado.p-button {
  border-color: color-mix(in srgb, var(--partner-line) 72%, transparent);
  background: color-mix(in srgb, var(--partner-surface) 62%, var(--partner-card));
}

.atend-card--encerrado .atend-card__servico,
.atend-card--encerrado .atend-fato {
  background: color-mix(in srgb, var(--partner-surface) 45%, var(--partner-card));
  color: var(--partner-muted);
}

.atend-card--encerrado .atend-fato--alerta {
  background: var(--partner-warm-bg);
  color: var(--partner-warm-text);
}

.atend-card--encerrado .atend-card__foto img {
  filter: saturate(0.7);
  opacity: 0.85;
}

.atend-card--encerrado.p-button:not(:disabled):hover,
.atend-card--encerrado.p-button:focus-visible {
  background: var(--partner-card);
}

.atend-card--encerrado:hover .atend-card__foto img,
.atend-card--encerrado:focus-visible .atend-card__foto img {
  filter: none;
  opacity: 1;
}

.atend-more {
  display: flex;
  justify-content: center;
  padding-top: 0.25rem;
}

@media (max-width: 720px) {
  .atend-card.p-button {
    grid-template-columns: auto minmax(0, 1fr);
    row-gap: 0.55rem;
  }

  /* Sem espaço para a coluna da direita, o status desce alinhado ao conteúdo e a
     seta segura a borda: a linha continua legível como rodapé do card. */
  .atend-card__lado {
    grid-column: 2;
    justify-content: space-between;
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
