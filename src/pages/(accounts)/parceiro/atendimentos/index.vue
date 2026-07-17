<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerPanelLoading from '@/components/parceiro/PartnerPanelLoading.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import VincularCodigoDialog from '@/components/parceiro/VincularCodigoDialog.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getCompartilhamentos } from '@/service/parceiro/compartilhamentos-service'
import type {
  CompartilhamentoDetalhe,
  CompartilhamentoResumo,
  StatusCompartilhamento,
} from '@/service/parceiro/types'

const ATENDIMENTO_TABS = ['ativos', 'historico'] as const
type AtendimentoTab = (typeof ATENDIMENTO_TABS)[number]

const PAGE_SIZE = 20

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(ATENDIMENTO_TABS, 'ativos')

const items = ref<CompartilhamentoResumo[]>([])
/** Histórico pagina EXPIRADO e REVOGADO em fontes separadas (cursor próprio). */
const cursors = ref<Partial<Record<StatusCompartilhamento, string | null>>>({})
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')

const vincularVisible = ref(false)

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

const hasMore = computed(() => Object.values(cursors.value).some((cursor) => cursor != null))

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

function sortByCriadoEm(list: CompartilhamentoResumo[]) {
  return [...list].sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
  )
}

async function fetchPage(status: StatusCompartilhamento, cursor?: string) {
  const page = await getCompartilhamentos({
    ...parceiroQuery(),
    status,
    cursor,
    limit: PAGE_SIZE,
  })

  return page
}

async function loadFirstPage() {
  loading.value = true
  error.value = ''
  items.value = []
  cursors.value = {}

  try {
    await ensureContext()

    if (activeTab.value === 'ativos') {
      const page = await fetchPage('ATIVO')
      items.value = page.data
      cursors.value = { ATIVO: page.meta.proximoCursor ?? null }
    } else {
      const [expirados, revogados] = await Promise.all([
        fetchPage('EXPIRADO'),
        fetchPage('REVOGADO'),
      ])
      items.value = sortByCriadoEm([...expirados.data, ...revogados.data])
      cursors.value = {
        EXPIRADO: expirados.meta.proximoCursor ?? null,
        REVOGADO: revogados.meta.proximoCursor ?? null,
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('atendimentos.list.errorLoad')
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) {
    return
  }

  loadingMore.value = true

  try {
    const pending = Object.entries(cursors.value).filter(([, cursor]) => cursor != null) as Array<
      [StatusCompartilhamento, string]
    >

    const pages = await Promise.all(pending.map(([status, cursor]) => fetchPage(status, cursor)))

    const novos = pages.flatMap((page) => page.data)
    items.value = sortByCriadoEm([...items.value, ...novos])

    for (const [index, [status]] of pending.entries()) {
      cursors.value = {
        ...cursors.value,
        [status]: pages[index]?.meta.proximoCursor ?? null,
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('atendimentos.list.errorLoad')
  } finally {
    loadingMore.value = false
  }
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

  const diffMs = new Date(item.expiraEm).getTime() - Date.now()

  if (Number.isNaN(diffMs) || diffMs <= 0) {
    return t('atendimentos.expira.expirado')
  }

  const totalMinutes = Math.floor(diffMs / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)

  if (days > 0) {
    return t('atendimentos.expira.dias', { d: days, h: hours })
  }

  if (hours > 0) {
    return t('atendimentos.expira.horas', { h: hours, m: totalMinutes % 60 })
  }

  return t('atendimentos.expira.minutos', { m: Math.max(totalMinutes % 60, 1) })
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

    <PartnerOperabilityBanner />

    <p class="atend-lede">{{ t('atendimentos.lede') }}</p>

    <PartnerSectionTabs
      :tabs="tabs"
      :active-tab="activeTab"
      :aria-label="tabsAriaLabel"
      @select="setTab($event as AtendimentoTab)"
    />

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
.atend-row__anotacoes {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--partner-muted);
  font-size: 0.78rem;
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
