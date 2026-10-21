<script setup lang="ts">
/**
 * O detalhe de um saque, numa gaveta ao lado da lista: o valor e o estado no alto, a linha do
 * tempo (pedido, pagamento), a chave PIX usada e, quando houver, o motivo da recusa e o
 * comprovante. Em tela larga a gaveta empurra a página (a lista continua à vista); em tela
 * estreita ela passa por cima.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { INTL_LOCALE, isRTLLocale, type Locale } from '@/i18n/locales'
import { getSaqueDetalhe } from '@/service/parceiro/parceiro-portal-service'
import type { SaqueDetalhe } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

const props = defineProps<{
  saqueId: string | null
}>()

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '26.5rem'

/* Empurra a página só com largura para isso; abaixo, passa por cima, sem véu. */
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const { t, locale } = useI18n()
const toast = useToast()
const { ensureContext, parceiroQuery } = useParceiroPortal()

const saque = ref<SaqueDetalhe | null>(null)
const loading = ref(false)
const error = ref('')
const copyingPix = ref(false)

/** O selo do saque, na cor e com a palavra do estado. */
const SELO_DO_SAQUE = {
  PENDENTE: { classe: 'ui-selo--atencao', icone: 'ph ph-hourglass' },
  PAGO: { classe: 'ui-selo--ok', icone: 'ph ph-check-circle' },
  FALHA: { classe: 'ui-selo--risco', icone: 'ph ph-x-circle' },
} as const

/**
 * O PrimeVue posiciona o Drawer pelo lado físico. O painel fica no fim da linha de leitura (à
 * direita em LTR, à esquerda no árabe), do mesmo lado em que o `AppShell` abre espaço para ele.
 */
const drawerPosition = computed(() =>
  isRTLLocale(locale.value as Locale) ? 'left' : 'right',
)

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(INTL_LOCALE[locale.value as Locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

async function loadDetalhe(id: string) {
  loading.value = true
  error.value = ''
  saque.value = null

  try {
    await ensureContext()
    saque.value = await getSaqueDetalhe(id, parceiroQuery())
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('carteira.detail.errorLoad')
  } finally {
    loading.value = false
  }
}

async function copyPix() {
  const key = saque.value?.chavePixSnapshot?.trim()
  if (!key || copyingPix.value) {
    return
  }

  copyingPix.value = true
  try {
    await navigator.clipboard.writeText(key)
    toast.add({
      severity: 'success',
      summary: t('common.copied'),
      detail: t('carteira.detail.pixCopied'),
      life: 2500,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: t('carteira.detail.pixCopyError'),
      life: 3500,
    })
  } finally {
    copyingPix.value = false
  }
}

function close() {
  visible.value = false
}

watch(
  () => [visible.value, props.saqueId] as const,
  ([isOpen, id]) => {
    if (isOpen && id) {
      void loadDetalhe(id)
    }

    if (!isOpen) {
      saque.value = null
      error.value = ''
    }
  },
)
</script>


<template>
  <Drawer
    v-model:visible="visible"
    :position="drawerPosition"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="saque-gaveta"
    :pt="{ root: { class: 'saque-gaveta' } }"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
    @hide="close"
  >
    <template #header>
      <h2 class="sg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i class="ph ph-hand-coins" />
        </span>
        {{ t('carteira.detail.title') }}
      </h2>
    </template>

    <div class="sg">
      <div
        v-if="loading"
        class="sg__carregando"
        role="status"
        aria-live="polite"
        aria-busy="true"
        :aria-label="t('carteira.detail.loadingAria')"
      >
        <Skeleton width="7rem" height="0.8rem" border-radius="6px" />
        <Skeleton width="12rem" height="2.4rem" border-radius="10px" />
        <Skeleton width="100%" height="6rem" border-radius="14px" />
      </div>

      <div v-else-if="error" class="sg__erro" role="alert">
        <span class="sg__erro-icone" aria-hidden="true">
          <i class="ph ph-warning-circle" />
        </span>
        <strong>{{ t('carteira.detail.errorLoad') }}</strong>
        <p>{{ error }}</p>
        <Button
          v-if="saqueId"
          type="button"
          icon="ph ph-arrow-clockwise"
          :label="t('common.retry')"
          severity="secondary"
          outlined
          @click="loadDetalhe(saqueId)"
        />
      </div>

      <template v-else-if="saque">
        <section class="sg__topo" :data-status="saque.status">
          <span class="sg__rotulo">{{ t('carteira.detail.valorLabel') }}</span>
          <strong class="sg__valor ui-num">
            {{ formatCentavosToBrl(saque.valorCentavos, INTL_LOCALE[locale as Locale]) }}
          </strong>
          <span class="ui-selo" :class="SELO_DO_SAQUE[saque.status].classe">
            <i :class="SELO_DO_SAQUE[saque.status].icone" aria-hidden="true" />
            {{ t(`carteira.saques.status.${saque.status}`) }}
          </span>
        </section>

        <section v-if="saque.motivoFalha" class="sg__falha" role="alert">
          <i class="ph ph-x-circle" aria-hidden="true" />
          <span>
            <strong>{{ t('carteira.detail.failReason') }}</strong>
            {{ saque.motivoFalha }}
          </span>
        </section>

        <section class="sg__secao" aria-labelledby="sg-tempo">
          <h3 id="sg-tempo" class="sg__subtitulo">{{ t('carteira.detail.timelineLabel') }}</h3>
          <ol class="sg__tempo">
            <li class="marco marco--feito">
              <span class="marco__ponto" aria-hidden="true"><i class="ph ph-check" /></span>
              <span class="marco__texto">
                <strong>{{ t('carteira.detail.requestedAt') }}</strong>
                <time class="ui-num" :datetime="saque.createdAt">
                  {{ formatDateTime(saque.createdAt) }}
                </time>
              </span>
            </li>
            <li v-if="saque.liquidadoEm" class="marco marco--ok">
              <span class="marco__ponto" aria-hidden="true"><i class="ph ph-check" /></span>
              <span class="marco__texto">
                <strong>{{ t('carteira.detail.liquidatedAt') }}</strong>
                <time class="ui-num" :datetime="saque.liquidadoEm">
                  {{ formatDateTime(saque.liquidadoEm) }}
                </time>
              </span>
            </li>
            <li v-else-if="saque.status === 'PENDENTE'" class="marco marco--espera">
              <span class="marco__ponto" aria-hidden="true"><i class="ph ph-hourglass" /></span>
              <span class="marco__texto">
                <strong>{{ t('carteira.detail.awaitingLiquidation') }}</strong>
                <span>{{ t('carteira.detail.awaitingLiquidationHint') }}</span>
              </span>
            </li>
          </ol>
        </section>

        <section class="sg__secao" aria-labelledby="sg-pix">
          <h3 id="sg-pix" class="sg__subtitulo">{{ t('carteira.detail.pixSnapshot') }}</h3>
          <div class="sg__pix ui-poco">
            <bdi class="sg__chave" dir="ltr">{{ saque.chavePixSnapshot }}</bdi>
            <Button
              type="button"
              icon="ph ph-copy"
              :label="t('common.copy')"
              severity="secondary"
              text
              size="small"
              :loading="copyingPix"
              @click="copyPix"
            />
          </div>
        </section>

        <section v-if="saque.comprovante" class="sg__secao" aria-labelledby="sg-comprovante">
          <h3 id="sg-comprovante" class="sg__subtitulo">{{ t('carteira.detail.receipt') }}</h3>
          <p class="sg__comprovante">{{ saque.comprovante }}</p>
        </section>

        <p v-if="saque.status === 'PENDENTE'" class="sg__dica">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t('carteira.detail.pendingHint') }}
        </p>
      </template>
    </div>
  </Drawer>
</template>

<style scoped>
.sg-titulo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.sg {
  display: grid;
  gap: 24px;
  padding-bottom: 8px;
}

.sg__carregando {
  display: grid;
  gap: 12px;
}

.sg__erro {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 18px;
  border: 1px solid var(--linha);
  border-radius: 16px;
}

.sg__erro-icone {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 20px;
}

.sg__erro p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

/* O valor e o estado, no alto, num poço com a luz do Portal. */
.sg__topo {
  display: grid;
  justify-items: start;
  gap: 6px;
  padding: 18px 20px 20px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--pj-lugar-fundo) 70%, var(--superficie)),
    color-mix(in oklab, var(--superficie-2) 60%, var(--superficie))
  );
}

.sg__rotulo {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.sg__valor {
  color: var(--tinta);
  font-size: 36px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.sg__topo .ui-selo {
  margin-top: 4px;
}

.sg__falha {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--raio-cartao-pequeno);
  background: var(--risco-fundo);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.sg__falha i {
  margin-top: 2px;
  color: var(--risco-tinta);
  font-size: 18px;
}

.sg__falha strong {
  display: block;
  color: var(--risco-tinta);
  font-weight: 600;
}

.sg__secao {
  display: grid;
  gap: 10px;
}

.sg__subtitulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

/* A linha do tempo: um ponto por marco e um fio entre eles. */
.sg__tempo {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.marco {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 18px;
}

.marco:last-child {
  padding-bottom: 0;
}

.marco:not(:last-child)::before {
  position: absolute;
  top: 32px;
  bottom: 4px;
  inset-inline-start: 13px;
  width: 2px;
  border-radius: 2px;
  background: var(--linha-media);
  content: '';
}

.marco__ponto {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border-radius: 999px;
  background: var(--superficie-3);
  color: var(--tinta-2);
  font-size: 14px;
}

.marco--ok .marco__ponto {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.marco--espera .marco__ponto {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.marco__texto {
  display: grid;
  gap: 2px;
  padding-top: 3px;
  line-height: 1.4;
}

.marco__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.marco__texto time,
.marco__texto span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.sg__pix.ui-poco {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 8px 8px 16px;
}

.sg__chave {
  overflow: hidden;
  min-width: 0;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 15px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sg__comprovante {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao-pequeno);
  color: var(--tinta-2);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.sg__dica {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.sg__dica i {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 16px;
}
</style>

<style>
/*
 * A gaveta ocupa a altura toda (não há cabeçalho no shell novo) e, quando empurra a página, não
 * precisa de sombra: a borda basta para separar as duas superfícies.
 */
.saque-gaveta.p-drawer {
  border-inline-start: 1px solid var(--linha);
  background: var(--superficie);
  color: var(--tinta);
  box-shadow: var(--sombra-2);
}

.saque-gaveta .p-drawer-header {
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--linha);
}

.saque-gaveta .p-drawer-content {
  padding: 20px;
}

.saque-gaveta .p-drawer-header .p-button.p-drawer-close-button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  box-shadow: none;
  color: var(--tinta-2);
}

.saque-gaveta .p-drawer-header .p-button.p-drawer-close-button:hover {
  background: var(--superficie-2);
  color: var(--tinta);
}

.saque-gaveta .p-drawer-header .p-button.p-drawer-close-button:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}
</style>
