<script setup lang="ts">
/**
 * Os saques pedidos, do mais novo para o mais antigo: valor, quando foi pedido e o estado em selo
 * com palavra (em análise, pago, recusado). A linha inteira abre o detalhe numa gaveta que empurra
 * a página; o saque aberto fica na URL (`?aba=saques&saque=<id>`), e é por ela que o endereço
 * antigo `/parceiro/carteira/saques/<id>` chega aqui.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PortalSaqueDetalheDrawer from '@/components/parceiro/PortalSaqueDetalheDrawer.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import { getSaques } from '@/service/parceiro/parceiro-portal-service'
import type { SaqueResumo } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

const emit = defineEmits<{
  needsProgramas: []
}>()

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { ensureContext, parceiroQuery, store } = useParceiroPortal()
const saques = ref<SaqueResumo[]>([])
const loading = ref(true)
const error = ref('')
const drawerVisible = ref(false)
const selectedSaqueId = ref<string | null>(null)

/** O selo do saque, na cor e com a palavra do estado. */
const SELO_DO_SAQUE = {
  PENDENTE: { classe: 'ui-selo--atencao', icone: 'ph ph-hourglass' },
  PAGO: { classe: 'ui-selo--ok', icone: 'ph ph-check-circle' },
  FALHA: { classe: 'ui-selo--risco', icone: 'ph ph-x-circle' },
} as const

function intlLocale() {
  return INTL_LOCALE[locale.value as Locale]
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(intlLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

/** Do mais novo para o mais antigo, seja qual for a ordem da API. */
const saquesOrdenados = computed(() =>
  [...saques.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function openSaqueDetail(id: string) {
  selectedSaqueId.value = id
  drawerVisible.value = true

  void router.replace({
    path: '/parceiro/carteira',
    query: { ...route.query, aba: 'saques', saque: id },
  })
}

function clearSaqueQuery() {
  if (!('saque' in route.query)) {
    return
  }

  const nextQuery = { ...route.query }
  delete nextQuery.saque
  void router.replace({
    path: '/parceiro/carteira',
    query: { ...nextQuery, aba: 'saques' },
  })
}

function syncSaqueFromQuery() {
  const saqueQuery = route.query.saque
  const id = typeof saqueQuery === 'string' ? saqueQuery : null

  if (!id) {
    if (drawerVisible.value) {
      drawerVisible.value = false
      selectedSaqueId.value = null
    }
    return
  }

  selectedSaqueId.value = id
  drawerVisible.value = true
}

async function loadSaques() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()

    if (!store.statusAfiliadoAtivo) {
      emit('needsProgramas')
      return
    }

    saques.value = await getSaques(parceiroQuery())
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      emit('needsProgramas')
      return
    }

    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('carteira.saques.errorLoad')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadSaques()
  syncSaqueFromQuery()
})

watch(
  () => route.query.saque,
  () => {
    syncSaqueFromQuery()
  },
)

watch(drawerVisible, (open) => {
  if (!open) {
    selectedSaqueId.value = null
    clearSaqueQuery()
  }
})
</script>


<template>
  <div id="partner-panel-saques" class="saques">
    <div
      v-if="loading"
      role="status"
      aria-live="polite"
      :aria-label="t('carteira.saques.loadingTitle')"
    >
      <ul class="ui-lista" aria-hidden="true">
        <li v-for="n in 3" :key="n" class="ui-linha saque saque--esqueleto">
          <Skeleton width="36px" height="36px" border-radius="11px" />
          <span class="ui-linha__texto">
            <Skeleton width="7rem" height="1rem" border-radius="6px" />
            <Skeleton width="10rem" height="0.75rem" border-radius="6px" />
          </span>
          <Skeleton width="5rem" height="1.4rem" border-radius="7px" />
        </li>
      </ul>
    </div>

    <div v-else-if="error" class="saques__estado" role="alert">
      <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--risco" aria-hidden="true">
        <i class="ph ph-warning-circle" />
      </span>
      <p>{{ error }}</p>
      <Button
        type="button"
        :label="t('carteira.saques.retry')"
        icon="ph ph-arrow-clockwise"
        severity="secondary"
        outlined
        @click="loadSaques"
      />
    </div>

    <div v-else-if="saques.length === 0" class="saques__estado">
      <span class="ui-ladrilho ui-ladrilho--g" aria-hidden="true">
        <i class="ph ph-hand-coins" />
      </span>
      <strong>{{ t('carteira.saques.emptyTitle') }}</strong>
      <p>{{ t('carteira.tela.saquesVazio') }}</p>
    </div>

    <ul v-else class="ui-lista saques__lista">
      <li v-for="saque in saquesOrdenados" :key="saque.id">
        <button
          type="button"
          class="ui-linha saque"
          :class="{
            'ui-marca ui-marca--risco': saque.status === 'FALHA',
            'saque--aberto': drawerVisible && selectedSaqueId === saque.id,
          }"
          :aria-current="drawerVisible && selectedSaqueId === saque.id ? 'true' : undefined"
          @click="openSaqueDetail(saque.id)"
        >
          <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
            <i class="ph ph-arrow-up-right" />
          </span>

          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo ui-num saque__valor">
              {{ formatCentavosToBrl(saque.valorCentavos, intlLocale()) }}
            </strong>
            <span class="ui-linha__meta ui-num">
              {{ t('carteira.saques.requestedAt', { data: formatDateTime(saque.createdAt) }) }}
            </span>
            <span v-if="saque.motivoFalha" class="ui-linha__meta saque__falha">
              {{ saque.motivoFalha }}
            </span>
          </span>

          <span class="ui-linha__fim">
            <span class="ui-selo" :class="SELO_DO_SAQUE[saque.status].classe">
              <i :class="SELO_DO_SAQUE[saque.status].icone" aria-hidden="true" />
              {{ t(`carteira.saques.status.${saque.status}`) }}
            </span>
            <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
          </span>
        </button>
      </li>
    </ul>

    <PortalSaqueDetalheDrawer v-model:visible="drawerVisible" :saque-id="selectedSaqueId" />
  </div>
</template>


<style scoped>
/* Os saques moram no cartão da página (`carteira/index.vue`): aqui não há folha própria. */
.saques {
  display: grid;
}

.saque.ui-linha {
  min-height: 68px;
  padding-inline: 22px;
}

/* No cartão, a linha não arredonda: o cartão já recorta os cantos. */
.saques__lista > li > .ui-linha {
  border-radius: 0;
}

.saque--aberto.ui-linha {
  background: color-mix(in oklab, var(--pj-lugar-fundo) 65%, var(--superficie));
}

.saque__valor {
  font-size: 16px;
  font-weight: 650;
}

.saque__falha {
  color: var(--risco-tinta);
}

.saques__estado {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

.saques__estado .ui-ladrilho {
  margin-bottom: 4px;
}

.saques__estado strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.saques__estado p {
  max-width: 44ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}
</style>
