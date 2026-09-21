<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputOtp from 'primevue/inputotp'
import InputText from 'primevue/inputtext'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import {
  isCodigoVinculoValido,
  normalizarCodigoVinculo,
  vincularCompartilhamento,
} from '@/service/parceiro/compartilhamentos-service'
import type { CompartilhamentoDetalhe } from '@/service/parceiro/types'
import { currentColors, isDarkMode } from '@/theme/color-mode'

const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  vinculado: [detalhe: CompartilhamentoDetalhe]
}>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

/** 6 caixas, separadas visualmente em dois grupos de 3. */
const TAMANHO_CODIGO = 6
const POSICAO_SEPARADOR = 3

const codigoInput = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const throttledSeconds = ref(0)
const otpWrapper = ref<HTMLElement | null>(null)
let throttleTimer: ReturnType<typeof setInterval> | null = null

/**
 * O painel do Dialog é pintado aqui (slot `#container`), não pelo tema do PrimeVue:
 * o overlay é teleportado e não acompanha os tokens do dashboard no dark.
 */
const dialogStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--vk-bg': colors.dashboard.surface,
    '--vk-surface-soft': colors.dashboard.surfaceSoft,
    '--vk-text': colors.dashboard.text,
    '--vk-muted': colors.dashboard.muted,
    '--vk-line': colors.dashboard.line,
    '--vk-accent': isDarkMode.value ? colors.dashboard.primaryStrong : colors.dashboard.primaryDeep,
    '--vk-accent-bg': colors.dashboard.successBg,
    '--vk-warm': colors.dashboard.warm,
    '--vk-warm-bg': colors.dashboard.warmBg,
    '--vk-warm-text': colors.dashboard.warmText,
    '--vk-shadow-rgb': colors.auth.shadowRgb,
  }
})

const codigo = computed(() => normalizarCodigoVinculo(codigoInput.value))
const canSubmit = computed(
  () => !submitting.value && throttledSeconds.value === 0 && isCodigoVinculoValido(codigo.value),
)

function clearThrottle() {
  if (throttleTimer) {
    clearInterval(throttleTimer)
    throttleTimer = null
  }

  throttledSeconds.value = 0
}

/** 429: throttle de 10 tentativas/min; desabilita por 60s. */
function startThrottle() {
  throttledSeconds.value = 60
  throttleTimer = setInterval(() => {
    throttledSeconds.value -= 1

    if (throttledSeconds.value <= 0) {
      clearThrottle()
    }
  }, 1000)
}

watch(visible, (open) => {
  if (open) {
    codigoInput.value = ''
    errorMessage.value = ''
  }
})

onBeforeUnmount(() => {
  clearThrottle()
})

/** O Dialog só monta o conteúdo ao abrir; o foco tem que esperar o `show`. */
function focusPrimeiroDigito() {
  otpWrapper.value?.querySelector('input')?.focus()
}

function onCodigoModel(value: string | undefined) {
  codigoInput.value = value ?? ''
  errorMessage.value = ''
}

async function handleVincular() {
  if (!canSubmit.value) {
    if (!isCodigoVinculoValido(codigo.value)) {
      errorMessage.value = t('acessos.vincular.codigoInvalidoFormato')
    }
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    const detalhe = await vincularCompartilhamento(codigo.value, parceiroQuery())
    visible.value = false
    emit('vinculado', detalhe)
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.statusCode === 429) {
        errorMessage.value = t('acessos.vincular.throttle')
        startThrottle()
      } else if (err.statusCode === 404) {
        errorMessage.value = t('acessos.vincular.naoEncontrado')
      } else if (err.statusCode === 409) {
        errorMessage.value = t('acessos.vincular.outraEmpresa')
      } else if (err.statusCode === 403) {
        errorMessage.value = t('acessos.vincular.naoOperacional')
      } else if (err.statusCode === 400) {
        errorMessage.value = t('acessos.vincular.codigoInvalidoFormato')
      } else {
        errorMessage.value = err.message
      }
    } else {
      errorMessage.value =
        err instanceof Error ? err.message : t('acessos.vincular.erroGenerico')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    class="vincular-dialog"
    :pt="{ root: { class: 'vincular-dialog' } }"
    @show="focusPrimeiroDigito"
  >
    <template #container="{ closeCallback }">
      <div
        class="vincular-dialog__shell"
        :style="dialogStyle"
        role="document"
        aria-labelledby="vinculo-title"
      >
        <Button
          class="vincular-dialog__close"
          type="button"
          icon="pi pi-times"
          severity="secondary"
          outlined
          :aria-label="t('common.close')"
          :disabled="submitting"
          @click="closeCallback"
        />

        <div class="vincular-dialog__badge" aria-hidden="true">
          <i class="pi pi-key" />
        </div>

        <p class="vincular-dialog__eyebrow">{{ t('acessos.vincular.eyebrow') }}</p>
        <h2 id="vinculo-title" class="vincular-dialog__title">
          {{ t('acessos.vincular.title') }}
        </h2>
        <p class="vincular-dialog__lede">{{ t('acessos.vincular.lede') }}</p>

        <div class="vincular-dialog__field">
          <label id="vinculo-codigo-label">{{ t('acessos.vincular.codigoLabel') }}</label>

          <div
            ref="otpWrapper"
            class="vincular-dialog__otp"
            role="group"
            aria-labelledby="vinculo-codigo-label"
            :aria-describedby="errorMessage ? 'vinculo-codigo-error' : 'vinculo-codigo-hint'"
            @keydown.enter.prevent="handleVincular"
          >
            <InputOtp
              :model-value="codigoInput"
              :length="TAMANHO_CODIGO"
              integer-only
              :disabled="submitting"
              @update:model-value="onCodigoModel"
            >
              <template #default="{ attrs, events, index }">
                <InputText
                  v-bind="attrs"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="1"
                  class="p-inputotp-input vincular-dialog__digit"
                  :class="{ 'vincular-dialog__digit--invalid': Boolean(errorMessage) }"
                  :disabled="submitting"
                  :invalid="Boolean(errorMessage)"
                  :aria-label="t('acessos.vincular.digitoAria', { n: index })"
                  v-on="events"
                />
                <span
                  v-if="index === POSICAO_SEPARADOR"
                  class="vincular-dialog__separator"
                  aria-hidden="true"
                  >-</span
                >
              </template>
            </InputOtp>
          </div>

          <small id="vinculo-codigo-hint" class="vincular-dialog__hint">
            {{ t('acessos.vincular.hint') }}
          </small>
          <small
            v-if="errorMessage"
            id="vinculo-codigo-error"
            class="vincular-dialog__error"
            role="alert"
          >
            {{ errorMessage }}
          </small>
        </div>

        <Button
          :label="
            throttledSeconds > 0
              ? t('acessos.vincular.aguarde', { s: throttledSeconds })
              : t('acessos.vincular.submit')
          "
          :loading="submitting"
          :disabled="!canSubmit"
          @click="handleVincular"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.vincular-dialog__shell {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  width: min(26rem, calc(100vw - 2rem));
  padding: 2.1rem 1.75rem 1.75rem;
  border: 1px solid var(--vk-line);
  border-radius: 1.35rem;
  background: var(--vk-bg);
  box-shadow: 0 28px 70px rgb(var(--vk-shadow-rgb) / 0.24);
  color: var(--vk-text);
}

.vincular-dialog__close.p-button {
  position: absolute;
  top: 0.85rem;
  inset-inline-end: 0.85rem;
  width: 2.1rem;
  height: 2.1rem;
  border-color: var(--vk-line);
  border-radius: 0.65rem;
  background: var(--vk-surface-soft);
  color: var(--vk-muted);
}

.vincular-dialog__close.p-button:not(:disabled):hover {
  border-color: var(--vk-line);
  background: var(--vk-accent-bg);
  color: var(--vk-accent);
}

.vincular-dialog__close.p-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.vincular-dialog__badge {
  display: grid;
  place-items: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 999px;
  background: var(--vk-accent-bg);
  color: var(--vk-accent);
  font-size: 1.3rem;
}

.vincular-dialog__eyebrow {
  margin: 0.5rem 0 0;
  color: var(--vk-accent);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.vincular-dialog__title {
  margin: 0;
  color: var(--vk-text);
  font-size: 1.35rem;
  font-weight: 750;
  line-height: 1.25;
  text-align: center;
}

.vincular-dialog__lede {
  margin: 0;
  color: var(--vk-muted);
  font-size: 0.88rem;
  line-height: 1.5;
  text-align: center;
}

.vincular-dialog__field {
  display: grid;
  gap: 0.4rem;
  justify-items: stretch;
  width: 100%;
  margin-top: 0.9rem;
}

.vincular-dialog__field label {
  color: var(--vk-text);
  font-size: 0.82rem;
  font-weight: 650;
}

.vincular-dialog__otp :deep(.p-inputotp) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

/* Visual de marca das células sobre o InputText do InputOtp. */
.vincular-dialog__digit.p-inputtext {
  width: clamp(2.3rem, 11vw, 2.9rem);
  height: 3.1rem;
  padding: 0;
  border: 1.5px solid var(--vk-line);
  border-radius: 0.75rem;
  background: var(--vk-surface-soft);
  color: var(--vk-text);
  font-size: 1.3rem;
  font-weight: 650;
  outline: none;
  box-shadow: none;
}

.vincular-dialog__digit.p-inputtext:enabled:focus {
  border-color: var(--vk-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vk-accent) 20%, transparent);
}

.vincular-dialog__digit.p-inputtext:disabled {
  opacity: 0.6;
}

.vincular-dialog__digit--invalid.p-inputtext {
  border-color: var(--vk-warm);
  background: var(--vk-warm-bg);
}

.vincular-dialog__separator {
  color: var(--vk-muted);
  font-size: 1.1rem;
  font-weight: 650;
  /* Não entra na navegação entre caixas: o InputOtp pula irmãos que não são input. */
  user-select: none;
}

.vincular-dialog__shell > :deep(.p-button) {
  width: 100%;
  margin-top: 1rem;
}

.vincular-dialog__hint {
  color: var(--vk-muted);
  font-size: 0.75rem;
  text-align: center;
}

.vincular-dialog__error {
  color: var(--vk-warm-text);
  font-size: 0.8rem;
  text-align: center;
}
</style>

<style>
/* O painel é o `.vincular-dialog__shell`; o do PrimeVue não segue o dark do dashboard. */
.vincular-dialog.p-dialog,
.vincular-dialog .p-dialog {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.vincular-dialog .p-dialog-content {
  padding: 0 !important;
  background: transparent !important;
}
</style>
