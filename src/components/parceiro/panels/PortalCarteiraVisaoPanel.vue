<script setup lang="ts">
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import PartnerFocusCard from '@/components/parceiro/PartnerFocusCard.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import {
  getCarteira,
  solicitarSaque,
  updateCarteiraPix,
} from '@/service/parceiro/parceiro-portal-service'
import type { Carteira } from '@/service/parceiro/types'
import {
  formatCentavosToBrl,
  maskBrlCurrencyInput,
  parseBrlToCentavos,
} from '@/utils/format/money'

const emit = defineEmits<{
  needsProgramas: []
}>()

const { t } = useI18n()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()

const carteira = ref<Carteira | null>(null)
const loading = ref(true)
const error = ref('')
const chavePix = ref('')
const valorSaque = ref('')
const savingPix = ref(false)
const requestingSaque = ref(false)

const minSaqueCentavos = 5000
const comissaoIndicacaoEnabled = import.meta.env.VITE_COMISSAO_INDICACAO_ENABLED !== 'false'

const CONTACT_EMAIL = 'atendimento@petjourney.health'
const CONTACT_WHATSAPP_DISPLAY = '55 67 9883-7848'
const CONTACT_WHATSAPP_HREF = 'https://wa.me/556798837848'

const helpItems = computed(() => [
  {
    id: 'comissao',
    icon: 'pi pi-share-alt',
    title: t('carteira.help.comissao.title'),
    description: t('carteira.help.comissao.body'),
  },
  {
    id: 'saldos',
    icon: 'pi pi-wallet',
    title: t('carteira.help.saldos.title'),
    description: t('carteira.help.saldos.body'),
  },
  {
    id: 'pix',
    icon: 'pi pi-qrcode',
    title: t('carteira.help.pix.title'),
    description: t('carteira.help.pix.body'),
  },
  {
    id: 'ciclo',
    icon: 'pi pi-calendar',
    title: t('carteira.help.ciclo.title'),
    description: t('carteira.help.ciclo.body'),
  },
])

const canRequestWithdraw = computed(() => {
  if (!carteira.value || !store.isDono) {
    return false
  }

  return (
    !carteira.value.bloqueadoParaSaque &&
    carteira.value.saldoSacavelCentavos > 0 &&
    Boolean(carteira.value.chavePix)
  )
})

const showComissaoDisabledNotice = computed(
  () =>
    comissaoIndicacaoEnabled === false &&
    carteira.value != null &&
    carteira.value.saldoTotalCentavos === 0,
)

function onValorSaqueInput(value: string) {
  valorSaque.value = maskBrlCurrencyInput(value)
}

async function loadCarteira() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()

    if (!store.statusAfiliadoAtivo) {
      emit('needsProgramas')
      return
    }

    carteira.value = await getCarteira(parceiroQuery())
    chavePix.value = carteira.value.chavePix ?? ''
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      emit('needsProgramas')
      return
    }

    error.value = err instanceof Error ? err.message : t('carteira.visao.errorLoad')
  } finally {
    loading.value = false
  }
}

async function savePix() {
  if (!chavePix.value.trim()) {
    return
  }

  savingPix.value = true

  try {
    await updateCarteiraPix(chavePix.value.trim(), parceiroQuery())
    toast.add({ severity: 'success', summary: t('carteira.toast.pixSaved'), life: 3000 })
    await loadCarteira()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('carteira.toast.pixSaveError'),
      detail: err instanceof Error ? err.message : t('carteira.toast.tryAgain'),
      life: 5000,
    })
  } finally {
    savingPix.value = false
  }
}

async function requestWithdraw() {
  const centavos = parseBrlToCentavos(valorSaque.value)

  if (centavos == null || centavos < minSaqueCentavos) {
    toast.add({
      severity: 'warn',
      summary: t('carteira.toast.invalidValue'),
      detail: t('carteira.toast.minWithdraw'),
      life: 4000,
    })
    return
  }

  if (carteira.value && centavos > carteira.value.saldoSacavelCentavos) {
    toast.add({
      severity: 'warn',
      summary: t('carteira.toast.insufficient'),
      detail: t('carteira.toast.maxWithdraw', {
        valor: formatCentavosToBrl(carteira.value.saldoSacavelCentavos),
      }),
      life: 4000,
    })
    return
  }

  if (!carteira.value?.chavePix) {
    toast.add({
      severity: 'warn',
      summary: t('carteira.toast.pixRequired'),
      detail: t('carteira.toast.pixRequiredDetail'),
      life: 4000,
    })
    return
  }

  requestingSaque.value = true

  try {
    await solicitarSaque(centavos, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('carteira.toast.withdrawRequested'),
      detail: t('carteira.toast.withdrawRequestedDetail'),
      life: 4000,
    })
    valorSaque.value = ''
    await loadCarteira()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('carteira.toast.withdrawError'),
      detail: err instanceof Error ? err.message : t('carteira.toast.tryAgain'),
      life: 5000,
    })
  } finally {
    requestingSaque.value = false
  }
}

onMounted(() => {
  void loadCarteira()
})
</script>

<template>
  <div id="partner-panel-visao" class="portal-panel" role="tabpanel" aria-labelledby="partner-tab-visao">
    <div
      v-if="loading"
      class="carteira-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      :aria-label="t('carteira.visao.loadingAria')"
    >
      <section class="carteira-metrics" aria-hidden="true">
        <PartnerFocusCard class="metric metric--focus metric--skeleton">
          <Skeleton width="6.5rem" height="0.7rem" border-radius="4px" />
          <Skeleton width="8.5rem" height="1.85rem" border-radius="6px" />
          <Skeleton width="10rem" height="0.75rem" border-radius="4px" />
        </PartnerFocusCard>
        <article class="metric metric--skeleton">
          <Skeleton width="5rem" height="0.75rem" border-radius="4px" />
          <Skeleton width="7rem" height="1.35rem" border-radius="6px" />
        </article>
        <article class="metric metric--skeleton">
          <Skeleton width="5.5rem" height="0.75rem" border-radius="4px" />
          <Skeleton width="7rem" height="1.35rem" border-radius="6px" />
        </article>
      </section>

      <div class="carteira-actions" aria-hidden="true">
        <section class="carteira-panel carteira-panel--skeleton">
          <Skeleton width="5.5rem" height="1rem" border-radius="4px" />
          <div class="carteira-form">
            <Skeleton width="100%" height="3.125rem" border-radius="0.875rem" />
            <Skeleton width="7.5rem" height="2.5rem" border-radius="0.75rem" />
          </div>
        </section>

        <section class="carteira-panel carteira-panel--skeleton">
          <Skeleton width="7rem" height="1rem" border-radius="4px" />
          <Skeleton width="100%" height="0.85rem" border-radius="4px" />
          <div class="carteira-form">
            <Skeleton width="100%" height="3.125rem" border-radius="0.875rem" />
            <Skeleton width="7.5rem" height="2.5rem" border-radius="0.75rem" />
          </div>
        </section>
      </div>

      <section class="carteira-help carteira-help--skeleton" aria-hidden="true">
        <Skeleton width="12rem" height="1rem" border-radius="4px" />
        <Skeleton width="100%" height="0.85rem" border-radius="4px" />
        <div class="carteira-help__grid">
          <article v-for="index in 4" :key="index" class="carteira-help__item">
            <Skeleton width="2.2rem" height="2.2rem" border-radius="0.7rem" />
            <div class="carteira-help__copy">
              <Skeleton width="8rem" height="0.85rem" border-radius="4px" />
              <Skeleton width="100%" height="0.75rem" border-radius="4px" />
            </div>
          </article>
        </div>
      </section>
    </div>

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadCarteira">{{ t('carteira.visao.retry') }}</button>
    </div>

    <template v-else-if="carteira">
      <section class="carteira-metrics">
        <PartnerFocusCard class="metric metric--focus">
          <span>{{ t('carteira.visao.saldoSacavel') }}</span>
          <strong>{{ formatCentavosToBrl(carteira.saldoSacavelCentavos) }}</strong>
          <small>{{ t('carteira.visao.saldoSacavelHint') }}</small>
        </PartnerFocusCard>
        <article class="metric">
          <span>{{ t('carteira.visao.saldoTotal') }}</span>
          <strong>{{ formatCentavosToBrl(carteira.saldoTotalCentavos) }}</strong>
        </article>
        <article class="metric">
          <span>{{ t('carteira.visao.totalSacado') }}</span>
          <strong>{{ formatCentavosToBrl(carteira.totalSacadoCentavos) }}</strong>
        </article>
      </section>

      <p v-if="carteira.bloqueadoParaSaque" class="carteira-alert">
        {{ t('carteira.visao.alertBlocked') }}
      </p>

      <p v-else-if="carteira.saldoSacavelCentavos === 0 && carteira.saldoTotalCentavos > 0" class="carteira-alert">
        {{ t('carteira.visao.alertHold') }}
      </p>

      <p v-if="showComissaoDisabledNotice" class="carteira-alert">
        {{ t('carteira.visao.alertComissaoDisabled') }}
      </p>

      <div class="carteira-actions">
        <section class="carteira-panel">
          <h3>{{ t('carteira.visao.pix.title') }}</h3>
          <div class="carteira-form">
            <AuthTextField
              id="chave-pix"
              v-model="chavePix"
              :disabled="!store.isDono || savingPix"
              :hint="t('carteira.visao.pix.hint')"
              :label="t('carteira.visao.pix.label')"
              :placeholder="t('carteira.visao.pix.placeholder')"
            />
            <Button
              :label="t('carteira.visao.pix.save')"
              :disabled="!store.isDono"
              :loading="savingPix"
              @click="savePix"
            />
          </div>
        </section>

        <section class="carteira-panel">
          <h3>{{ t('carteira.visao.saque.title') }}</h3>
          <p class="carteira-hint">
            {{ t('carteira.visao.saque.hint', { valor: formatCentavosToBrl(minSaqueCentavos) }) }}
          </p>
          <div class="carteira-form">
            <AuthTextField
              id="valor-saque"
              :model-value="valorSaque"
              :disabled="!store.isDono || requestingSaque || carteira.bloqueadoParaSaque"
              inputmode="numeric"
              autocomplete="off"
              :label="t('carteira.visao.saque.valorLabel')"
              :placeholder="t('carteira.visao.saque.valorPlaceholder')"
              @update:model-value="onValorSaqueInput"
            >
              <template #leading>
                <span class="carteira-currency">{{ t('carteira.visao.saque.currency') }}</span>
              </template>
            </AuthTextField>
            <Button
              :label="t('carteira.visao.saque.submit')"
              :disabled="!canRequestWithdraw"
              :loading="requestingSaque"
              @click="requestWithdraw"
            />
          </div>
        </section>
      </div>

      <section class="carteira-help" aria-labelledby="carteira-help-title">
        <header class="carteira-help__head">
          <div>
            <h3 id="carteira-help-title">{{ t('carteira.help.title') }}</h3>
            <p>{{ t('carteira.help.lede') }}</p>
          </div>
          <div class="carteira-help__contacts">
            <a
              class="carteira-help__contact"
              :href="`mailto:${CONTACT_EMAIL}`"
            >
              <i class="pi pi-envelope" aria-hidden="true" />
              {{ t('carteira.help.contactEmail') }}
            </a>
            <a
              class="carteira-help__contact carteira-help__contact--whatsapp"
              :href="CONTACT_WHATSAPP_HREF"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i class="pi pi-whatsapp" aria-hidden="true" />
              {{ t('carteira.help.contactWhatsapp') }}
            </a>
          </div>
        </header>

        <ul class="carteira-help__grid">
          <li v-for="item in helpItems" :key="item.id" class="carteira-help__item">
            <span class="carteira-help__icon" aria-hidden="true">
              <i :class="item.icon" />
            </span>
            <div class="carteira-help__copy">
              <strong>{{ item.title }}</strong>
              <p>{{ item.description }}</p>
            </div>
          </li>
        </ul>

        <p class="carteira-help__footer">
          {{ t('carteira.help.footerPrefix') }}
          <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>
          {{ t('carteira.help.footerOrWhatsapp') }}
          <a :href="CONTACT_WHATSAPP_HREF" target="_blank" rel="noopener noreferrer">
            {{ CONTACT_WHATSAPP_DISPLAY }}
          </a>
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.portal-panel__state {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--partner-muted);
  text-align: center;
}

.portal-panel__state--error p {
  margin: 0;
  color: var(--partner-warm-text);
}

.portal-panel__state button {
  border: 1px solid var(--partner-line);
  border-radius: 0.6rem;
  padding: 0.45rem 0.85rem;
  background: var(--partner-card);
  cursor: pointer;
}

.carteira-skeleton {
  display: grid;
  gap: 0.75rem;
}

.carteira-panel,
.metric:not(.metric--focus) {
  padding: 1rem 1.05rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
}

.carteira-hint,
.carteira-alert {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.88rem;
}

.carteira-metrics {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1.2fr) repeat(2, minmax(0, 1fr));
  margin-bottom: 0.75rem;
}

.metric {
  display: grid;
  gap: 0.2rem;
}

.metric span {
  color: var(--partner-muted);
  font-size: 0.8rem;
}

.metric strong {
  font-size: 1.35rem;
}

.metric--focus {
  gap: 0.25rem;
}

.metric--focus span {
  color: var(--pf-on-soft);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric--focus strong {
  font-size: clamp(1.45rem, 2.4vw, 1.85rem);
  letter-spacing: -0.02em;
}

.metric--focus small {
  color: var(--pf-on-soft);
  font-size: 0.78rem;
}

.metric--skeleton,
.carteira-panel--skeleton {
  pointer-events: none;
}

.metric--focus.metric--skeleton :deep(.p-skeleton) {
  --p-skeleton-background: color-mix(in srgb, white 34%, transparent);
  --p-skeleton-animation-background: color-mix(in srgb, white 16%, transparent);
}

.metric--skeleton:not(.metric--focus) :deep(.p-skeleton),
.carteira-panel--skeleton :deep(.p-skeleton),
.carteira-help--skeleton :deep(.p-skeleton) {
  --p-skeleton-background: color-mix(in srgb, var(--partner-primary-soft) 42%, var(--partner-card));
  --p-skeleton-animation-background: color-mix(
    in srgb,
    var(--partner-primary-soft) 18%,
    transparent
  );
}

.carteira-alert {
  margin-bottom: 0.75rem;
  padding: 0.8rem 0.95rem;
  border-radius: 0.8rem;
  background: var(--partner-warm-bg);
  color: var(--partner-warm-text);
}

.carteira-panel {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 0;
  align-content: start;
  min-width: 0;
}

.carteira-actions {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  margin-bottom: 0.75rem;
}

.carteira-panel h3 {
  margin: 0;
  font-size: 0.98rem;
}

.carteira-form {
  display: grid;
  gap: 0.75rem;
}

.carteira-currency {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--partner-muted);
}

.carteira-help {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem 1.1rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.05rem;
  background:
    linear-gradient(
      165deg,
      color-mix(in srgb, var(--partner-surface) 88%, var(--partner-card)),
      var(--partner-card)
    );
}

.carteira-help--skeleton {
  pointer-events: none;
}

.carteira-help__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.carteira-help__head h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.carteira-help__head p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.84rem;
  line-height: 1.4;
}

.carteira-help__contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.carteira-help__contact {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.35rem;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.75rem;
  background: var(--partner-card);
  color: var(--partner-primary-strong);
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    background 140ms ease,
    border-color 140ms ease,
    transform 140ms ease;
}

.carteira-help__contact:hover,
.carteira-help__contact:focus-visible {
  border-color: color-mix(in srgb, var(--partner-primary) 35%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-primary-soft) 28%, var(--partner-card));
  outline: none;
  transform: translateY(-1px);
}

.carteira-help__contact--whatsapp {
  border-color: color-mix(in srgb, var(--partner-success-text) 28%, var(--partner-line));
  color: var(--partner-success-text);
}

.carteira-help__contact--whatsapp:hover,
.carteira-help__contact--whatsapp:focus-visible {
  border-color: color-mix(in srgb, var(--partner-success-text) 45%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-success-bg) 70%, var(--partner-card));
}

.carteira-help__grid {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.carteira-help__item {
  display: grid;
  grid-template-columns: 2.2rem minmax(0, 1fr);
  gap: 0.7rem;
  align-items: start;
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.9rem;
  background: var(--partner-card);
}

.carteira-help__icon {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--partner-primary-soft) 42%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 0.9rem;
}

.carteira-help__copy {
  display: grid;
  gap: 0.22rem;
  min-width: 0;
}

.carteira-help__copy strong {
  font-size: 0.88rem;
  letter-spacing: -0.01em;
}

.carteira-help__copy p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.carteira-help__footer {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.carteira-help__footer a {
  color: var(--partner-primary-strong);
  font-weight: 650;
  text-decoration: none;
}

.carteira-help__footer a:hover,
.carteira-help__footer a:focus-visible {
  text-decoration: underline;
  outline: none;
}

@media (max-width: 760px) {
  .carteira-metrics,
  .carteira-actions,
  .carteira-help__grid {
    grid-template-columns: 1fr;
  }
}
</style>
